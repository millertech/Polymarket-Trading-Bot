import http from 'http';
import { WalletManager } from '../wallets/wallet_manager';

export type DashboardTradeRouteDeps = {
  walletManager: WalletManager;
  walletDisplayNames: Map<string, string>;
  json: (res: http.ServerResponse, status: number, body: unknown) => void;
};

export function handleDashboardTradeRoutes(
  res: http.ServerResponse,
  path: string,
  method: string,
  deps: DashboardTradeRouteDeps,
): boolean {
  const { walletManager, walletDisplayNames, json } = deps;

  if (path === '/api/trades/all' && method === 'GET') {
    const allTradesMap = walletManager.getAllTradeHistories();
    const wallets = walletManager.listWallets();
    const allTrades: Array<{
      orderId: string;
      walletId: string;
      walletName: string;
      strategy: string;
      marketId: string;
      outcome: string;
      side: string;
      price: number;
      size: number;
      cost: number;
      realizedPnl: number;
      cumulativePnl: number;
      balanceAfter: number;
      timestamp: number;
    }> = [];

    for (const [walletId, trades] of allTradesMap) {
      const ws = wallets.find((w) => w.walletId === walletId);
      const walletName =
        walletDisplayNames.get(walletId) ?? ws?.assignedStrategy ?? walletId;
      const strategy = ws?.assignedStrategy ?? 'unknown';
      for (const t of trades) {
        allTrades.push({
          orderId: t.orderId,
          walletId: t.walletId,
          walletName,
          strategy,
          marketId: t.marketId,
          outcome: t.outcome,
          side: t.side,
          price: t.price,
          size: t.size,
          cost: t.cost,
          realizedPnl: t.realizedPnl,
          cumulativePnl: t.cumulativePnl,
          balanceAfter: t.balanceAfter,
          timestamp: t.timestamp,
        });
      }
    }

    allTrades.sort((a, b) => a.timestamp - b.timestamp);
    const totalRealizedPnl = wallets.reduce((s, w) => s + w.realizedPnl, 0);
    const totalTrades = allTrades.length;
    const winCount = allTrades.filter((t) => t.realizedPnl > 0).length;
    const lossCount = allTrades.filter((t) => t.realizedPnl < 0).length;
    const totalVolume = allTrades.reduce((s, t) => s + t.cost, 0);

    json(res, 200, {
      trades: allTrades,
      summary: {
        totalTrades,
        totalRealizedPnl: Number(totalRealizedPnl.toFixed(4)),
        winCount,
        lossCount,
        totalVolume: Number(totalVolume.toFixed(4)),
      },
    });
    return true;
  }

  if (path.startsWith('/api/trades/') && method === 'GET') {
    const walletId = decodeURIComponent(path.slice('/api/trades/'.length));
    const trades = walletManager.getTradeHistory(walletId);
    const walletState = walletManager.listWallets().find((w) => w.walletId === walletId);
    if (!walletState) {
      json(res, 404, { ok: false, error: `Wallet "${walletId}" not found` });
      return true;
    }

    const totalTrades = trades.length;
    const buys = trades.filter((t) => t.side === 'BUY').length;
    const sells = trades.filter((t) => t.side === 'SELL').length;
    const totalPnl = walletState.realizedPnl;
    const winningTrades = trades.filter((t) => t.realizedPnl > 0).length;
    const losingTrades = trades.filter((t) => t.realizedPnl < 0).length;
    const winRate = sells > 0 ? winningTrades / sells : 0;
    const totalVolume = trades.reduce((s, t) => s + t.cost, 0);
    const avgTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;
    const bestTrade = trades.reduce((best, t) => (t.realizedPnl > best ? t.realizedPnl : best), 0);
    const worstTrade = trades.reduce((worst, t) => (t.realizedPnl < worst ? t.realizedPnl : worst), 0);

    json(res, 200, {
      walletId,
      strategy: walletState.assignedStrategy,
      mode: walletState.mode,
      summary: {
        totalTrades,
        buys,
        sells,
        totalPnl: Number(totalPnl.toFixed(4)),
        winningTrades,
        losingTrades,
        winRate: Number(winRate.toFixed(4)),
        totalVolume: Number(totalVolume.toFixed(4)),
        avgTradeSize: Number(avgTradeSize.toFixed(4)),
        bestTrade: Number(bestTrade.toFixed(4)),
        worstTrade: Number(worstTrade.toFixed(4)),
        capitalAllocated: walletState.capitalAllocated,
        availableBalance: Number(walletState.availableBalance.toFixed(4)),
      },
      trades,
    });
    return true;
  }

  return false;
}
