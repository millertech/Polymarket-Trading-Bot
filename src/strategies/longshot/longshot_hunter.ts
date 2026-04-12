import { BaseStrategy, StrategyContext } from '../strategy_interface';
import { LongshotConfig, MarketData, OrderRequest, Signal } from '../../types';
import { logger } from '../../reporting/logs';

interface ManagedLongshotPosition {
  marketId: string;
  outcome: 'YES' | 'NO';
  side: 'BUY' | 'SELL';
  entryPrice: number;
  entryTime: number;
  size: number;
}

interface VolumeSnapshot {
  volume24h: number;
  timestamp: number;
}

type RejectReason =
  | 'invalid_price'
  | 'price_band'
  | 'liquidity'
  | 'volume24h'
  | 'resolution_window'
  | 'momentum'
  | 'volume_spike'
  | 'buy_imbalance'
  | 'score'
  | 'edge';

interface EvalResult {
  setup?: { score: number; edge: number };
  reason?: RejectReason;
}

interface ScanGateStats {
  totalMarkets: number;
  rejected: Record<RejectReason, number>;
}

interface DailyPerfStats {
  entryFills: number;
  exitFills: number;
  wins: number;
  losses: number;
  breakeven: number;
  realizedPnlUsd: number;
  grossWinUsd: number;
  grossLossUsd: number;
  entryNotionalUsd: number;
  exitNotionalUsd: number;
  peakRealizedUsd: number;
  maxDrawdownUsd: number;
}

export interface LongshotDailyPerformanceSnapshot {
  periodStart: string;
  periodEnd: string;
  openPositions: number;
  entryFills: number;
  exitFills: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  realizedPnlUsd: number;
  expectancyUsdPerExit: number;
  profitFactor: number | 'Infinity';
  entryNotionalUsd: number;
  exitNotionalUsd: number;
  maxDrawdownUsd: number;
}

const DEFAULTS: LongshotConfig = {
  enabled: true,
  min_entry_price: 0.01,
  max_entry_price: 0.05,
  max_hours_to_resolution: 120,
  min_liquidity_usd: 300,
  min_volume_24h_usd: 100,
  min_price_momentum_pct: 0,
  volume_spike_multiplier: 1.0,
  min_buy_imbalance: 0.15,
  min_signal_score: 0.45,
  max_position_usd: 15,
  max_total_positions: 40,
  max_total_exposure_usd: 400,
  stop_loss_pct: 0.50,
  take_profit_price: 0.50,
  hold_to_resolution: true,
  use_whale_signals: false,
};

export class LongshotHunterStrategy extends BaseStrategy {
  readonly name = 'longshot_hunter';

  private cfg: LongshotConfig = { ...DEFAULTS };
  private positions: ManagedLongshotPosition[] = [];
  private volumeHistory = new Map<string, VolumeSnapshot[]>();
  private scanCounter = 0;
  private dayStartMs = Date.now();
  private nextDailySummaryMs = this.nextUtcMidnightMs(Date.now());
  private dailyPerf: DailyPerfStats = this.emptyDailyPerf();

  protected override cooldownMs = 120_000;

  override initialize(context: StrategyContext): void {
    super.initialize(context);
    const raw = context.config as Partial<LongshotConfig>;
    this.cfg = { ...DEFAULTS, ...raw };
    const now = Date.now();
    this.dayStartMs = now;
    this.nextDailySummaryMs = this.nextUtcMidnightMs(now);
    this.dailyPerf = this.emptyDailyPerf();

    logger.info({ strategy: this.name, config: this.cfg }, 'Longshot hunter initialised');
  }

  override onMarketUpdate(data: MarketData): void {
    super.onMarketUpdate(data);

    const history = this.volumeHistory.get(data.marketId) ?? [];
    history.push({ volume24h: data.volume24h, timestamp: data.timestamp });
    if (history.length > 96) history.shift();
    this.volumeHistory.set(data.marketId, history);
  }

