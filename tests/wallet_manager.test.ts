import { describe, it, expect } from 'vitest';
import { WalletManager } from '../src/wallets/wallet_manager';

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
});
