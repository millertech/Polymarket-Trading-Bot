import http from 'http';
import { WalletManager } from '../wallets/wallet_manager';
import { getStrategyCatalog } from './dashboard_strategy_catalog';

type JsonWriter = (res: http.ServerResponse, status: number, body: unknown) => void;
type JsonBodyReader = (req: http.IncomingMessage) => Promise<Record<string, unknown>>;

type CopyTradeInstanceLike = {
  getWhaleAddresses: () => string[];
  getStats: () => unknown;
  getWhalePerformance: () => Map<string, {
    tradesCopied: number;
    wins: number;
    losses: number;
    totalPnlBps: number;
    consecutiveLosses: number;
    pausedUntil: number;
  }>;
  addWhaleAddress: (address: string) => boolean;
  removeWhaleAddress: (address: string) => boolean;
};

export type DashboardStrategyRouteDeps = {
  walletManager: WalletManager;
  json: JsonWriter;
  readJsonBody: JsonBodyReader;
  getCopyTradeInstances: () => CopyTradeInstanceLike[];
};

export async function handleDashboardStrategyRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  path: string,
  method: string,
  deps: DashboardStrategyRouteDeps,
): Promise<boolean> {
  const { walletManager, json, readJsonBody, getCopyTradeInstances } = deps;

  if (path === '/api/strategies' && method === 'GET') {
    json(res, 200, getStrategyCatalog());
    return true;
  }

  if (path.startsWith('/api/strategies/') && method === 'GET') {
    const stratId = decodeURIComponent(path.slice('/api/strategies/'.length));
    const catalog = getStrategyCatalog();
    const entry = catalog.find((s) => s.id === stratId);
    if (!entry) {
      json(res, 404, { ok: false, error: `Strategy "${stratId}" not found` });
      return true;
    }

    const liveConfig = walletManager
      ? walletManager.listWallets()
          .filter((w) => w.assignedStrategy === stratId)
          .map((w) => ({
            walletId: w.walletId,
            mode: w.mode,
            capital: w.capitalAllocated,
            balance: Number(w.availableBalance.toFixed(4)),
            pnl: Number(w.realizedPnl.toFixed(4)),
            openPositions: w.openPositions.length,
          }))
      : [];

    json(res, 200, { ...entry, liveWallets: liveConfig });
    return true;
  }

  if (path === '/api/copy-trade/whales' && method === 'GET') {
    const instances = getCopyTradeInstances();
    if (instances.length === 0) {
      json(res, 200, { ok: true, addresses: [], stats: null, whalePerformance: [] });
      return true;
    }

    const inst = instances[0];
    const addrs = inst.getWhaleAddresses();
    const stats = inst.getStats();
    const perfMap = inst.getWhalePerformance();
    const whalePerformance = addrs.map((a: string) => {
      const p = perfMap.get(a.toLowerCase());
      return {
        address: a,
        tradesCopied: p?.tradesCopied ?? 0,
        wins: p?.wins ?? 0,
        losses: p?.losses ?? 0,
        winRate: p && (p.wins + p.losses) > 0 ? p.wins / (p.wins + p.losses) : 0,
        totalPnlBps: p?.totalPnlBps ?? 0,
        consecutiveLosses: p?.consecutiveLosses ?? 0,
        paused: p ? p.pausedUntil > Date.now() : false,
      };
    });
    json(res, 200, { ok: true, addresses: addrs, stats, whalePerformance });
    return true;
  }

  if (path === '/api/copy-trade/whales' && method === 'POST') {
    const body = await readJsonBody(req);
    const address = (body.address as string || '').trim();
    if (!address) {
      json(res, 400, { ok: false, error: 'Missing "address" field' });
      return true;
    }
    const instances = getCopyTradeInstances();
    if (instances.length === 0) {
      json(res, 404, { ok: false, error: 'No copy_trade strategy instances running' });
      return true;
    }
    let added = false;
    for (const inst of instances) {
      if (inst.addWhaleAddress(address)) added = true;
    }
    if (added) {
      json(res, 200, { ok: true, message: `Whale address "${address}" added to ${instances.length} copy trade instance(s)` });
    } else {
      json(res, 409, { ok: false, error: `Address "${address}" is already being tracked` });
    }
    return true;
  }

  if (path.startsWith('/api/copy-trade/whales/') && method === 'DELETE') {
    const address = decodeURIComponent(path.slice('/api/copy-trade/whales/'.length)).trim();
    if (!address) {
      json(res, 400, { ok: false, error: 'Missing address in URL' });
      return true;
    }
    const instances = getCopyTradeInstances();
    if (instances.length === 0) {
      json(res, 404, { ok: false, error: 'No copy_trade strategy instances running' });
      return true;
    }
    let removed = false;
    for (const inst of instances) {
      if (inst.removeWhaleAddress(address)) removed = true;
    }
    if (removed) {
      json(res, 200, { ok: true, message: `Whale address "${address}" removed` });
    } else {
      json(res, 404, { ok: false, error: `Address "${address}" not found` });
    }
    return true;
  }

  return false;
}