  override generateSignals(): Signal[] {
    this.maybeRotateDailySummary(Date.now());

    if (!this.cfg.enabled) return [];
    if (this.positions.length >= this.cfg.max_total_positions) return [];

    const signals: Signal[] = [];
    const stats: ScanGateStats = {
      totalMarkets: this.markets.size,
      rejected: {
        invalid_price: 0,
        price_band: 0,
        liquidity: 0,
        volume24h: 0,
        resolution_window: 0,
        momentum: 0,
        volume_spike: 0,
        buy_imbalance: 0,
        score: 0,
        edge: 0,
      },
    };
    this.scanCounter += 1;

    for (const [marketId, market] of this.markets) {
      const evalResult = this.evaluateMarket(marketId, market);
      if (!evalResult.setup) {
        if (evalResult.reason) stats.rejected[evalResult.reason] += 1;
        continue;
      }

      signals.push({
        marketId,
        outcome: 'YES',
        side: 'BUY',
        confidence: evalResult.setup.score,
        edge: evalResult.setup.edge,
      });
    }

    signals.sort((a, b) => b.confidence - a.confidence);
    const slots = Math.max(0, this.cfg.max_total_positions - this.positions.length);
    const selected = signals.slice(0, slots);

    // Emit gate telemetry periodically and whenever at least one candidate survives.
    if (selected.length > 0 || this.scanCounter % 10 === 0) {
      logger.info(
        {
          strategy: this.name,
          scan: this.scanCounter,
          totalMarkets: stats.totalMarkets,
          survivorsPreSlot: signals.length,
          selectedSignals: selected.length,
          slots,
          rejected: stats.rejected,
        },
        'Longshot scan gate counts',
      );
    }

    return selected;
  }

  override sizePositions(signals: Signal[]): OrderRequest[] {
    const baseOrders = super.sizePositions(signals);

    const totalExposure = this.positions.reduce((sum, p) => sum + p.entryPrice * p.size, 0);
    let exposureLeft = Math.max(0, this.cfg.max_total_exposure_usd - totalExposure);

    if (exposureLeft <= 0) return [];

    const orders: OrderRequest[] = [];

    for (const order of baseOrders) {
      if (exposureLeft <= 0) break;
      const market = this.markets.get(order.marketId);
      if (!market) continue;

      const yesPrice = market.outcomePrices[0] ?? order.price;
      const maxUsd = Math.min(this.cfg.max_position_usd, exposureLeft);
      const size = Math.max(1, Math.floor(maxUsd / Math.max(yesPrice, 0.01)));
      const notional = yesPrice * size;
      if (notional <= 0) continue;

      orders.push({
        ...order,
        price: Number(Math.max(0.01, Math.min(0.99, yesPrice)).toFixed(4)),
        size,
      });

      exposureLeft -= notional;
    }

    return orders;
  }

  override notifyFill(order: OrderRequest): void {
    super.notifyFill(order);
    if (order.strategy !== this.name) return;

    this.maybeRotateDailySummary(Date.now());

    if (order.side === 'BUY') {
      this.dailyPerf.entryFills += 1;
      this.dailyPerf.entryNotionalUsd += order.price * order.size;
      this.positions.push({
        marketId: order.marketId,
        outcome: order.outcome,
        side: order.side,
        entryPrice: order.price,
        entryTime: Date.now(),
        size: order.size,
      });
      return;
    }

    // On SELL fills, compute realized PnL against tracked entries (FIFO by array order).
    let remaining = order.size;
    let realizedUsd = 0;
    let matchedSize = 0;

    for (const pos of this.positions) {
      if (remaining <= 0) break;
      if (pos.marketId !== order.marketId || pos.outcome !== order.outcome) continue;
      if (pos.size <= 0) continue;

      const qty = Math.min(pos.size, remaining);
      realizedUsd += (order.price - pos.entryPrice) * qty;
      matchedSize += qty;
      pos.size -= qty;
      remaining -= qty;
    }

    this.positions = this.positions.filter((p) => p.size > 0);

    if (matchedSize > 0) {
      this.dailyPerf.exitFills += 1;
      this.dailyPerf.exitNotionalUsd += order.price * matchedSize;
      this.dailyPerf.realizedPnlUsd += realizedUsd;
      if (realizedUsd > 0) {
        this.dailyPerf.wins += 1;
        this.dailyPerf.grossWinUsd += realizedUsd;
      } else if (realizedUsd < 0) {
        this.dailyPerf.losses += 1;
        this.dailyPerf.grossLossUsd += realizedUsd;
      } else {
        this.dailyPerf.breakeven += 1;
      }

      this.dailyPerf.peakRealizedUsd = Math.max(this.dailyPerf.peakRealizedUsd, this.dailyPerf.realizedPnlUsd);
      const drawdown = this.dailyPerf.peakRealizedUsd - this.dailyPerf.realizedPnlUsd;
      this.dailyPerf.maxDrawdownUsd = Math.max(this.dailyPerf.maxDrawdownUsd, drawdown);
    }
  }

