import http from 'http';
import { WalletManager } from '../wallets/wallet_manager';
import { buildDashboardPayload } from './dashboard_api';
import { attachReconciliationToPayload } from './dashboard_api';
import { logger } from './logs';
import { recordDashboardApiRateLimited, recordDashboardApiRequest } from './runtime_counters';
import {
  FixedWindowIpRateLimiter,
  readJsonBody,
  resolveDashboardListenHost,
  writeJson as writeJsonResponse,
} from './dashboard_http';
import type { WhaleAPI } from '../whales/whale_api';
import type { Engine } from '../core/engine';
import { CopyTradeStrategy } from '../strategies/copy_trading/copy_trade_strategy';
import { LongshotHunterStrategy } from '../strategies/longshot/longshot_hunter';
import type { KillSwitch } from '../risk/kill_switch';
import type { Database } from '../storage/database';
import { handleDashboardCoreRoutes } from './dashboard_core_routes';
import { handleDashboardWalletRoutes } from './dashboard_wallet_routes';
import { handleDashboardStrategyRoutes } from './dashboard_strategy_routes';
import { handleDashboardTradeRoutes } from './dashboard_trade_routes';
import { handleDashboardOperationalRoutes } from './dashboard_operational_routes';

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */
function json(res: http.ServerResponse, status: number, body: unknown): void {
  writeJsonResponse(res, status, body);
}

/* ──────────────────────────────────────────────────────────────
   Dashboard Server class
   ────────────────────────────────────────────────────────────── */
export class DashboardServer {
  private server?: http.Server;
  private whaleApi?: WhaleAPI;
  private engine?: Engine;
  private db?: Database;
  private sseClients: Set<http.ServerResponse> = new Set();
  private sseInterval?: ReturnType<typeof setInterval>;
  private readonly walletDisplayNames = new Map<string, string>();
  private readonly rateLimiter = new FixedWindowIpRateLimiter();
  private readonly listenHost = resolveDashboardListenHost();

  constructor(
    private readonly walletManager: WalletManager,
    private readonly port = 3000,
    private readonly killSwitch?: KillSwitch,
  ) {}

  setWhaleApi(api: WhaleAPI): void {
    this.whaleApi = api;
  }

  setDatabase(db: Database): void {
    this.db = db;
  }

  setEngine(engine: Engine): void {
    this.engine = engine;
  }

  /** Build a live price map from the orderbook stream cache */
  private getLiveMarketPrices(): Map<string, number> {
    const prices = new Map<string, number>();
    if (this.engine) {
      for (const m of this.engine.getStream().getAllMarkets()) {
        prices.set(m.marketId, m.midPrice);
      }
    }
    return prices;
  }

  private async exitAllOpenPositionsAndStop(): Promise<{
    ok: boolean;
    closedOrders: number;
    failedOrders: number;
    errors: string[];
  }> {
    if (!this.engine) {
      return { ok: false, closedOrders: 0, failedOrders: 0, errors: ['Engine not available'] };
    }

    const errors: string[] = [];
    let closedOrders = 0;
    let failedOrders = 0;

    const wallets = this.walletManager.listWallets();
    for (const w of wallets) {
      this.engine.pauseRunner(w.walletId);
    }

    const priceMap = this.getLiveMarketPrices();

    for (const walletState of wallets) {
      const wallet = this.walletManager.getWallet(walletState.walletId);
      if (!wallet) continue;

      for (const pos of walletState.openPositions.filter((p) => p.size > 0)) {
        const marketPrice = priceMap.get(pos.marketId);
        const exitPrice = Number(
          Math.min(0.99, Math.max(0.01, marketPrice ?? pos.avgPrice ?? 0.5)).toFixed(4),
        );

        try {
          await wallet.placeOrder({
            marketId: pos.marketId,
            outcome: pos.outcome,
            side: 'SELL',
            price: exitPrice,
            size: pos.size,
          });
          closedOrders++;
        } catch (err) {
          failedOrders++;
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${walletState.walletId}:${pos.marketId}:${pos.outcome} -> ${msg}`);
        }
      }
    }

    if (failedOrders > 0) {
      return { ok: false, closedOrders, failedOrders, errors };
    }

    logger.warn({ closedOrders }, 'Kill Switch executed: all positions exited, stopping bot process');
    setTimeout(() => {
      try {
        this.engine?.stop();
        this.stop();
      } finally {
        setTimeout(() => process.exit(0), 250);
      }
    }, 100);

    return { ok: true, closedOrders, failedOrders: 0, errors: [] };
  }

  start(): void {
    if (this.server) return;

    this.server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

      /* preflight */
      if (req.method === 'OPTIONS') {
        json(res, 204, '');
        return;
      }

      try {
        await this.route(req, res, url);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ err: msg }, 'Dashboard request error');
        json(res, 500, { ok: false, error: 'Internal server error' });
      }
    });

    this.server.listen(this.port, this.listenHost, () => {
      if (this.listenHost === '0.0.0.0') {
        logger.warn(
          { port: this.port, host: this.listenHost },
          'Dashboard bound to all network interfaces for remote access',
        );
      }
      logger.info(
        { port: this.port, host: this.listenHost, url: `http://${this.listenHost}:${this.port}/dashboard` },
        'Dashboard server listening',
      );
    });

    // Broadcast dashboard data to SSE clients every second
    this.sseInterval = setInterval(() => {
      if (this.sseClients.size === 0) return;
      const payload = buildDashboardPayload(
        this.walletManager.listWallets(),
        this.walletManager.getAllTradeHistories(),
        this.getLiveMarketPrices(),
        this.engine?.getPausedWallets(),
        this.walletDisplayNames,
      );
      const withRecon = attachReconciliationToPayload(payload, this.db?.loadLatestReconciliationReport() ?? null);
      const data = `event: dashboard\ndata: ${JSON.stringify(withRecon)}\n\n`;
      for (const client of this.sseClients) {
        try {
          client.write(data);
        } catch {
          this.sseClients.delete(client);
        }
      }
    }, 1000);
  }

