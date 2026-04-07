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

    const submitStartedAt = Date.now();
    recordExecutionSubmitAttempt();

    try {
      await this.tradeExecutor.execute(order, wallet);
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