  override managePositions(): void {
    for (const pos of this.positions) {
      const market = this.markets.get(pos.marketId);
      if (!market) continue;

      const currentYes = market.outcomePrices[0] ?? pos.entryPrice;
      const stopPrice = pos.entryPrice * (1 - this.cfg.stop_loss_pct);

      if (currentYes <= stopPrice) {
        this.queueExit(pos, currentYes, 'STOP_LOSS');
        continue;
      }

      if (!this.cfg.hold_to_resolution && currentYes >= this.cfg.take_profit_price) {
        this.queueExit(pos, currentYes, 'TAKE_PROFIT');
        continue;
      }

      if (this.cfg.hold_to_resolution && this.isMarketExpired(market)) {
        this.queueExit(pos, currentYes, 'RESOLUTION_WINDOW_REACHED');
      }
    }
  }

  private evaluateMarket(marketId: string, market: MarketData): EvalResult {
    const yesPrice = market.outcomePrices[0];
    if (!Number.isFinite(yesPrice)) return { reason: 'invalid_price' };

    if (yesPrice < this.cfg.min_entry_price || yesPrice > this.cfg.max_entry_price) return { reason: 'price_band' };
    if (market.liquidity < this.cfg.min_liquidity_usd) return { reason: 'liquidity' };
    if (market.volume24h < this.cfg.min_volume_24h_usd) return { reason: 'volume24h' };

    const hoursToResolution = this.hoursToResolution(market);
    if (hoursToResolution === null || hoursToResolution <= 0 || hoursToResolution > this.cfg.max_hours_to_resolution) {
      return { reason: 'resolution_window' };
    }

    const momentumPct = Math.max(
      this.normalizedPercent(market.oneDayPriceChange ?? 0),
      this.normalizedPercent(market.oneWeekPriceChange ?? 0),
    );
    if (this.cfg.min_price_momentum_pct > 0 && momentumPct < this.cfg.min_price_momentum_pct) {
      return { reason: 'momentum' };
    }

    const volumeSpike = this.computeVolumeSpike(marketId, market.volume24h);
    if (volumeSpike < this.cfg.volume_spike_multiplier) return { reason: 'volume_spike' };

    const buyImbalance = this.computeBuyImbalance(market);
    if (buyImbalance < this.cfg.min_buy_imbalance) return { reason: 'buy_imbalance' };

    const score = this.computeScore(hoursToResolution, momentumPct, volumeSpike, buyImbalance);
    if (score < this.cfg.min_signal_score) return { reason: 'score' };

    const estimatedWinProb = Math.min(0.99, Math.max(yesPrice + 0.05, score));
    const edge = estimatedWinProb - yesPrice;
    if (edge <= 0) return { reason: 'edge' };

    return { setup: { score, edge } };
  }

  private hoursToResolution(market: MarketData): number | null {
    if (!market.endDate) return null;
    const resolutionTs = Date.parse(market.endDate);
    if (!Number.isFinite(resolutionTs)) return null;
    return (resolutionTs - Date.now()) / 3_600_000;
  }

  private normalizedPercent(value: number): number {
    const abs = Math.abs(value);
    if (abs <= 1) return value * 100;
    return value;
  }

  private computeVolumeSpike(marketId: string, currentVolume: number): number {
    const history = this.volumeHistory.get(marketId) ?? [];
    const prior = history.slice(0, -1);
    if (prior.length < 3) return this.cfg.volume_spike_multiplier;

    const avg = prior.reduce((sum, point) => sum + point.volume24h, 0) / prior.length;
    if (avg <= 0) return this.cfg.volume_spike_multiplier;
    return currentVolume / avg;
  }

  private computeBuyImbalance(market: MarketData): number {
    const spread = Math.max(market.ask - market.bid, 0.0001);
    const relativeSpread = spread / Math.max(market.midPrice, 0.01);
    return Math.max(0, 1 - relativeSpread);
  }

  private computeScore(hoursToResolution: number, momentumPct: number, volumeSpike: number, imbalance: number): number {
    const timeScore = 1 - Math.min(1, Math.max(0, hoursToResolution / this.cfg.max_hours_to_resolution));
    const momentumDenom = this.cfg.min_price_momentum_pct > 0
      ? this.cfg.min_price_momentum_pct * 2
      : 25;
    const momentumScore = Math.min(1, Math.max(0, momentumPct) / Math.max(momentumDenom, 1));
    const volumeScore = Math.min(1, volumeSpike / Math.max(this.cfg.volume_spike_multiplier * 2, 1));
    const imbalanceScore = Math.min(1, imbalance);

    return Number((timeScore * 0.25 + momentumScore * 0.30 + volumeScore * 0.25 + imbalanceScore * 0.20).toFixed(4));
  }

