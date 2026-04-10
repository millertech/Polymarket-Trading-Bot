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

  constructor(
    private readonly walletManager: WalletManager,
    private readonly riskEngine: RiskEngine,
    private readonly tradeExecutor: TradeExecutor,
  ) {}

  async route(order: OrderRequest): Promise<boolean> {
    this.cleanupRiskLogState(Date.now());

    const routeStartedAt = Date.now();
    recordExecutionRouteAttempt();

    const wallet = this.walletManager.getWallet(order.walletId);
    if (!wallet) {
      logger.warn({ walletId: order.walletId }, 'Wallet not found');
      consoleLog.warn('ORDER', `Wallet ${order.walletId} not found — order dropped`, {
        walletId: order.walletId,
        marketId: order.marketId,
      });
      recordExecutionRouteFailure();
      recordExecutionRouteLatency(Date.now() - routeStartedAt);
      return false;
    }

    const state = wallet.getState();
    const risk = this.riskEngine.check(order, state);
    if (!risk.ok) {
      recordOrderRouterRiskRejection();
      const reason = risk.reason ?? 'Unknown risk rejection';
      const dedupeKey = `${order.walletId}:${reason}`;
      const now = Date.now();
      const dedupe = this.riskLogState.get(dedupeKey);

      if (!dedupe || now - dedupe.lastLoggedAt >= this.riskLogWindowMs) {
        const suppressedInWindow = dedupe?.suppressed ?? 0;
        logger.warn(
          { walletId: order.walletId, reason, suppressedInWindow },
          'Risk check failed',
        );
        consoleLog.warn('RISK', `Risk rejected: ${reason} [${order.walletId}] ${order.side} ${order.outcome} ×${order.size}`, {
          walletId: order.walletId,
          marketId: order.marketId,
          reason,
          side: order.side,
          outcome: order.outcome,
          price: order.price,
          size: order.size,
          suppressedInWindow,
        });
        this.riskLogState.set(dedupeKey, { lastLoggedAt: now, suppressed: 0 });
      } else {
        dedupe.suppressed += 1;
        recordOrderRouterRiskSuppressed();
      }

      recordExecutionRouteFailure();
      recordExecutionRouteLatency(Date.now() - routeStartedAt);
      return false;
    }

    /* ── Portfolio-level per-market exposure check (cross-wallet) ── */
    if (this.maxPortfolioExposurePerMarket > 0 && order.side === 'BUY') {
      const portfolioExposure = this.walletManager.getTotalMarketExposure(order.marketId);
      const orderCost = order.price * order.size;
      if (portfolioExposure + orderCost > this.maxPortfolioExposurePerMarket) {
        const portfolioReason = `Portfolio market exposure $${(portfolioExposure + orderCost).toFixed(2)} exceeds limit $${this.maxPortfolioExposurePerMarket}`;
        const dedupeKey = `portfolio:${order.marketId}:${portfolioReason}`;
        const now2 = Date.now();
        const dedupe2 = this.riskLogState.get(dedupeKey);
        if (!dedupe2 || now2 - dedupe2.lastLoggedAt >= this.riskLogWindowMs) {
          consoleLog.warn('RISK', `Portfolio risk rejected: ${portfolioReason}`, {
            marketId: order.marketId,
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
        return false;
      }
    }

    /* ── In-flight deduplication ────────────────────────────────── */
    const orderKey = `${order.walletId}:${order.marketId}:${order.outcome}:${order.side}`;
    const lastSubmittedAt = this.inFlightOrders.get(orderKey) ?? 0;
    const now3 = Date.now();
    if (now3 - lastSubmittedAt < this.inFlightWindowMs) {
      const suppressMsg = `Duplicate in-flight order suppressed: ${order.side} ${order.outcome} on ${order.marketId} [${order.walletId}]`;
      const dedupeKey3 = `inflight:${orderKey}`;
      const dedupe3 = this.riskLogState.get(dedupeKey3);
      if (!dedupe3 || now3 - dedupe3.lastLoggedAt >= this.riskLogWindowMs) {
        consoleLog.warn('RISK', suppressMsg, { walletId: order.walletId, marketId: order.marketId });
        this.riskLogState.set(dedupeKey3, { lastLoggedAt: now3, suppressed: 0 });
      } else {
        dedupe3.suppressed += 1;
        recordOrderRouterRiskSuppressed();
      }
      recordOrderRouterRiskRejection();
      recordExecutionRouteFailure();
      recordExecutionRouteLatency(now3 - routeStartedAt);
      return false;
    }

    const submitStartedAt = Date.now();
    recordExecutionSubmitAttempt();

    try {
      await this.tradeExecutor.execute(order, wallet);
      this.inFlightOrders.set(orderKey, Date.now());
      recordExecutionSubmitLatency(Date.now() - submitStartedAt);
      recordExecutionRouteSuccess();
      return true;
    } catch (error) {
      recordExecutionSubmitLatency(Date.now() - submitStartedAt);
      const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      const isTimeout = message.includes('timeout') || message.includes('timed out') || message.includes('abort');
      recordExecutionSubmitFailure(isTimeout);
      recordExecutionRouteFailure();
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
