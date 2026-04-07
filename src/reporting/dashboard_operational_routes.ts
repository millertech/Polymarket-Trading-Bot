import http from 'http';
import { MarketFetcher } from '../data/market_fetcher';
import { buildDashboardPayload } from './dashboard_api';
import { consoleLog } from './console_log';
import type { WhaleAPI } from '../whales/whale_api';
import type { Engine } from '../core/engine';
import { WalletManager } from '../wallets/wallet_manager';

export type DashboardOperationalRouteDeps = {
  walletManager: WalletManager;
  walletDisplayNames: Map<string, string>;
  whaleApi?: WhaleAPI;
  engine?: Engine;
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
    res.write(`event: dashboard\ndata: ${JSON.stringify(payload)}\n\n`);
    return true;
  }

  return false;
}
