import { describe, it, expect } from 'vitest';
import { WalletManager } from '../src/wallets/wallet_manager';
import type { WalletState } from '../src/types';

const walletConfig = {
  id: 'wallet_1',
  mode: 'PAPER' as const,
  strategy: 'momentum',
  capital: 500,
};

describe('WalletManager', () => {
  it('registers paper wallets', () => {
    const manager = new WalletManager();
    manager.registerWallet(walletConfig, walletConfig.strategy, false);
    const wallets = manager.listWallets();
    expect(wallets).toHaveLength(1);
    expect(wallets[0].mode).toBe('PAPER');
  });

  it('falls back to PAPER when live wallets registered with enableLive=false', () => {
    const manager = new WalletManager();
    manager.registerWallet(
      { ...walletConfig, id: 'live_1', mode: 'LIVE' },
      walletConfig.strategy,
      false,
    );
    const wallets = manager.listWallets();
    expect(wallets).toHaveLength(1);
    expect(wallets[0].mode).toBe('PAPER');
  });

  it('aggregates startup reconciliation status across wallets', async () => {
    const manager = new WalletManager();

    const liveState: WalletState = {
      walletId: 'live_wallet_1',
      mode: 'LIVE',
      assignedStrategy: 'momentum',
      capitalAllocated: 1000,
      availableBalance: 950,
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

    manager.registerExternalWallet(liveState.walletId, {
      getState: () => liveState,
      getTradeHistory: () => [],
      placeOrder: async () => undefined,
      updateBalance: () => undefined,
      reconcileLiveState: async () => ({
        status: 'yellow',
        exchangeOpenOrders: 0,
        exchangeRecentFills: 0,
        exchangeBalanceUsd: 100,
        notes: ['test reconciliation warning'],
      }),
    });

    manager.registerWallet(walletConfig, walletConfig.strategy, false);

    const report = await manager.runStartupReconciliation();
    expect(report.summary.totalWallets).toBe(2);
    expect(report.summary.liveWallets).toBe(1);
    expect(report.summary.yellowWallets).toBe(1);
    expect(report.status).toBe('yellow');
  });
});
