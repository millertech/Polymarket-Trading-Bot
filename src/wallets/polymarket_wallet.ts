import { WalletConfig, WalletState, Position, TradeRecord, RiskLimits } from '../types';
import { logger } from '../reporting/logs';
import { consoleLog } from '../reporting/console_log';

type LivePreflightResult = {
  ok: boolean;
  reason?: string;
  details?: Record<string, unknown>;
};

export class PolymarketWallet {
  private static readonly MAX_TRADE_HISTORY = 10_000;
  private state: WalletState;
  private readonly trades: TradeRecord[] = [];
  private readonly clobApi: string;
  private displayName: string = '';
  private liveDisabledReason: string | null = null;

  constructor(config: WalletConfig, assignedStrategy: string) {
    this.displayName = config.id;
    this.clobApi = process.env.POLYMARKET_CLOB_API ?? 'https://clob.polymarket.com';
    this.state = {
      walletId: config.id,
      mode: 'LIVE',
      assignedStrategy,
      capitalAllocated: config.capital,
      availableBalance: config.capital,
      openPositions: [],
      realizedPnl: 0,
      riskLimits: {
        maxPositionSize: config.riskLimits?.maxPositionSize ?? 100,
        maxExposurePerMarket: config.riskLimits?.maxExposurePerMarket ?? 200,
        maxDailyLoss: config.riskLimits?.maxDailyLoss ?? 100,
        maxOpenTrades: config.riskLimits?.maxOpenTrades ?? 5,
        maxDrawdown: config.riskLimits?.maxDrawdown ?? 0.2,
      },
    };
  }

  getState(): WalletState {
    return { ...this.state, openPositions: [...this.state.openPositions] };
  }

  getTradeHistory(): TradeRecord[] {
    return [...this.trades];
  }

  updateBalance(delta: number): void {
    this.state.availableBalance += delta;
  }

  getDisplayName(): string {
    return this.displayName;
  }

  setDisplayName(name: string): void {
    this.displayName = name.trim() || this.state.walletId;
  }

  updateRiskLimits(limits: Partial<RiskLimits>): void {
    if (limits.maxPositionSize !== undefined) this.state.riskLimits.maxPositionSize = limits.maxPositionSize;
    if (limits.maxExposurePerMarket !== undefined) this.state.riskLimits.maxExposurePerMarket = limits.maxExposurePerMarket;
    if (limits.maxDailyLoss !== undefined) this.state.riskLimits.maxDailyLoss = limits.maxDailyLoss;
    if (limits.maxOpenTrades !== undefined) this.state.riskLimits.maxOpenTrades = limits.maxOpenTrades;
    if (limits.maxDrawdown !== undefined) this.state.riskLimits.maxDrawdown = limits.maxDrawdown;
    logger.info({ walletId: this.state.walletId, riskLimits: this.state.riskLimits }, 'Risk limits updated');
  }

