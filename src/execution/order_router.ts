import { OrderRequest } from '../types';
import { WalletManager } from '../wallets/wallet_manager';
import { RiskEngine } from '../risk/risk_engine';
import { TradeExecutor } from './trade_executor';
import { logger } from '../reporting/logs';
import { consoleLog } from '../reporting/console_log';
import {
  recordExecutionRouteAttempt,
  recordExecutionRouteFailure,
  recordExecutionRouteLatency,
  recordExecutionRouteSuccess,
  recordExecutionSubmitAttempt,
  recordExecutionSubmitFailure,
  recordExecutionSubmitLatency,
  recordOrderRouterRiskRejection,
  recordOrderRouterRiskSuppressed,
} from '../reporting/runtime_counters';
import type { Database } from '../storage/database';
import { randomUUID } from 'crypto';

export class OrderRouter {
  private readonly riskLogWindowMs = Number(process.env.RISK_LOG_DEDUPE_WINDOW_MS ?? '5000');
  private readonly riskLogRetentionMs = Number(process.env.RISK_LOG_DEDUPE_RETENTION_MS ?? '300000');
  private readonly maxRiskLogKeys = Number(process.env.RISK_LOG_DEDUPE_MAX_KEYS ?? '5000');
  private readonly riskLogCleanupIntervalMs = Number(process.env.RISK_LOG_DEDUPE_CLEANUP_INTERVAL_MS ?? '30000');
  private readonly riskLogState = new Map<string, { lastLoggedAt: number; suppressed: number }>();
  private lastRiskLogCleanupAt = 0;

  /**
   * In-flight deduplication: prevents the same order (same wallet+market+outcome+side)
   * from being submitted more than once within ORDER_DEDUP_WINDOW_MS (default 30 s).
   * This closes the gap between signal generation and fill acknowledgment during
   * which repeated signals for the same market would otherwise all be submitted.
   */
  private readonly inFlightWindowMs = Number(process.env.ORDER_DEDUP_WINDOW_MS ?? '30000');
  private readonly inFlightOrders = new Map<string, number>(); // key → last submitted at

  /** Portfolio-level per-market exposure limit across all wallets (USD).
   *  Override via MAX_PORTFOLIO_EXPOSURE_PER_MARKET env var. */
  private readonly maxPortfolioExposurePerMarket = Math.max(
    0,
    Number(process.env.MAX_PORTFOLIO_EXPOSURE_PER_MARKET ?? '1000'),
  );
  private readonly minLiveBuyNotionalUsd = Math.max(
    0,
    Number(process.env.MIN_LIVE_BUY_NOTIONAL_USD ?? '1'),
  );

  constructor(
    private readonly walletManager: WalletManager,
    private readonly riskEngine: RiskEngine,
    private readonly tradeExecutor: TradeExecutor,
    private readonly database?: Database,
    private readonly strategyRunId?: string,
  ) {}

