import { describe, it, expect, vi } from 'vitest';
import { TradeExecutor } from '../src/execution/trade_executor';
import { OrderRequest } from '../src/types';
import type { ExecutionWallet } from '../src/wallets/wallet_manager';
import type { WalletState } from '../src/types';

function makeWallet(overrides: Partial<WalletState> = {}): ExecutionWallet {
  const placeOrder = vi.fn().mockResolvedValue(undefined);
  return {
    getState: () => ({
      walletId: 'wallet_test',
      mode: 'PAPER',
      assignedStrategy: 'test',
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
      ...overrides,
    }),
    getTradeHistory: () => [],
    updateBalance: vi.fn(),
    placeOrder,
  };
}

const baseOrder: OrderRequest = {
  walletId: 'wallet_test',
  marketId: 'market_abc',
  outcome: 'YES',
  side: 'BUY',
  price: 0.6,
  size: 10,
  strategy: 'test',
};

describe('TradeExecutor', () => {
  it('calls placeOrder on the wallet with the correct fields', async () => {
    const wallet = makeWallet();
    const executor = new TradeExecutor();
    await executor.execute(baseOrder, wallet);

    expect(wallet.placeOrder).toHaveBeenCalledOnce();
    expect(wallet.placeOrder).toHaveBeenCalledWith({
      marketId: 'market_abc',
      tokenId: undefined,
      outcome: 'YES',
      side: 'BUY',
      price: 0.6,
      size: 10,
    });
  });

  it('propagates placeOrder errors to the caller', async () => {
    const wallet = makeWallet();
    vi.spyOn(wallet, 'placeOrder').mockRejectedValue(new Error('order rejected'));

    const executor = new TradeExecutor();
    await expect(executor.execute(baseOrder, wallet)).rejects.toThrow('order rejected');
  });

  it('passes tokenId when present on the order', async () => {
    const wallet = makeWallet();
    const executor = new TradeExecutor();
    const orderWithToken: OrderRequest = { ...baseOrder, tokenId: 'token_xyz' };
    await executor.execute(orderWithToken, wallet);

    expect(wallet.placeOrder).toHaveBeenCalledWith(
      expect.objectContaining({ tokenId: 'token_xyz' }),
    );
  });

  it('forwards SELL side correctly', async () => {
    const wallet = makeWallet();
    const executor = new TradeExecutor();
    const sellOrder: OrderRequest = { ...baseOrder, side: 'SELL', outcome: 'NO' };
    await executor.execute(sellOrder, wallet);

    expect(wallet.placeOrder).toHaveBeenCalledWith(
      expect.objectContaining({ side: 'SELL', outcome: 'NO' }),
    );
  });
});
