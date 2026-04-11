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
  /** Optional runtime reset used by dashboard operations. */
  resetRuntimeState?(): void;
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

    const effectiveMode = config.mode === 'LIVE' && !enableLive ? 'PAPER' : config.mode;
    if (config.mode === 'LIVE' && !enableLive) {
      logger.warn(
        { walletId: config.id },
        `Wallet ${config.id} configured as LIVE while live trading is disabled; falling back to PAPER mode`,
      );
    }

    const wallet =
      effectiveMode === 'LIVE'
        ? new PolymarketWallet(config, assignedStrategy)
        : new PaperWallet({ ...config, mode: 'PAPER' }, assignedStrategy);

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

  /** Expose the raw wallet map for direct iteration (e.g. emergency close). */
  getWalletsMap(): Map<string, ExecutionWallet> {
    return this.wallets;
  }

  /**
   * Calculate the total portfolio exposure (cost basis) for a given market
   * across ALL registered wallets.  Used by the risk layer to enforce
   * portfolio-level per-market limits independent of per-wallet checks.
   */
  getTotalMarketExposure(marketId: string): number {
    let total = 0;
    for (const wallet of this.wallets.values()) {
      const state = wallet.getState();
      for (const pos of state.openPositions) {
        if (pos.marketId === marketId) {
          total += Math.abs(pos.avgPrice * pos.size);
        }
      }
    }
    return total;
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

  async runLivePreflight(maxAttempts = 3, retryDelayMs = 3_000): Promise<void> {
    const failures: Array<{ walletId: string; reason: string; details?: Record<string, unknown> }> = [];

    for (const [walletId, wallet] of this.wallets.entries()) {
      if (!wallet.preflightLiveAccess) continue;
      const state = wallet.getState();
      if (state.mode !== 'LIVE') continue;

      let result: { ok: boolean; reason?: string; details?: Record<string, unknown> } = { ok: false, reason: 'not run' };
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        result = await wallet.preflightLiveAccess();
        if (result.ok) break;
        const isNetworkError = !result.details || (result.reason ?? '').toLowerCase().includes('fetch failed') || (result.reason ?? '').toLowerCase().includes('clob preflight failed');
        if (!isNetworkError || attempt === maxAttempts) break;
        logger.warn(
          { walletId, reason: result.reason, attempt, maxAttempts, retryDelayMs },
          'LIVE preflight network error — retrying',
        );
        await new Promise((r) => setTimeout(r, retryDelayMs));
      }

      if (!result.ok) {
        failures.push({
          walletId,
          reason: result.reason ?? 'unknown reason',
          details: result.details,
        });
        logger.error({ walletId, reason: result.reason, details: result.details }, 'LIVE preflight failed');
      } else {
        logger.info({ walletId, details: result.details }, 'LIVE preflight succeeded');
      }
    }

    if (failures.length > 0) {
      const summary = failures
        .map((f) => `${f.walletId}: ${f.reason}`)
        .join('; ');
      throw new Error(`LIVE preflight failed for ${failures.length} wallet(s): ${summary}`);
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
