import http from 'http';
import { WalletManager } from '../wallets/wallet_manager';

const MAX_ALL_TRADES_RESPONSE_LIMIT = Math.max(
  100,
  Number(process.env.DASHBOARD_TRADES_ALL_MAX_RESPONSE_LIMIT ?? '10000'),
);
const DEFAULT_ALL_TRADES_RESPONSE_LIMIT = Math.max(
  100,
  Math.min(
    MAX_ALL_TRADES_RESPONSE_LIMIT,
    Number(process.env.DASHBOARD_TRADES_ALL_DEFAULT_LIMIT ?? '3000'),
  ),
);
const MAX_ALL_TRADES_OFFSET = Math.max(
  0,
  Number(process.env.DASHBOARD_TRADES_ALL_MAX_OFFSET ?? '50000'),
);

const MAX_WALLET_TRADES_RESPONSE_LIMIT = Math.max(
  100,
  Number(process.env.DASHBOARD_WALLET_TRADES_MAX_RESPONSE_LIMIT ?? '5000'),
);
const DEFAULT_WALLET_TRADES_RESPONSE_LIMIT = Math.max(
  100,
  Math.min(
    MAX_WALLET_TRADES_RESPONSE_LIMIT,
    Number(process.env.DASHBOARD_WALLET_TRADES_DEFAULT_LIMIT ?? '2000'),
  ),
);
const MAX_WALLET_TRADES_OFFSET = Math.max(
  0,
  Number(process.env.DASHBOARD_WALLET_TRADES_MAX_OFFSET ?? '50000'),
);

type TradeView = {
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
};

function parseBoundedInt(
  value: string | null,
  defaultValue: number,
  minValue: number,
  maxValue: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(maxValue, Math.max(minValue, Math.floor(parsed)));
}

export type DashboardTradeRouteDeps = {
  walletManager: WalletManager;
  walletDisplayNames: Map<string, string>;
  json: (res: http.ServerResponse, status: number, body: unknown) => void;
};

export function handleDashboardTradeRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  path: string,
  method: string,
  deps: DashboardTradeRouteDeps,
): boolean {
  const { walletManager, walletDisplayNames, json } = deps;

  if (path === '/api/trades/all' && method === 'GET') {
    const limit = parseBoundedInt(
      url.searchParams.get('limit'),
      DEFAULT_ALL_TRADES_RESPONSE_LIMIT,
      1,
      MAX_ALL_TRADES_RESPONSE_LIMIT,
    );
    const offset = parseBoundedInt(
      url.searchParams.get('offset'),
      0,
      0,
      MAX_ALL_TRADES_OFFSET,
    );
    const needed = limit + offset;
    const pruneThreshold = Math.max(needed * 2, 2000);

    const allTradesMap = walletManager.getAllTradeHistories();
    const wallets = walletManager.listWallets();
    const allTrades: TradeView[] = [];
    let totalTrades = 0;
    let winCount = 0;
    let lossCount = 0;
    let totalVolume = 0;

    for (const [walletId, trades] of allTradesMap) {
      const ws = wallets.find((w) => w.walletId === walletId);
      const walletName =
        walletDisplayNames.get(walletId) ?? ws?.assignedStrategy ?? walletId;
      const strategy = ws?.assignedStrategy ?? 'unknown';
      for (const t of trades) {
        totalTrades += 1;
        if (t.realizedPnl > 0) winCount += 1;
        if (t.realizedPnl < 0) lossCount += 1;
        totalVolume += t.cost;

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

        if (allTrades.length > pruneThreshold) {
          allTrades.sort((a, b) => a.timestamp - b.timestamp);
          allTrades.splice(0, Math.max(0, allTrades.length - needed));
        }
      }
    }

    allTrades.sort((a, b) => a.timestamp - b.timestamp);
    const end = Math.max(0, allTrades.length - offset);
    const start = Math.max(0, end - limit);
    const pagedTrades = allTrades.slice(start, end);

    const totalRealizedPnl = wallets.reduce((s, w) => s + w.realizedPnl, 0);

    json(res, 200, {
      trades: pagedTrades,
      summary: {
        totalTrades,
        totalRealizedPnl: Number(totalRealizedPnl.toFixed(4)),
        winCount,
        lossCount,
        totalVolume: Number(totalVolume.toFixed(4)),
      },
      paging: {
        limit,
        offset,
        returned: pagedTrades.length,
        totalTrades,
      },
    });
    return true;
  }

  if (path.startsWith('/api/trades/') && method === 'GET') {
    const limit = parseBoundedInt(
      url.searchParams.get('limit'),
      DEFAULT_WALLET_TRADES_RESPONSE_LIMIT,
      1,
      MAX_WALLET_TRADES_RESPONSE_LIMIT,
    );
    const offset = parseBoundedInt(
      url.searchParams.get('offset'),
      0,
      0,
      MAX_WALLET_TRADES_OFFSET,
    );

    const walletId = decodeURIComponent(path.slice('/api/trades/'.length));
    const trades = walletManager.getTradeHistory(walletId);
    const walletState = walletManager.listWallets().find((w) => w.walletId === walletId);
    if (!walletState) {
      json(res, 404, { ok: false, error: `Wallet "${walletId}" not found` });
      return true;
    }

    const totalTrades = trades.length;
    let buys = 0;
    let sells = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalVolume = 0;
    let bestTrade = 0;
    let worstTrade = 0;
    let seenTrade = false;

    for (const t of trades) {
      if (t.side === 'BUY') buys += 1;
      if (t.side === 'SELL') sells += 1;
      if (t.realizedPnl > 0) winningTrades += 1;
      if (t.realizedPnl < 0) losingTrades += 1;
      totalVolume += t.cost;
      if (!seenTrade) {
        bestTrade = t.realizedPnl;
        worstTrade = t.realizedPnl;
        seenTrade = true;
      } else {
        if (t.realizedPnl > bestTrade) bestTrade = t.realizedPnl;
        if (t.realizedPnl < worstTrade) worstTrade = t.realizedPnl;
      }
    }

    const totalPnl = walletState.realizedPnl;
    const winRate = sells > 0 ? winningTrades / sells : 0;
    const avgTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;
    const end = Math.max(0, trades.length - offset);
    const start = Math.max(0, end - limit);
    const pagedTrades = trades.slice(start, end);

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
      trades: pagedTrades,
      paging: {
        limit,
        offset,
        returned: pagedTrades.length,
        totalTrades,
      },
    });
    return true;
  }

  return false;
}