  stop(): void {
    if (this.sseInterval) {
      clearInterval(this.sseInterval);
      this.sseInterval = undefined;
    }
    for (const client of this.sseClients) {
      try { client.end(); } catch { /* ignore */ }
    }
    this.sseClients.clear();
    if (!this.server) return;
    this.server.close();
    this.server = undefined;
  }

  /* ── Router ── */
  private async route(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
  ): Promise<void> {
    const method = req.method ?? 'GET';
    const path = url.pathname;

    if (path.startsWith('/api/') && method !== 'OPTIONS') {
      recordDashboardApiRequest();
    }

    if (path.startsWith('/api/') && method !== 'OPTIONS' && this.rateLimiter.isRateLimited(req)) {
      recordDashboardApiRateLimited();
      json(res, 429, { ok: false, error: 'Too many requests' });
      return;
    }

    if (await handleDashboardCoreRoutes(req, res, path, method, {
      walletManager: this.walletManager,
      walletDisplayNames: this.walletDisplayNames,
      engine: this.engine,
      db: this.db,
      getLiveMarketPrices: () => this.getLiveMarketPrices(),
      runKillSwitch: async () => {
        this.killSwitch?.activate();
        return this.exitAllOpenPositionsAndStop();
      },
      json,
    })) {
      return;
    }

    if (await handleDashboardWalletRoutes(req, res, path, method, {
      walletManager: this.walletManager,
      engine: this.engine,
      walletDisplayNames: this.walletDisplayNames,
      getLiveMarketPrices: () => this.getLiveMarketPrices(),
      json,
      readJsonBody,
    })) {
      return;
    }

    if (await handleDashboardStrategyRoutes(req, res, path, method, {
      walletManager: this.walletManager,
      json,
      readJsonBody,
      getCopyTradeInstances: () => {
        if (!this.engine) return [];
        return this.engine
          .getStrategiesByName('copy_trade')
          .filter((s): s is CopyTradeStrategy => s instanceof CopyTradeStrategy);
      },
      getLongshotInstances: () => {
        if (!this.engine) return [];
        return this.engine
          .getStrategiesByName('longshot_hunter')
          .filter((s): s is LongshotHunterStrategy => s instanceof LongshotHunterStrategy);
      },
    })) {
      return;
    }

    if (handleDashboardTradeRoutes(req, res, url, path, method, {
      walletManager: this.walletManager,
      walletDisplayNames: this.walletDisplayNames,
      json,
    })) {
      return;
    }

    if (await handleDashboardOperationalRoutes(req, res, path, method, {
      walletManager: this.walletManager,
      walletDisplayNames: this.walletDisplayNames,
      whaleApi: this.whaleApi,
      engine: this.engine,
      db: this.db,
      sseClients: this.sseClients,
      getLiveMarketPrices: () => this.getLiveMarketPrices(),
      json,
    })) {
      return;
    }

    json(res, 404, { error: 'Not found' });
  }
}
