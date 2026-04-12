import http from 'http';
import { MarketFetcher } from '../data/market_fetcher';
import { attachReconciliationToPayload, buildDashboardPayload } from './dashboard_api';
import { consoleLog } from './console_log';
import type { WhaleAPI } from '../whales/whale_api';
import type { Engine } from '../core/engine';
import { WalletManager } from '../wallets/wallet_manager';
import type { Database } from '../storage/database';

export type DashboardOperationalRouteDeps = {
  walletManager: WalletManager;
  walletDisplayNames: Map<string, string>;
  whaleApi?: WhaleAPI;
  engine?: Engine;
  db?: Database;
  sseClients: Set<http.ServerResponse>;
  getLiveMarketPrices: () => Map<string, number>;
  json: (res: http.ServerResponse, status: number, body: unknown) => void;
};

export async function handleDashboardOperationalRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  path: string,
  method: string,
  deps: DashboardOperationalRouteDeps,
): Promise<boolean> {
  const {
    walletManager,
    walletDisplayNames,
    whaleApi,
    engine,
    sseClients,
    getLiveMarketPrices,
    json,
  } = deps;

  if (path === '/api/markets' && method === 'GET') {
    try {
      const fetcher = new MarketFetcher();
      const markets = await fetcher.fetchSnapshot();
      json(res, 200, markets);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      json(res, 500, { ok: false, error: msg });
    }
    return true;
  }

  if (path.startsWith('/api/whales') && whaleApi) {
    const handled = await whaleApi.handleRequest(req, res);
    if (handled) return true;
  }

  if (path === '/api/console/stream' && method === 'GET') {
    consoleLog.addSSEClient(res);
    return true;
  }

  if (path === '/api/console/logs' && method === 'GET') {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const limit = Number(url.searchParams.get('limit')) || 500;
    const offset = Number(url.searchParams.get('offset')) || 0;
    json(res, 200, consoleLog.getEntries(limit, offset));
    return true;
  }

  if (path === '/api/console/stats' && method === 'GET') {
    json(res, 200, consoleLog.getStats());
    return true;
  }

  if (path === '/api/stream' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(':\n\n');

    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));

    const payload = buildDashboardPayload(
      walletManager.listWallets(),
      walletManager.getAllTradeHistories(),
      getLiveMarketPrices(),
      engine?.getPausedWallets(),
      walletDisplayNames,
    );
    const withRecon = attachReconciliationToPayload(payload, deps.db?.loadLatestReconciliationReport() ?? null);
    res.write(`event: dashboard\ndata: ${JSON.stringify(withRecon)}\n\n`);
    return true;
  }

  /* ── Audit Log ── */
  if (path === '/api/audit' && method === 'GET') {
    if (!deps.db) {
      json(res, 503, { ok: false, error: 'Database not available' });
      return true;
    }
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit')) || 200));
    try {
      const events = deps.db.loadAuditEvents(limit);
      json(res, 200, { ok: true, events });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      json(res, 500, { ok: false, error: msg });
    }
    return true;
  }

  /* ── PnL History ── */
  if (path === '/api/pnl/history' && method === 'GET') {
    if (!deps.db) {
      json(res, 503, { ok: false, error: 'Database not available' });
      return true;
    }
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const walletId = url.searchParams.get('wallet_id');
    const limit = Math.min(2000, Math.max(1, Number(url.searchParams.get('limit')) || 500));
    try {
      const rows = walletId
        ? deps.db.loadPnlHistory(walletId, limit)
        : deps.db.loadPnlHistoryAllWallets(limit);
      json(res, 200, { ok: true, snapshots: rows });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      json(res, 500, { ok: false, error: msg });
    }
    return true;
  }

  /* ── Execution Ledger ── */
  if (path === '/api/execution/ledger' && method === 'GET') {
    if (!deps.db) {
      json(res, 503, { ok: false, error: 'Database not available' });
      return true;
    }
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const walletId = url.searchParams.get('wallet_id') ?? undefined;
    const limit = Math.min(5000, Math.max(1, Number(url.searchParams.get('limit')) || 500));
    try {
      const rows = deps.db.loadExecutionLedger(limit, walletId);
      json(res, 200, { ok: true, rows });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      json(res, 500, { ok: false, error: msg });
    }
    return true;
  }

  /* ── Startup Reconciliation ── */
  if (path === '/api/system/reconciliation' && method === 'GET') {
    if (!deps.db) {
      json(res, 503, { ok: false, error: 'Database not available' });
      return true;
    }
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const includeHistory = ['1', 'true', 'yes', 'on'].includes((url.searchParams.get('history') ?? '').toLowerCase());
    const historyLimit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 25));
    try {
      const latest = deps.db.loadLatestReconciliationReport();
      const history = includeHistory ? deps.db.loadReconciliationHistory(historyLimit) : undefined;
      const unresolvedExits = deps.db.loadLifecycleUnresolvedExits();
      const unresolvedWorkQueue = deps.db.loadPendingUnresolvedWorkQueue();
      const unresolvedOrderWorkQueue = deps.db.loadPendingUnresolvedOrderQueue();
      const walletSyncCursors = latest
        ? latest.wallets
            .filter((w) => w.mode === 'LIVE')
            .map((w) => deps.db!.loadWalletSyncCursor(w.walletId))
            .filter((c): c is NonNullable<typeof c> => Boolean(c))
        : [];
      json(res, 200, {
        ok: true,
        latest,
        history,
        unresolvedExits,
        unresolvedWorkQueue,
        unresolvedOrderWorkQueue,
        walletSyncCursors,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      json(res, 500, { ok: false, error: msg });
    }
    return true;
  }

  /* ── Position Lifecycle ── */
  const lifecycleMatch = /^\/api\/wallets\/([^/]+)\/lifecycle$/.exec(path);
  if (lifecycleMatch && method === 'GET') {
    if (!deps.db) {
      json(res, 503, { ok: false, error: 'Database not available' });
      return true;
    }
    const walletId = decodeURIComponent(lifecycleMatch[1]);
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const marketId = url.searchParams.get('market_id') ?? undefined;
    const limit = Math.min(2000, Math.max(1, Number(url.searchParams.get('limit')) || 200));
    try {
      const rows = deps.db.loadPositionLifecycle(walletId, marketId, limit);
      const openPositions = deps.db.loadOpenLifecyclePositions(walletId);
      const unresolvedExits = deps.db.loadLifecycleUnresolvedExits(walletId);
      json(res, 200, { ok: true, rows, openPositions, unresolvedExits });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      json(res, 500, { ok: false, error: msg });
    }
    return true;
  }

  return false;
}
