import { PaperWallet } from './paper_wallet';
import { PolymarketWallet } from './polymarket_wallet';
import { WalletState, WalletConfig, TradeRecord } from '../types';
import { logger } from '../reporting/logs';

export interface ExecutionWallet {
  getState(): WalletState;
  getTradeHistory(): TradeRecord[];
  placeOrder(request: {
    marketId: string;
    tokenId?: string;
    outcome: 'YES' | 'NO';
    side: 'BUY' | 'SELL';
    price: number;
    size: number;
  }): Promise<void>;
  updateBalance(delta: number): void;
  /** Optional display name for the dashboard (defaults to walletId) */
  getDisplayName?(): string;
  setDisplayName?(name: string): void;
  /** Update risk limits at runtime */
  updateRiskLimits?(limits: Partial<import('../types').RiskLimits>): void;
  /** Optional startup preflight for LIVE trading reachability / restrictions */
  preflightLiveAccess?(): Promise<{ ok: boolean; reason?: string; details?: Record<string, unknown> }>;
  /** Optional runtime state rehydration (used on bot restart) */
  rehydrateRuntimeState?(snapshot: {
    state: WalletState;
    trades: TradeRecord[];
    displayName?: string;
  }): void;
}

export interface WalletRuntimeSnapshot {
  version: number;
  savedAt: string;
  wallets: Array<{
    walletId: string;
    state: WalletState;
    trades: TradeRecord[];
    displayName: string;
  }>;
}

export class WalletManager {
  private readonly wallets = new Map<string, ExecutionWallet>();

  registerWallet(config: WalletConfig, assignedStrategy: string, enableLive: boolean): void {
    if (this.wallets.has(config.id)) {
      throw new Error(`Wallet ${config.id} already registered`);
    }

    if (config.mode === 'LIVE' && !enableLive) {
      logger.warn(
        { walletId: config.id },
        'LIVE trading requested but ENABLE_LIVE_TRADING is false — falling back to PAPER mode',
      );
      config = { ...config, mode: 'PAPER' };
    }

    const wallet =
      config.mode === 'LIVE'
        ? new PolymarketWallet(config, assignedStrategy)
        : new PaperWallet(config, assignedStrategy);

    this.wallets.set(config.id, wallet);
    const state = wallet.getState();
    logger.info(
      { walletId: state.walletId, mode: state.mode, strategy: state.assignedStrategy, capital: state.capitalAllocated },
      `Registered wallet ${state.walletId} (${state.mode}) strategy=${state.assignedStrategy}`,
    );
  }

  getWallet(walletId: string): ExecutionWallet | undefined {
    return this.wallets.get(walletId);
  }

  listWallets(): WalletState[] {
    return Array.from(this.wallets.values()).map((wallet) => wallet.getState());
  }

  getTradeHistory(walletId: string): TradeRecord[] {
    const wallet = this.wallets.get(walletId);
    if (!wallet) return [];
    return wallet.getTradeHistory();
  }

  getAllTradeHistories(): Map<string, TradeRecord[]> {
    const map = new Map<string, TradeRecord[]>();
    for (const [id, wallet] of this.wallets) {
      map.set(id, wallet.getTradeHistory());
    }
    return map;
  }

  removeWallet(walletId: string): boolean {
    if (!this.wallets.has(walletId)) {
      return false;
    }
    this.wallets.delete(walletId);
    logger.info({ walletId }, `Wallet ${walletId} removed`);
    return true;
  }

  registerExternalWallet(walletId: string, wallet: ExecutionWallet): void {
    if (this.wallets.has(walletId)) {
      throw new Error(`Wallet ${walletId} already registered`);
    }
    this.wallets.set(walletId, wallet);
  }

  addWallet(wallet: ExecutionWallet): void {
    const state = wallet.getState();
    if (this.wallets.has(state.walletId)) {
      throw new Error(`Wallet ${state.walletId} already registered`);
    }
    this.wallets.set(state.walletId, wallet);
    logger.info(
      { walletId: state.walletId, mode: state.mode, strategy: state.assignedStrategy, capital: state.capitalAllocated },
      `Wallet ${state.walletId} added at runtime (${state.mode}) strategy=${state.assignedStrategy}`,
    );
  }

  async runLivePreflight(): Promise<void> {
    for (const [walletId, wallet] of this.wallets.entries()) {
      if (!wallet.preflightLiveAccess) continue;
      const state = wallet.getState();
      if (state.mode !== 'LIVE') continue;

      const result = await wallet.preflightLiveAccess();
      if (!result.ok) {
        logger.warn({ walletId, reason: result.reason, details: result.details }, 'LIVE preflight failed; wallet fallback applied');
      } else {
        logger.info({ walletId, details: result.details }, 'LIVE preflight succeeded');
      }
    }
  }

  createRuntimeSnapshot(): WalletRuntimeSnapshot {
    const wallets = Array.from(this.wallets.entries()).map(([walletId, wallet]) => ({
      walletId,
      state: wallet.getState(),
      trades: wallet.getTradeHistory(),
      displayName: typeof wallet.getDisplayName === 'function'
        ? wallet.getDisplayName()
        : walletId,
    }));

    return {
      version: 1,
      savedAt: new Date().toISOString(),
      wallets,
    };
  }

  rehydrateFromRuntimeSnapshot(snapshot: WalletRuntimeSnapshot): {
    restored: number;
    skipped: number;
  } {
    if (!snapshot || !Array.isArray(snapshot.wallets)) {
      return { restored: 0, skipped: 0 };
    }

    let restored = 0;
    let skipped = 0;

    for (const entry of snapshot.wallets) {
      const wallet = this.wallets.get(entry.walletId);
      if (!wallet || typeof wallet.rehydrateRuntimeState !== 'function') {
        skipped++;
        continue;
      }

      try {
        wallet.rehydrateRuntimeState({
          state: entry.state,
          trades: Array.isArray(entry.trades) ? entry.trades : [],
          displayName: entry.displayName,
        });
        restored++;
      } catch {
        skipped++;
      }
    }

    return { restored, skipped };
  }
}
