import { beforeEach, describe, expect, it } from 'vitest';
import { LongshotHunterStrategy } from '../src/strategies/longshot/longshot_hunter';
import { LongshotConfig, MarketData, WalletState } from '../src/types';

function mkMarket(overrides: Partial<MarketData> = {}): MarketData {
  return {
    marketId: 'mkt-1',
    question: 'Will event happen?',
    slug: 'will-event-happen',
    outcomes: ['Yes', 'No'],
    outcomePrices: [0.03, 0.97],
    clobTokenIds: ['tok-yes', 'tok-no'],
    midPrice: 0.03,
    bid: 0.029,
    ask: 0.031,
    spread: 0.002,
    volume24h: 10_000,
    liquidity: 5_000,
    timestamp: Date.now(),
    endDate: new Date(Date.now() + 24 * 3_600_000).toISOString(),
    oneDayPriceChange: 0.40,
    oneWeekPriceChange: 0.90,
    ...overrides,
  };
}

function mkWallet(overrides: Partial<WalletState> = {}): WalletState {
  return {
    walletId: 'paper_longshot_hunter',
    mode: 'PAPER',
    assignedStrategy: 'longshot_hunter',
    capitalAllocated: 2_000,
    availableBalance: 2_000,
    openPositions: [],
    realizedPnl: 0,
    riskLimits: {
      maxPositionSize: 50,
      maxExposurePerMarket: 100,
      maxDailyLoss: 100,
      maxOpenTrades: 60,
      maxDrawdown: 0.25,
    },
    ...overrides,
  };
}

const baseCfg: Partial<LongshotConfig> = {
  enabled: true,
  min_entry_price: 0.01,
  max_entry_price: 0.05,
  max_hours_to_resolution: 120,
  min_liquidity_usd: 300,
  min_volume_24h_usd: 100,
  min_price_momentum_pct: 0,
  volume_spike_multiplier: 1.2,
  min_buy_imbalance: 0.15,
  min_signal_score: 0.60,
  max_position_usd: 15,
  max_total_positions: 40,
  max_total_exposure_usd: 400,
  stop_loss_pct: 0.50,
  take_profit_price: 0.50,
  hold_to_resolution: true,
  use_whale_signals: false,
};

function createStrategy(cfgOverrides: Partial<LongshotConfig> = {}): LongshotHunterStrategy {
  const strategy = new LongshotHunterStrategy();
  strategy.initialize({
    wallet: mkWallet(),
    config: {
      ...baseCfg,
      ...cfgOverrides,
    } as Record<string, unknown>,
  });
  return strategy;
}

describe('LongshotHunterStrategy', () => {
  let strategy: LongshotHunterStrategy;

  beforeEach(() => {
    strategy = createStrategy();
  });

  it('rejects markets above max entry price', () => {
    strategy.onMarketUpdate(mkMarket({ outcomePrices: [0.10, 0.90], midPrice: 0.10, bid: 0.099, ask: 0.101 }));
    const signals = strategy.generateSignals();
    expect(signals).toHaveLength(0);
  });

  it('rejects markets too far from resolution', () => {
    strategy.onMarketUpdate(
      mkMarket({ endDate: new Date(Date.now() + 14 * 24 * 3_600_000).toISOString() }),
    );
    const signals = strategy.generateSignals();
    expect(signals).toHaveLength(0);
  });

  it('generates signal when all filters pass', () => {
    for (let i = 0; i < 5; i++) {
      strategy.onMarketUpdate(
        mkMarket({
          marketId: 'mkt-pass',
          volume24h: 5_000,
          timestamp: Date.now() - (10 - i) * 60_000,
        }),
      );
    }

    strategy.onMarketUpdate(
      mkMarket({
        marketId: 'mkt-pass',
        volume24h: 10_000,
        oneDayPriceChange: 0.50,
      }),
    );

    const signals = strategy.generateSignals();
    expect(signals.length).toBeGreaterThanOrEqual(1);
    expect(signals[0].marketId).toBe('mkt-pass');
    expect(signals[0].outcome).toBe('YES');
    expect(signals[0].side).toBe('BUY');
  });

  it('queues stop loss exit when price drops 50%', () => {
    strategy.onMarketUpdate(mkMarket({ marketId: 'mkt-stop', outcomePrices: [0.04, 0.96], midPrice: 0.04 }));
    strategy.notifyFill({
      walletId: 'paper_longshot_hunter',
      marketId: 'mkt-stop',
      outcome: 'YES',
      side: 'BUY',
      price: 0.04,
      size: 100,
      strategy: 'longshot_hunter',
    });

    strategy.onMarketUpdate(mkMarket({ marketId: 'mkt-stop', outcomePrices: [0.019, 0.981], midPrice: 0.019, bid: 0.0185, ask: 0.0195 }));
    strategy.managePositions();

    const exits = strategy.drainExitOrders();
    expect(exits).toHaveLength(1);
    expect(exits[0].side).toBe('SELL');
    expect(exits[0].marketId).toBe('mkt-stop');
  });

  it('does not take profit early when hold_to_resolution is true', () => {
    strategy.onMarketUpdate(mkMarket({ marketId: 'mkt-hold', outcomePrices: [0.04, 0.96], midPrice: 0.04 }));
    strategy.notifyFill({
      walletId: 'paper_longshot_hunter',
      marketId: 'mkt-hold',
      outcome: 'YES',
      side: 'BUY',
      price: 0.04,
      size: 100,
      strategy: 'longshot_hunter',
    });

    strategy.onMarketUpdate(mkMarket({ marketId: 'mkt-hold', outcomePrices: [0.70, 0.30], midPrice: 0.70, bid: 0.69, ask: 0.71 }));
    strategy.managePositions();

    const exits = strategy.drainExitOrders();
    expect(exits).toHaveLength(0);
  });
});
