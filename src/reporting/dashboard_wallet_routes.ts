import http from 'http';
import { WalletManager } from '../wallets/wallet_manager';
import { PaperWallet } from '../wallets/paper_wallet';
import { PolymarketWallet } from '../wallets/polymarket_wallet';
import { listStrategies } from '../strategies/registry';
import { buildWalletDetail } from './dashboard_wallet_detail';
import type { Engine } from '../core/engine';

type JsonWriter = (res: http.ServerResponse, status: number, body: unknown) => void;
type JsonBodyReader = (req: http.IncomingMessage) => Promise<Record<string, unknown>>;

export type DashboardWalletRouteDeps = {
  walletManager: WalletManager;
  engine?: Engine;
  walletDisplayNames: Map<string, string>;
  getLiveMarketPrices: () => Map<string, number>;
  json: JsonWriter;
  readJsonBody: JsonBodyReader;
};

export async function handleDashboardWalletRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  path: string,
  method: string,
  deps: DashboardWalletRouteDeps,
): Promise<boolean> {
  const { walletManager, engine, walletDisplayNames, getLiveMarketPrices, json, readJsonBody } = deps;

  if (path === '/api/wallets' && method === 'GET') {
    json(res, 200, walletManager.listWallets());
    return true;
  }

  if (path === '/api/wallets' && method === 'POST') {
    const body = await readJsonBody(req);
    const walletId = String(body.walletId ?? '').trim();
    const strategy = String(body.strategy ?? '').trim();
    const capital = Number(body.capital ?? 0);
    const mode = String(body.mode ?? 'PAPER').toUpperCase();

    if (!walletId || !strategy || capital <= 0) {
      json(res, 400, {
        ok: false,
        error: 'walletId (string), strategy (string), and capital (>0) are required',
      });
      return true;
    }

    const knownStrategies = listStrategies();
    if (!knownStrategies.includes(strategy)) {
      json(res, 400, {
        ok: false,
        error: `Unknown strategy "${strategy}". Available: ${knownStrategies.join(', ')}`,
      });
      return true;
    }

    if (mode === 'LIVE' && process.env.ENABLE_LIVE_TRADING !== 'true') {
      json(res, 403, {
        ok: false,
        error: 'LIVE trading is disabled. Set ENABLE_LIVE_TRADING=true to enable.',
      });
      return true;
    }

    const existing = walletManager.listWallets().find((w) => w.walletId === walletId);
    if (existing) {
      json(res, 409, { ok: false, error: `Wallet "${walletId}" already exists` });
      return true;
    }

    const maxPos = Number(body.maxPositionSize ?? capital * 0.2);
    const maxExp = Number(body.maxExposurePerMarket ?? capital * 0.3);
    const maxLoss = Number(body.maxDailyLoss ?? capital * 0.1);
    const maxTrades = Number(body.maxOpenTrades ?? 10);
    const maxDd = Number(body.maxDrawdown ?? 0.2);

    const walletConfig = {
      id: walletId,
      mode: mode === 'LIVE' ? 'LIVE' as const : 'PAPER' as const,
      strategy,
      capital,
      riskLimits: {
        maxPositionSize: maxPos,
        maxExposurePerMarket: maxExp,
        maxDailyLoss: maxLoss,
        maxOpenTrades: maxTrades,
        maxDrawdown: maxDd,
      },
    };
    const wallet = mode === 'LIVE'
      ? new PolymarketWallet(walletConfig, strategy)
      : new PaperWallet(walletConfig, strategy);
    walletManager.addWallet(wallet);

    if (engine) {
      engine.addRunner(walletId, strategy);
    }

    json(res, 201, { ok: true, message: `Wallet "${walletId}" created (${mode}, ${strategy}, $${capital})` });
    return true;
  }

  if (path.startsWith('/api/wallets/') && !path.includes('/detail') && !path.includes('/pause') && !path.includes('/resume') && method === 'DELETE') {
    const walletId = decodeURIComponent(path.slice('/api/wallets/'.length));
    if (engine) {
      engine.removeRunner(walletId);
    }
    const removed = walletManager.removeWallet(walletId);
    if (removed) {
      json(res, 200, { ok: true, message: `Wallet "${walletId}" removed` });
    } else {
      json(res, 404, { ok: false, error: `Wallet "${walletId}" not found` });
    }
    return true;
  }

  if (path.match(/^\/api\/wallets\/[^/]+\/pause$/) && method === 'POST') {
    const walletId = decodeURIComponent(path.split('/')[3]);
    if (!engine) {
      json(res, 500, { ok: false, error: 'Engine not available' });
      return true;
    }
    const ok = engine.pauseRunner(walletId);
    if (ok) {
      json(res, 200, { ok: true, paused: true, message: `Wallet "${walletId}" paused` });
    } else {
      json(res, 404, { ok: false, error: `Runner for "${walletId}" not found` });
    }
    return true;
  }

  if (path.match(/^\/api\/wallets\/[^/]+\/resume$/) && method === 'POST') {
    const walletId = decodeURIComponent(path.split('/')[3]);
    if (!engine) {
      json(res, 500, { ok: false, error: 'Engine not available' });
      return true;
    }
    const ok = engine.resumeRunner(walletId);
    if (ok) {
      json(res, 200, { ok: true, paused: false, message: `Wallet "${walletId}" resumed` });
    } else {
      json(res, 404, { ok: false, error: `Runner for "${walletId}" not found or not paused` });
    }
    return true;
  }

  if (path.match(/^\/api\/wallets\/[^/]+\/reset$/) && method === 'POST') {
    const walletId = decodeURIComponent(path.split('/')[3]);
    const wallet = walletManager.getWallet(walletId);
    if (!wallet) {
      json(res, 404, { ok: false, error: `Wallet "${walletId}" not found` });
      return true;
    }
    if (typeof wallet.resetRuntimeState !== 'function') {
      json(res, 400, { ok: false, error: 'This wallet type does not support runtime reset' });
      return true;
    }

    const wasPaused = engine?.isRunnerPaused(walletId) ?? false;
    if (engine && !wasPaused) {
      engine.pauseRunner(walletId);
    }

    try {
      wallet.resetRuntimeState();
      json(res, 200, {
        ok: true,
        message: `Wallet "${walletId}" runtime state reset`,
        paused: wasPaused,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      json(res, 500, { ok: false, error: `Failed to reset wallet "${walletId}": ${reason}` });
    } finally {
      if (engine && !wasPaused) {
        engine.resumeRunner(walletId);
      }
    }

    return true;
  }

  if (path.match(/^\/api\/wallets\/[^/]+\/detail$/) && method === 'GET') {
    const walletId = decodeURIComponent(path.split('/')[3]);
    const walletState = walletManager.listWallets().find((w) => w.walletId === walletId);
    if (!walletState) {
      json(res, 404, { ok: false, error: `Wallet "${walletId}" not found` });
      return true;
    }
    const trades = walletManager.getTradeHistory(walletId);
    const detail = buildWalletDetail(walletState, trades, getLiveMarketPrices());
    const walletObj = walletManager.getWallet(walletId);
    (detail.wallet as Record<string, unknown>).displayName =
      walletDisplayNames.get(walletId) ??
      (typeof walletObj?.getDisplayName === 'function' ? walletObj.getDisplayName() : walletId);
    (detail.wallet as Record<string, unknown>).paused =
      engine?.isRunnerPaused(walletId) ?? false;
    json(res, 200, detail);
    return true;
  }

  if (path.match(/^\/api\/wallets\/[^/]+$/) && method === 'PATCH') {
    const walletId = decodeURIComponent(path.slice('/api/wallets/'.length));
    const wallet = walletManager.getWallet(walletId);
    if (!wallet) {
      json(res, 404, { ok: false, error: `Wallet "${walletId}" not found` });
      return true;
    }
    const body = await readJsonBody(req);
    const changes: string[] = [];

    if (typeof body.displayName === 'string') {
      const name = body.displayName.trim();
      if (name) {
        walletDisplayNames.set(walletId, name);
        if (typeof wallet.setDisplayName === 'function') wallet.setDisplayName(name);
        changes.push(`displayName → "${name}"`);
      }
    }

    if (body.riskLimits && typeof body.riskLimits === 'object') {
      if (typeof wallet.updateRiskLimits === 'function') {
        const rl: Record<string, number> = {};
        const rlBody = body.riskLimits as Record<string, unknown>;
        for (const key of ['maxPositionSize', 'maxExposurePerMarket', 'maxDailyLoss', 'maxOpenTrades', 'maxDrawdown']) {
          if (rlBody[key] !== undefined && typeof rlBody[key] === 'number') {
            rl[key] = rlBody[key] as number;
          }
        }
        if (Object.keys(rl).length > 0) {
          wallet.updateRiskLimits(rl);
          changes.push(`riskLimits updated: ${Object.entries(rl).map(([k, v]) => `${k}=${v}`).join(', ')}`);
        }
      } else {
        json(res, 400, { ok: false, error: 'This wallet type does not support risk limit updates' });
        return true;
      }
    }

    if (changes.length === 0) {
      json(res, 400, { ok: false, error: 'No valid fields to update. Supported: displayName, riskLimits' });
      return true;
    }

    json(res, 200, { ok: true, message: `Wallet "${walletId}" updated: ${changes.join('; ')}` });
    return true;
  }

  if (path === '/api/wallets/display-names' && method === 'GET') {
    const names: Record<string, string> = {};
    for (const [id, name] of walletDisplayNames) {
      names[id] = name;
    }
    json(res, 200, names);
    return true;
  }

  return false;
}