  async preflightLiveAccess(): Promise<LivePreflightResult> {
    const apiKey = process.env.POLYMARKET_API_KEY;
    if (!apiKey) {
      const reason = 'POLYMARKET_API_KEY not set';
      this.switchToPaperFallback(reason);
      return { ok: false, reason };
    }

    const clobReachability = await this.safeFetch(`${this.clobApi}/`, { method: 'GET' });
    if (!clobReachability.ok) {
      const reason = `CLOB preflight failed (${clobReachability.error ?? 'unknown'})`;
      this.switchToPaperFallback(reason);
      return { ok: false, reason, details: { clobReachability } };
    }

    const probePayload = {
      market: '0x0',
      side: 'BUY',
      outcome: 'YES',
      price: 0.5,
      size: 0,
      type: 'limit',
    };

    const probe = await this.safeFetch(`${this.clobApi}/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(probePayload),
    });

    if (!probe.ok && probe.status === 403 && this.isTradingRestrictedError(probe.body ?? '')) {
      const reason = `LIVE preflight blocked by trading restriction (HTTP 403): ${probe.body ?? ''}`;
      this.switchToPaperFallback(reason);
      return {
        ok: false,
        reason,
        details: {
          status: probe.status,
          headers: probe.headers,
        },
      };
    }

    logger.info({ walletId: this.state.walletId, probeStatus: probe.status ?? null }, 'LIVE preflight passed');
    return {
      ok: true,
      details: {
        probeStatus: probe.status ?? null,
      },
    };
  }

  async placeOrder(request: {
    marketId: string;
    outcome: 'YES' | 'NO';
    side: 'BUY' | 'SELL';
    price: number;
    size: number;
  }): Promise<void> {
    if (this.state.mode === 'PAPER') {
      this.placePaperFallbackOrder(request, this.liveDisabledReason ?? 'LIVE wallet running in PAPER fallback mode');
      return;
    }

    const apiKey = process.env.POLYMARKET_API_KEY;
    if (!apiKey) {
      const msg = 'POLYMARKET_API_KEY not set — cannot place LIVE order. Set it in your .env file.';
      logger.error({ walletId: this.state.walletId }, msg);
      consoleLog.error('ORDER', `[${this.state.walletId}] ${msg}`);
      throw new Error(msg);
    }

    const orderId = `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cost = request.price * request.size;

    logger.info(
      {
        walletId: this.state.walletId,
        orderId,
        marketId: request.marketId,
        outcome: request.outcome,
        side: request.side,
        price: request.price,
        size: request.size,
        cost,
      },
      `LIVE order submitting ${request.side} ${request.outcome} market=${request.marketId} price=${request.price} size=${request.size}`,
    );

    /* ── Submit order to Polymarket CLOB API ── */
    const orderPayload = {
      market: request.marketId,
      side: request.side,
      outcome: request.outcome,
      price: request.price,
      size: request.size,
      type: 'limit',
    };

    let apiResponse: Response;
    try {
      apiResponse = await fetch(`${this.clobApi}/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(orderPayload),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ walletId: this.state.walletId, orderId, error: msg }, 'LIVE order network error');
      consoleLog.error('ORDER', `[${this.state.walletId}] Order failed (network): ${msg}`);
      throw new Error(`LIVE order network error: ${msg}`);
    }

    if (!apiResponse.ok) {
      let errorBody = '';
      try { errorBody = await apiResponse.text(); } catch { /* ignore */ }
      const headerDiag = this.pickDiagnosticHeaders(apiResponse);
      const msg = `LIVE order rejected by Polymarket (HTTP ${apiResponse.status}): ${errorBody}`;
      logger.error({
        walletId: this.state.walletId,
        orderId,
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        body: errorBody,
        url: `${this.clobApi}/order`,
        headers: headerDiag,
      }, msg);
      consoleLog.error('ORDER', `[${this.state.walletId}] ${msg}`);

      if (apiResponse.status === 403 && this.isTradingRestrictedError(errorBody)) {
        this.switchToPaperFallback(`Trading restricted (HTTP 403): ${errorBody}`);
        this.placePaperFallbackOrder(request, 'Falling back after LIVE trading restriction');
        return;
      }

      throw new Error(msg);
    }

    /* ── Order accepted — update local state ── */
    const entryPrice = this.getExistingEntryPrice(request.marketId, request.outcome);
    this.applyFill({
      marketId: request.marketId,
      outcome: request.outcome,
      side: request.side,
      price: request.price,
      size: request.size,
    });

    const realizedPnl = request.side === 'SELL' && entryPrice > 0
      ? (request.price - entryPrice) * request.size
      : 0;
    this.state.realizedPnl += realizedPnl;

    const signedCost = cost * (request.side === 'BUY' ? 1 : -1);
    this.state.availableBalance -= signedCost;

    this.trades.push({
      orderId,
      walletId: this.state.walletId,
      marketId: request.marketId,
      outcome: request.outcome,
      side: request.side,
      price: request.price,
      size: request.size,
      cost,
      realizedPnl,
      cumulativePnl: this.state.realizedPnl,
      balanceAfter: this.state.availableBalance,
      timestamp: Date.now(),
    });

    if (this.trades.length > PolymarketWallet.MAX_TRADE_HISTORY) {
      this.trades.splice(0, this.trades.length - PolymarketWallet.MAX_TRADE_HISTORY);
    }

    logger.info(
      {
        walletId: this.state.walletId,
        orderId,
        marketId: request.marketId,
        side: request.side,
        outcome: request.outcome,
        price: request.price,
        size: request.size,
        realizedPnl,
        balance: this.state.availableBalance,
      },
      `LIVE order FILLED ${request.side} ${request.outcome} market=${request.marketId} price=${request.price} size=${request.size}`,
    );

    consoleLog.success('ORDER', `[${this.state.walletId}] ${request.side} ${request.outcome} ×${request.size} @ $${request.price} → PnL $${realizedPnl.toFixed(2)} | Bal $${this.state.availableBalance.toFixed(2)}`, {
      walletId: this.state.walletId,
      strategy: this.state.assignedStrategy,
      orderId,
      marketId: request.marketId,
      outcome: request.outcome,
      side: request.side,
      price: request.price,
      size: request.size,
      realizedPnl: Number(realizedPnl.toFixed(4)),
      cumulativePnl: Number(this.state.realizedPnl.toFixed(4)),
      balanceAfter: Number(this.state.availableBalance.toFixed(2)),
    });
  }

  private getExistingEntryPrice(marketId: string, outcome: 'YES' | 'NO'): number {
    const pos = this.state.openPositions.find(
      (p) => p.marketId === marketId && p.outcome === outcome,
    );
    return pos ? pos.avgPrice : 0;
  }

  private applyFill(fill: {
    marketId: string;
    outcome: 'YES' | 'NO';
    side: 'BUY' | 'SELL';
    price: number;
    size: number;
  }): void {
    const existing = this.state.openPositions.find(
      (pos) => pos.marketId === fill.marketId && pos.outcome === fill.outcome,
    );

    if (!existing) {
      if (fill.side === 'BUY') {
        this.state.openPositions.push({
          marketId: fill.marketId,
          outcome: fill.outcome,
          size: fill.size,
          avgPrice: fill.price,
          realizedPnl: 0,
        });
      }
      return;
    }

    if (fill.side === 'BUY') {
      const newSize = existing.size + fill.size;
      existing.avgPrice =
        (existing.avgPrice * existing.size + fill.price * fill.size) / newSize;
      existing.size = newSize;
    } else {
      existing.size -= Math.min(fill.size, existing.size);
      if (existing.size <= 0) {
        existing.size = 0;
        existing.avgPrice = 0;
      }
    }

    this.state.openPositions = this.state.openPositions.filter((p) => p.size > 0);
  }

  private placePaperFallbackOrder(
    request: {
      marketId: string;
      outcome: 'YES' | 'NO';
      side: 'BUY' | 'SELL';
      price: number;
      size: number;
    },
    reason: string,
  ): void {
    const orderId = `paper-fallback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cost = request.price * request.size;
    const entryPrice = this.getExistingEntryPrice(request.marketId, request.outcome);

    this.applyFill({
      marketId: request.marketId,
      outcome: request.outcome,
      side: request.side,
      price: request.price,
      size: request.size,
    });

    const realizedPnl = request.side === 'SELL' && entryPrice > 0
      ? (request.price - entryPrice) * request.size
      : 0;
    this.state.realizedPnl += realizedPnl;
    const signedCost = cost * (request.side === 'BUY' ? 1 : -1);
    this.state.availableBalance -= signedCost;

    this.trades.push({
      orderId,
      walletId: this.state.walletId,
      marketId: request.marketId,
      outcome: request.outcome,
      side: request.side,
      price: request.price,
      size: request.size,
      cost,
      realizedPnl,
      cumulativePnl: this.state.realizedPnl,
      balanceAfter: this.state.availableBalance,
      timestamp: Date.now(),
    });
    if (this.trades.length > PolymarketWallet.MAX_TRADE_HISTORY) {
      this.trades.splice(0, this.trades.length - PolymarketWallet.MAX_TRADE_HISTORY);
    }

    consoleLog.warn(
      'ORDER',
      `[${this.state.walletId}] Executed in PAPER fallback (${reason}) ${request.side} ${request.outcome} ×${request.size} @ $${request.price}`,
      {
        walletId: this.state.walletId,
        strategy: this.state.assignedStrategy,
        mode: this.state.mode,
        reason,
        marketId: request.marketId,
        outcome: request.outcome,
        side: request.side,
        price: request.price,
        size: request.size,
      },
    );
  }

  private switchToPaperFallback(reason: string): void {
    if (this.state.mode === 'PAPER') return;
    this.state.mode = 'PAPER';
    this.liveDisabledReason = reason;
    logger.warn({ walletId: this.state.walletId, reason }, 'LIVE wallet switched to PAPER fallback');
    consoleLog.warn('ORDER', `[${this.state.walletId}] LIVE disabled; switched to PAPER fallback. Reason: ${reason}`, {
      walletId: this.state.walletId,
      strategy: this.state.assignedStrategy,
      reason,
    });
  }

  private isTradingRestrictedError(body: string): boolean {
    const text = body.toLowerCase();
    return text.includes('trading restricted') || text.includes('geoblock') || text.includes('blocked in your region');
  }

  private pickDiagnosticHeaders(response: Response): Record<string, string> {
    const keys = [
      'x-request-id',
      'cf-ray',
      'cf-cache-status',
      'server',
      'date',
      'x-envoy-upstream-service-time',
    ];
    const out: Record<string, string> = {};
    for (const k of keys) {
      const v = response.headers.get(k);
      if (v) out[k] = v;
    }
    return out;
  }

  private async safeFetch(
    url: string,
    init: RequestInit,
  ): Promise<{ ok: boolean; status?: number; body?: string; headers?: Record<string, string>; error?: string }> {
    try {
      const response = await fetch(url, init);
      let body = '';
      try { body = await response.text(); } catch { /* ignore */ }
      return {
        ok: response.ok,
        status: response.status,
        body,
        headers: this.pickDiagnosticHeaders(response),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
