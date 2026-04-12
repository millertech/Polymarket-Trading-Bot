import http from 'http';
import { attachReconciliationToPayload, buildDashboardPayload } from './dashboard_api';
import { buildDashboardHtmlHeaders } from './dashboard_http';
import { getRuntimeCountersSnapshot } from './runtime_counters';
import { getDashboardHtml } from './dashboard_template';
import { WalletManager } from '../wallets/wallet_manager';
import type { Engine } from '../core/engine';
import type { Database } from '../storage/database';

export type DashboardCoreRouteDeps = {
  walletManager: WalletManager;
  walletDisplayNames: Map<string, string>;
  engine?: Engine;
  db?: Database;
  getLiveMarketPrices: () => Map<string, number>;
  runKillSwitch: () => Promise<{
    ok: boolean;
    closedOrders: number;
    failedOrders: number;
    errors: string[];
  }>;
  json: (res: http.ServerResponse, status: number, body: unknown) => void;
};

export async function handleDashboardCoreRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  path: string,
  method: string,
  deps: DashboardCoreRouteDeps,
): Promise<boolean> {
  const {
    walletManager,
    walletDisplayNames,
    engine,
    db,
    getLiveMarketPrices,
    runKillSwitch,
    json,
  } = deps;

  if (path === '/' || path === '/dashboard') {
    res.writeHead(200, buildDashboardHtmlHeaders());
    res.end(getDashboardHtml());
    return true;
  }

  if (path === '/api/data' && method === 'GET') {
    const payload = buildDashboardPayload(
      walletManager.listWallets(),
      walletManager.getAllTradeHistories(),
      getLiveMarketPrices(),
      engine?.getPausedWallets(),
      walletDisplayNames,
    );
    const withRecon = attachReconciliationToPayload(payload, db?.loadLatestReconciliationReport() ?? null);
    json(res, 200, withRecon);
    return true;
  }

  if (path === '/api/system/counters' && method === 'GET') {
    json(res, 200, getRuntimeCountersSnapshot());
    return true;
  }

  if (path === '/api/kill-switch' && method === 'POST') {
    const result = await runKillSwitch();
    if (!result.ok) {
      json(res, 500, {
        ok: false,
        error: 'Failed to close all positions. Bot was not stopped.',
        closedOrders: result.closedOrders,
        failedOrders: result.failedOrders,
        errors: result.errors,
      });
    } else {
      json(res, 200, {
        ok: true,
        message: 'Kill Switch executed. All open positions were exited. Bot is stopping.',
        closedOrders: result.closedOrders,
        failedOrders: result.failedOrders,
        errors: result.errors,
      });
    }
    return true;
  }

  return false;
}