  private isMarketExpired(market: MarketData): boolean {
    if (!market.endDate) return false;
    const endTs = Date.parse(market.endDate);
    if (!Number.isFinite(endTs)) return false;
    return endTs <= Date.now();
  }

  private queueExit(position: ManagedLongshotPosition, price: number, reason: string): void {
    const walletId = this.context?.wallet.walletId ?? 'unknown';
    const alreadyQueued = this.pendingExits.some(
      (o) => o.marketId === position.marketId && o.outcome === position.outcome && o.side === 'SELL',
    );
    if (alreadyQueued) return;

    this.queueExitOrder({
      marketId: position.marketId,
      outcome: position.outcome,
      side: 'SELL',
      price: Number(Math.max(0.01, Math.min(0.99, price)).toFixed(4)),
      size: position.size,
      rawReason: reason,
    });

    logger.info(
      {
        strategy: this.name,
        marketId: position.marketId,
        outcome: position.outcome,
        size: position.size,
        reason,
      },
      'Longshot queued exit order',
    );
  }

  private maybeRotateDailySummary(now: number): void {
    if (now < this.nextDailySummaryMs) return;

    this.emitDailySummary('DAILY_ROLLOVER');
    this.dayStartMs = now;
    this.nextDailySummaryMs = this.nextUtcMidnightMs(now);
    this.dailyPerf = this.emptyDailyPerf();
  }

  private emitDailySummary(reason: 'DAILY_ROLLOVER' | 'SHUTDOWN'): void {
    const summary = this.buildDailySummary(Date.now());

    logger.info(
      {
        strategy: this.name,
        reason,
        ...summary,
      },
      'Longshot daily performance summary',
    );
  }

  getDailyPerformanceSnapshot(): LongshotDailyPerformanceSnapshot {
    this.maybeRotateDailySummary(Date.now());
    return this.buildDailySummary(Date.now());
  }

  private nextUtcMidnightMs(nowMs: number): number {
    const d = new Date(nowMs);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
  }

  private emptyDailyPerf(): DailyPerfStats {
    return {
      entryFills: 0,
      exitFills: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      realizedPnlUsd: 0,
      grossWinUsd: 0,
      grossLossUsd: 0,
      entryNotionalUsd: 0,
      exitNotionalUsd: 0,
      peakRealizedUsd: 0,
      maxDrawdownUsd: 0,
    };
  }

  private buildDailySummary(now: number): LongshotDailyPerformanceSnapshot {
    const closed = this.dailyPerf.wins + this.dailyPerf.losses + this.dailyPerf.breakeven;
    const decided = this.dailyPerf.wins + this.dailyPerf.losses;
    const winRate = decided > 0 ? this.dailyPerf.wins / decided : 0;
    const expectancy = closed > 0 ? this.dailyPerf.realizedPnlUsd / closed : 0;
    const profitFactor = this.dailyPerf.grossLossUsd < 0
      ? this.dailyPerf.grossWinUsd / Math.abs(this.dailyPerf.grossLossUsd)
      : this.dailyPerf.grossWinUsd > 0 ? Number.POSITIVE_INFINITY : 0;

    return {
      periodStart: new Date(this.dayStartMs).toISOString(),
      periodEnd: new Date(now).toISOString(),
      openPositions: this.positions.length,
      entryFills: this.dailyPerf.entryFills,
      exitFills: this.dailyPerf.exitFills,
      wins: this.dailyPerf.wins,
      losses: this.dailyPerf.losses,
      breakeven: this.dailyPerf.breakeven,
      winRate: Number(winRate.toFixed(4)),
      realizedPnlUsd: Number(this.dailyPerf.realizedPnlUsd.toFixed(4)),
      expectancyUsdPerExit: Number(expectancy.toFixed(4)),
      profitFactor: Number.isFinite(profitFactor) ? Number(profitFactor.toFixed(4)) : 'Infinity',
      entryNotionalUsd: Number(this.dailyPerf.entryNotionalUsd.toFixed(4)),
      exitNotionalUsd: Number(this.dailyPerf.exitNotionalUsd.toFixed(4)),
      maxDrawdownUsd: Number(this.dailyPerf.maxDrawdownUsd.toFixed(4)),
    };
  }

  override shutdown(): void {
    this.emitDailySummary('SHUTDOWN');
  }
}
