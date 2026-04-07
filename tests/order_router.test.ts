import { afterEach, describe, it, expect } from 'vitest';
import { OrderRouter } from '../src/execution/order_router';
import { RiskEngine } from '../src/risk/risk_engine';
import { KillSwitch } from '../src/risk/kill_switch';
import { TradeExecutor } from '../src/execution/trade_executor';
import { WalletManager } from '../src/wallets/wallet_manager';
import { OrderRequest, WalletState } from '../src/types';
import { getRuntimeCountersSnapshot, resetRuntimeCounters } from '../src/reporting/runtime_counters';

class StubWallet {
  public called = false;
  constructor(private state: WalletState) {}
  getState(): WalletState {
    return this.state;
  }
  getTradeHistory() {
    return [];
  }
  updateBalance(): void {
    return;
  }
  async placeOrder(): Promise<void> {
    this.called = true;
  }
}

class TimeoutWallet extends StubWallet {
  override async placeOrder(): Promise<void> {
    throw new Error('request timed out while placing order');
  }
}

describe('OrderRouter', () => {
  afterEach(() => {
    resetRuntimeCounters();
  });

  it('routes orders that pass risk checks', async () => {
    const walletState: WalletState = {
      walletId: 'wallet_1',
      mode: 'PAPER',
      assignedStrategy: 'momentum',
      capitalAllocated: 1000,
      availableBalance: 1000,
      openPositions: [],
      realizedPnl: 0,
      riskLimits: {
        maxPositionSize: 100,
        maxExposurePerMarket: 200,
        maxDailyLoss: 100,
        maxOpenTrades: 5,
        maxDrawdown: 0.2,
      },
    };

  const manager = new WalletManager();
  const stub = new StubWallet(walletState);
  manager.registerExternalWallet(walletState.walletId, stub);

    const router = new OrderRouter(manager, new RiskEngine(new KillSwitch()), new TradeExecutor());

    const order: OrderRequest = {
      walletId: walletState.walletId,
      marketId: 'POLY-EXAMPLE',
      outcome: 'YES',
      side: 'BUY',
      price: 0.5,
      size: 10,
      strategy: 'momentum',
    };

    await router.route(order);
    expect(stub.called).toBe(true);
  });

  it('tracks risk rejection suppression counters', async () => {
    const walletState: WalletState = {
      walletId: 'wallet_2',
      mode: 'PAPER',
      assignedStrategy: 'momentum',
      capitalAllocated: 1000,
      availableBalance: 1000,
      openPositions: [],
      realizedPnl: 0,
      riskLimits: {
        maxPositionSize: 100,
        maxExposurePerMarket: 200,
        maxDailyLoss: 100,
        maxOpenTrades: 5,
        maxDrawdown: 0.2,
      },
    };

    const manager = new WalletManager();
    manager.registerExternalWallet(walletState.walletId, new StubWallet(walletState));

    const router = new OrderRouter(manager, new RiskEngine(new KillSwitch()), new TradeExecutor());

    const rejectedOrder: OrderRequest = {
      walletId: walletState.walletId,
      marketId: 'POLY-EXAMPLE',
      outcome: 'YES',
      side: 'BUY',
      price: 0.5,
      size: 1_000,
      strategy: 'momentum',
    };

    await router.route(rejectedOrder);
    await router.route(rejectedOrder);

    const counters = getRuntimeCountersSnapshot();
    expect(counters.orderRouter.riskRejections).toBe(2);
    expect(counters.orderRouter.riskLogSuppressed).toBeGreaterThanOrEqual(1);
  });

  it('tracks execution latency and success counters for accepted orders', async () => {
    const walletState: WalletState = {
      walletId: 'wallet_3',
      mode: 'PAPER',
      assignedStrategy: 'momentum',
      capitalAllocated: 1000,
      availableBalance: 1000,
      openPositions: [],
      realizedPnl: 0,
      riskLimits: {
        maxPositionSize: 100,
        maxExposurePerMarket: 200,
        maxDailyLoss: 100,
        maxOpenTrades: 5,
        maxDrawdown: 0.2,
      },
    };

    const manager = new WalletManager();
    manager.registerExternalWallet(walletState.walletId, new StubWallet(walletState));
    const router = new OrderRouter(manager, new RiskEngine(new KillSwitch()), new TradeExecutor());

    const acceptedOrder: OrderRequest = {
      walletId: walletState.walletId,
      marketId: 'POLY-EXAMPLE',
      outcome: 'YES',
      side: 'BUY',
      price: 0.5,
      size: 10,
      strategy: 'momentum',
    };

    await router.route(acceptedOrder);

    const counters = getRuntimeCountersSnapshot();
    expect(counters.execution.routeAttempts).toBe(1);
    expect(counters.execution.routeSuccesses).toBe(1);
    expect(counters.execution.routeFailures).toBe(0);
    expect(counters.execution.routeLastAttemptAtMs).toBeGreaterThan(0);
    expect(counters.execution.routeLastLatencyAtMs).toBeGreaterThan(0);
    expect(counters.execution.submitAttempts).toBe(1);
    expect(counters.execution.submitFailures).toBe(0);
    expect(counters.execution.submitLastAttemptAtMs).toBeGreaterThan(0);
    expect(counters.execution.submitLastLatencyAtMs).toBeGreaterThan(0);
    expect(counters.execution.routeLatencyAvgMs).toBeGreaterThanOrEqual(0);
    expect(counters.execution.routeLatencyRecentAvgMs).toBeGreaterThanOrEqual(0);
    expect(counters.execution.routeLatencyP95Ms).toBeGreaterThanOrEqual(0);
    expect(counters.execution.routeLatencyP99Ms).toBeGreaterThanOrEqual(0);
    expect(counters.execution.submitLatencyAvgMs).toBeGreaterThanOrEqual(0);
    expect(counters.execution.submitLatencyRecentAvgMs).toBeGreaterThanOrEqual(0);
    expect(counters.execution.submitLatencyP95Ms).toBeGreaterThanOrEqual(0);
    expect(counters.execution.submitLatencyP99Ms).toBeGreaterThanOrEqual(0);
  });

  it('tracks submit timeout failures in execution counters', async () => {
    const walletState: WalletState = {
      walletId: 'wallet_4',
      mode: 'PAPER',
      assignedStrategy: 'momentum',
      capitalAllocated: 1000,
      availableBalance: 1000,
      openPositions: [],
      realizedPnl: 0,
      riskLimits: {
        maxPositionSize: 100,
        maxExposurePerMarket: 200,
        maxDailyLoss: 100,
        maxOpenTrades: 5,
        maxDrawdown: 0.2,
      },
    };

    const manager = new WalletManager();
    manager.registerExternalWallet(walletState.walletId, new TimeoutWallet(walletState));
    const router = new OrderRouter(manager, new RiskEngine(new KillSwitch()), new TradeExecutor());

    const acceptedOrder: OrderRequest = {
      walletId: walletState.walletId,
      marketId: 'POLY-EXAMPLE',
      outcome: 'YES',
      side: 'BUY',
      price: 0.5,
      size: 10,
      strategy: 'momentum',
    };

    await expect(router.route(acceptedOrder)).rejects.toThrow(/timed out/i);

    const counters = getRuntimeCountersSnapshot();
    expect(counters.execution.routeAttempts).toBe(1);
    expect(counters.execution.routeSuccesses).toBe(0);
    expect(counters.execution.routeFailures).toBe(1);
    expect(counters.execution.routeLastAttemptAtMs).toBeGreaterThan(0);
    expect(counters.execution.routeLastLatencyAtMs).toBeGreaterThan(0);
    expect(counters.execution.submitAttempts).toBe(1);
    expect(counters.execution.submitFailures).toBe(1);
    expect(counters.execution.submitTimeouts).toBe(1);
    expect(counters.execution.submitLastAttemptAtMs).toBeGreaterThan(0);
    expect(counters.execution.submitLastLatencyAtMs).toBeGreaterThan(0);
  });
});
