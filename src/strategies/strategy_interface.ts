import { MarketData, OrderRequest, Signal, WalletState, type OrderExitReason } from '../types';

export interface StrategyContext {
  wallet: WalletState;
  config: Record<string, unknown>;
}

export interface StrategyInterface {
  readonly name: string;
  initialize(context: StrategyContext): Promise<void> | void;
  onMarketUpdate(data: MarketData): Promise<void> | void;
  onTimer(): Promise<void> | void;
  generateSignals(): Promise<Signal[]> | Signal[];
  sizePositions(signals: Signal[]): Promise<OrderRequest[]> | OrderRequest[];
  submitOrders(orders: OrderRequest[]): Promise<void> | void;
  notifyFill(order: OrderRequest): void;
  managePositions(): Promise<void> | void;
  drainExitOrders(): OrderRequest[];
  shutdown(): Promise<void> | void;
}

export abstract class BaseStrategy implements StrategyInterface {
  abstract readonly name: string;
  protected context?: StrategyContext;

  /** Live market cache populated by onMarketUpdate() */
  protected markets = new Map<string, MarketData>();

  /**
   * Exit orders queued by managePositions() — the engine drains and
   * routes these through the wallet after each tick.
   */
  protected pendingExits: OrderRequest[] = [];

  /**
   * Per-market cooldown: prevents trading the same market more than once
   * within a cooldown window (default 60 seconds).
   */
  private tradeCooldowns = new Map<string, number>();
  protected cooldownMs = 60_000;

  initialize(context: StrategyContext): void {
    this.context = context;
  }

  onMarketUpdate(data: MarketData): void {
    this.markets.set(data.marketId, data);
  }

  onTimer(): void {
    return;
  }

  abstract generateSignals(): Signal[];

  /** Filter signals through cooldown, then size them */
  sizePositions(signals: Signal[]): OrderRequest[] {
    const now = Date.now();
    const walletId = this.context?.wallet.walletId ?? 'unknown';

    // Filter out signals for markets still in cooldown
    const filtered = signals.filter((s) => {
      const key = `${s.marketId}:${s.outcome}:${s.side}`;
      const lastTrade = this.tradeCooldowns.get(key) ?? 0;
      return now - lastTrade > this.cooldownMs;
    });

    return filtered.map((signal) => {
      const key = `${signal.marketId}:${signal.outcome}:${signal.side}`;

      // Use actual market price when available, fall back to 0.5 + edge
      const market = this.markets.get(signal.marketId);
      const tokenId = market
        ? (signal.outcome === 'YES' ? market.clobTokenIds[0] : (market.clobTokenIds[1] ?? market.clobTokenIds[0]))
        : undefined;
      let price: number;
      if (market) {
        price = signal.outcome === 'YES'
          ? market.outcomePrices[0]
          : (market.outcomePrices[1] ?? 1 - market.outcomePrices[0]);
      } else {
        price = Number((0.5 + signal.edge).toFixed(4));
      }

      return {
        walletId,
        marketId: signal.marketId,
        tokenId,
        outcome: signal.outcome,
        side: signal.side,
        price: Number(Math.max(0.01, Math.min(0.99, price)).toFixed(4)),
        size: Math.max(1, Math.floor(10 * signal.confidence)),
        strategy: this.name,
      };
    });
  }

  submitOrders(_orders: OrderRequest[]): void {
    return;
  }

  /**
   * Called by the engine after a successful fill.
   * Override in subclasses to track positions.
   */
  notifyFill(order: OrderRequest): void {
    // Record cooldown only after a successful fill, not at sizing time
    const key = `${order.marketId}:${order.outcome}:${order.side}`;
    this.tradeCooldowns.set(key, Date.now());
  }

  managePositions(): void {
    return;
  }

  /** Return and clear any exit orders queued during managePositions() */
  drainExitOrders(): OrderRequest[] {
    const exits = this.pendingExits;
    this.pendingExits = [];
    return exits;
  }

  protected queueExitOrder(input: {
    marketId: string;
    outcome: 'YES' | 'NO';
    side: 'BUY' | 'SELL';
    price: number;
    size: number;
    rawReason: string;
  }): void {
    const walletId = this.context?.wallet.walletId ?? 'unknown';
    const mapped = this.standardizeExitReason(input.rawReason);
    this.pendingExits.push({
      walletId,
      marketId: input.marketId,
      outcome: input.outcome,
      side: input.side,
      price: input.price,
      size: input.size,
      strategy: this.name,
      exitReason: mapped.exitReason,
      exitPolicyBranch: mapped.exitPolicyBranch,
    });
  }

  protected standardizeExitReason(rawReason: string): { exitReason: OrderExitReason; exitPolicyBranch: string } {
    const normalized = rawReason.trim().toUpperCase();
    if (normalized.includes('KILL')) {
      return { exitReason: 'kill_switch', exitPolicyBranch: rawReason };
    }
    if (normalized.includes('DRAWDOWN')) {
      return { exitReason: 'drawdown_breaker', exitPolicyBranch: rawReason };
    }
    if (normalized.includes('TP') || normalized.includes('TAKE_PROFIT') || normalized.includes('TRAIL')) {
      return { exitReason: 'take_profit', exitPolicyBranch: rawReason };
    }
    if (normalized.includes('SL') || normalized.includes('STOP_LOSS') || normalized.includes('ADVERSE')) {
      return { exitReason: 'stop_loss', exitPolicyBranch: rawReason };
    }
    if (normalized.includes('TIME') || normalized.includes('MAX_HOLD')) {
      return { exitReason: 'max_hold', exitPolicyBranch: rawReason };
    }
    if (normalized.includes('MANUAL')) {
      return { exitReason: 'manual', exitPolicyBranch: rawReason };
    }
    return { exitReason: 'stale_market', exitPolicyBranch: rawReason };
  }

  shutdown(): void {
    return;
  }
}