  async route(order: OrderRequest): Promise<boolean> {
    this.cleanupRiskLogState(Date.now());

    const routeStartedAt = Date.now();
    recordExecutionRouteAttempt();
    const intentId = randomUUID();

    this.database?.appendExecutionIntent({
      intent_id: intentId,
      wallet_id: order.walletId,
      strategy_name: order.strategy,
      strategy_run_id: this.strategyRunId,
      market_id: order.marketId,
      token_id: order.tokenId,
      outcome: order.outcome,
      side: order.side,
      price: order.price,
      size: order.size,
    });

    const wallet = this.walletManager.getWallet(order.walletId);
    if (!wallet) {
      logger.warn({ walletId: order.walletId }, 'Wallet not found');
      consoleLog.warn('ORDER', `Wallet ${order.walletId} not found — order dropped`, {
        walletId: order.walletId,
        marketId: order.marketId,
      });
      recordExecutionRouteFailure();
      recordExecutionRouteLatency(Date.now() - routeStartedAt);
      this.database?.appendExecutionEvent({
        intent_id: intentId,
        event_type: 'route_failed',
        status_text: 'wallet_not_found',
        details: { walletId: order.walletId },
      });
      return false;
    }

    const state = wallet.getState();

    // Normalize LIVE BUY orders to minimum marketable notional before risk checks,
    // so balance/exposure checks evaluate the true order cost sent to venue.
    const routedOrder: OrderRequest = { ...order };
    if (state.mode === 'LIVE' && routedOrder.side === 'BUY') {
      const cost = routedOrder.price * routedOrder.size;
      if (cost > 0 && cost < this.minLiveBuyNotionalUsd) {
        routedOrder.size = Math.ceil(this.minLiveBuyNotionalUsd / Math.max(routedOrder.price, 0.0001));
      }
    }

    const risk = this.riskEngine.check(routedOrder, state);
    if (!risk.ok) {
      recordOrderRouterRiskRejection();
      const reason = risk.reason ?? 'Unknown risk rejection';
      const dedupeKey = `${routedOrder.walletId}:${reason}`;
      const now = Date.now();
      const dedupe = this.riskLogState.get(dedupeKey);

      if (!dedupe || now - dedupe.lastLoggedAt >= this.riskLogWindowMs) {
        const suppressedInWindow = dedupe?.suppressed ?? 0;
        logger.warn(
          { walletId: routedOrder.walletId, reason, suppressedInWindow },
          'Risk check failed',
        );
        consoleLog.warn('RISK', `Risk rejected: ${reason} [${routedOrder.walletId}] ${routedOrder.side} ${routedOrder.outcome} ×${routedOrder.size}`, {
          walletId: routedOrder.walletId,
          marketId: routedOrder.marketId,
          reason,
          side: routedOrder.side,
          outcome: routedOrder.outcome,
          price: routedOrder.price,
          size: routedOrder.size,
          suppressedInWindow,
        });
        this.riskLogState.set(dedupeKey, { lastLoggedAt: now, suppressed: 0 });
      } else {
        dedupe.suppressed += 1;
        recordOrderRouterRiskSuppressed();
      }

      recordExecutionRouteFailure();
      recordExecutionRouteLatency(Date.now() - routeStartedAt);
      this.database?.appendExecutionEvent({
        intent_id: intentId,
        event_type: 'route_rejected',
        status_text: reason,
        details: {
          walletId: routedOrder.walletId,
          marketId: routedOrder.marketId,
          side: routedOrder.side,
          outcome: routedOrder.outcome,
          price: routedOrder.price,
          size: routedOrder.size,
        },
      });
      return false;
    }

    /* ── Portfolio-level per-market exposure check (cross-wallet) ── */
    if (this.maxPortfolioExposurePerMarket > 0 && routedOrder.side === 'BUY') {
      const portfolioExposure = this.walletManager.getTotalMarketExposure(routedOrder.marketId);
      const orderCost = routedOrder.price * routedOrder.size;
      if (portfolioExposure + orderCost > this.maxPortfolioExposurePerMarket) {
        const portfolioReason = `Portfolio market exposure $${(portfolioExposure + orderCost).toFixed(2)} exceeds limit $${this.maxPortfolioExposurePerMarket}`;
        const dedupeKey = `portfolio:${routedOrder.marketId}:${portfolioReason}`;
        const now2 = Date.now();
        const dedupe2 = this.riskLogState.get(dedupeKey);
        if (!dedupe2 || now2 - dedupe2.lastLoggedAt >= this.riskLogWindowMs) {
          consoleLog.warn('RISK', `Portfolio risk rejected: ${portfolioReason}`, {
            marketId: routedOrder.marketId,
            portfolioExposure,
            orderCost,
            limit: this.maxPortfolioExposurePerMarket,
          });
          this.riskLogState.set(dedupeKey, { lastLoggedAt: now2, suppressed: 0 });
        } else {
          dedupe2.suppressed += 1;
          recordOrderRouterRiskSuppressed();
        }
        recordOrderRouterRiskRejection();
        recordExecutionRouteFailure();
        recordExecutionRouteLatency(Date.now() - routeStartedAt);
        this.database?.appendExecutionEvent({
          intent_id: intentId,
          event_type: 'route_rejected',
          status_text: 'portfolio_exposure_limit',
          details: {
            marketId: routedOrder.marketId,
            walletId: routedOrder.walletId,
            portfolioExposure,
            orderCost,
            limit: this.maxPortfolioExposurePerMarket,
          },
        });
        return false;
      }
    }

    /* ── In-flight deduplication ────────────────────────────────── */
    const orderKey = `${routedOrder.walletId}:${routedOrder.marketId}:${routedOrder.outcome}:${routedOrder.side}`;
    const lastSubmittedAt = this.inFlightOrders.get(orderKey) ?? 0;
    const now3 = Date.now();
    if (now3 - lastSubmittedAt < this.inFlightWindowMs) {
      const suppressMsg = `Duplicate in-flight order suppressed: ${routedOrder.side} ${routedOrder.outcome} on ${routedOrder.marketId} [${routedOrder.walletId}]`;
      const dedupeKey3 = `inflight:${orderKey}`;
      const dedupe3 = this.riskLogState.get(dedupeKey3);
      if (!dedupe3 || now3 - dedupe3.lastLoggedAt >= this.riskLogWindowMs) {
        consoleLog.warn('RISK', suppressMsg, { walletId: routedOrder.walletId, marketId: routedOrder.marketId });
        this.riskLogState.set(dedupeKey3, { lastLoggedAt: now3, suppressed: 0 });
      } else {
        dedupe3.suppressed += 1;
        recordOrderRouterRiskSuppressed();
      }
      recordOrderRouterRiskRejection();
      recordExecutionRouteFailure();
      recordExecutionRouteLatency(now3 - routeStartedAt);
      this.database?.appendExecutionEvent({
        intent_id: intentId,
        event_type: 'route_rejected',
        status_text: 'inflight_duplicate_suppressed',
        details: {
          walletId: routedOrder.walletId,
          marketId: routedOrder.marketId,
          side: routedOrder.side,
          outcome: routedOrder.outcome,
        },
      });
      return false;
    }

    const submitStartedAt = Date.now();
    recordExecutionSubmitAttempt();
    const submissionId = randomUUID();
    const submitDedupeBase = `${intentId}:${routedOrder.walletId}:${routedOrder.marketId}:${routedOrder.side}:${routedOrder.outcome}`;
    this.database?.appendExecutionSubmission({
      submission_id: submissionId,
      intent_id: intentId,
      wallet_id: routedOrder.walletId,
      dedupe_key: `${submitDedupeBase}:submit_attempted`,
      status: 'submit_attempted',
    });
    this.database?.appendExecutionEvent({
      intent_id: intentId,
      submission_id: submissionId,
      exchange_event_id: `${submissionId}:submit_attempted`,
      event_type: 'submit_attempted',
    });

    const preTradeHistoryLength = wallet.getTradeHistory().length;

    try {
      await this.tradeExecutor.execute(routedOrder, wallet);
      this.inFlightOrders.set(orderKey, Date.now());
      recordExecutionSubmitLatency(Date.now() - submitStartedAt);
      recordExecutionRouteSuccess();
      this.database?.appendExecutionSubmission({
        submission_id: `${submissionId}:accepted`,
        intent_id: intentId,
        wallet_id: routedOrder.walletId,
        dedupe_key: `${submitDedupeBase}:submit_accepted`,
        status: 'submit_accepted',
      });
      this.database?.appendExecutionEvent({
        intent_id: intentId,
        submission_id: submissionId,
        exchange_event_id: `${submissionId}:submit_accepted`,
        event_type: 'submit_accepted',
      });

      const history = wallet.getTradeHistory();
      const latest = history.length > preTradeHistoryLength ? history[history.length - 1] : undefined;
      if (latest) {
        this.database?.appendExecutionFill({
          intent_id: intentId,
          submission_id: submissionId,
          exchange_order_id: latest.orderId,
          fill_id: latest.orderId,
          wallet_id: latest.walletId,
          market_id: latest.marketId,
          outcome: latest.outcome,
          side: latest.side,
          price: latest.price,
          size: latest.size,
          fill_ts: new Date(latest.timestamp).toISOString(),
        });

        // Determine lifecycle event type based on side and existing open size.
        if (this.database) {
          const openPositions = this.database.loadOpenLifecyclePositions(latest.walletId);
          const existing = openPositions.find(
            (p) => p.market_id === latest.marketId && p.outcome === latest.outcome,
          );
          const parentIntentId = this.database.loadActiveEntryIntentId(
            latest.walletId,
            latest.marketId,
            latest.outcome,
          );
          if (latest.side === 'BUY') {
            const lifecycleType = existing ? 'scale_in' : 'entry_open';
            this.database.appendPositionLifecycle({
              intent_id: intentId,
              parent_intent_id: lifecycleType === 'scale_in' ? parentIntentId : undefined,
              wallet_id: latest.walletId,
              market_id: latest.marketId,
              outcome: latest.outcome,
              event_type: lifecycleType,
              size: latest.size,
              price: latest.price,
              strategy_name: routedOrder.strategy,
              exchange_order_id: latest.orderId,
            });
          } else {
            // SELL: determine if position will be flat after this fill
            const existingSize = existing?.net_size ?? 0;
            const isFlat = latest.size >= existingSize - 0.0000001;
            this.database.appendPositionLifecycle({
              intent_id: intentId,
              parent_intent_id: parentIntentId,
              wallet_id: latest.walletId,
              market_id: latest.marketId,
              outcome: latest.outcome,
              event_type: isFlat ? 'flat' : 'partial_exit',
              size: latest.size,
              price: latest.price,
              exit_reason: routedOrder.exitReason,
              strategy_name: routedOrder.strategy,
              exchange_order_id: latest.orderId,
              notes: routedOrder.exitPolicyBranch,
            });
          }
        }
      }
      return true;
    } catch (error) {
      recordExecutionSubmitLatency(Date.now() - submitStartedAt);
      const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      const isTimeout = message.includes('timeout') || message.includes('timed out') || message.includes('abort');
      recordExecutionSubmitFailure(isTimeout);
      recordExecutionRouteFailure();
      this.database?.appendExecutionSubmission({
        submission_id: `${submissionId}:failed`,
        intent_id: intentId,
        wallet_id: routedOrder.walletId,
        dedupe_key: `${submitDedupeBase}:${isTimeout ? 'submit_timeout' : 'submit_failed'}`,
        status: isTimeout ? 'submit_timeout' : 'submit_failed',
        error_text: error instanceof Error ? error.message : String(error),
      });
      this.database?.appendExecutionEvent({
        intent_id: intentId,
        submission_id: submissionId,
        exchange_event_id: `${submissionId}:${isTimeout ? 'submit_timeout' : 'submit_failed'}`,
        event_type: isTimeout ? 'submit_timeout' : 'submit_failed',
        status_text: error instanceof Error ? error.message : String(error),
        details: {
          walletId: routedOrder.walletId,
          marketId: routedOrder.marketId,
          side: routedOrder.side,
          outcome: routedOrder.outcome,
        },
      });
      throw error;
    } finally {
      recordExecutionRouteLatency(Date.now() - routeStartedAt);
    }
  }

  private cleanupRiskLogState(now: number): void {
    if (now - this.lastRiskLogCleanupAt < this.riskLogCleanupIntervalMs) return;
    this.lastRiskLogCleanupAt = now;

    for (const [key, value] of this.riskLogState.entries()) {
      if (now - value.lastLoggedAt > this.riskLogRetentionMs) {
        this.riskLogState.delete(key);
      }
    }

    // Clean up expired in-flight order records
    for (const [key, submittedAt] of this.inFlightOrders.entries()) {
      if (now - submittedAt > this.inFlightWindowMs * 2) {
        this.inFlightOrders.delete(key);
      }
    }

    if (this.riskLogState.size <= this.maxRiskLogKeys) return;

    const entriesByAge = Array.from(this.riskLogState.entries())
      .sort((a, b) => a[1].lastLoggedAt - b[1].lastLoggedAt);
    const toDelete = this.riskLogState.size - this.maxRiskLogKeys;
    for (let i = 0; i < toDelete; i += 1) {
      const entry = entriesByAge[i];
      if (!entry) break;
      this.riskLogState.delete(entry[0]);
    }
  }
}
