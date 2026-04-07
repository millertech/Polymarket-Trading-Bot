import http from 'http';
import { WalletManager } from '../wallets/wallet_manager';
import { MarketFetcher } from '../data/market_fetcher';
import { buildDashboardPayload } from './dashboard_api';
import { logger } from './logs';
import { consoleLog } from './console_log';
import { getRuntimeCountersSnapshot, recordDashboardApiRateLimited, recordDashboardApiRequest } from './runtime_counters';
import {
  buildDashboardHtmlHeaders,
  FixedWindowIpRateLimiter,
  readJsonBody,
  resolveDashboardListenHost,
  writeJson as writeJsonResponse,
} from './dashboard_http';
import type { WhaleAPI } from '../whales/whale_api';
import type { Engine } from '../core/engine';
import { CopyTradeStrategy } from '../strategies/copy_trading/copy_trade_strategy';
import type { KillSwitch } from '../risk/kill_switch';
import { getDashboardHtml } from './dashboard_template';
import { handleDashboardWalletRoutes } from './dashboard_wallet_routes';
import { handleDashboardStrategyRoutes } from './dashboard_strategy_routes';

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
      const data = `event: dashboard\ndata: ${JSON.stringify(payload)}\n\n`;
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

    /* ─── HTML pages ─── */
    if (path === '/' || path === '/dashboard') {
      res.writeHead(200, buildDashboardHtmlHeaders());
      res.end(getDashboardHtml());
      return;
    }

    /* ─── JSON: overview data (used by Dashboard tab) ─── */
    if (path === '/api/data' && method === 'GET') {
      json(res, 200, buildDashboardPayload(
        this.walletManager.listWallets(),
        this.walletManager.getAllTradeHistories(),
        this.getLiveMarketPrices(),
        this.engine?.getPausedWallets(),
        this.walletDisplayNames,
      ));
      return;
    }

    if (path === '/api/system/counters' && method === 'GET') {
      json(res, 200, getRuntimeCountersSnapshot());
      return;
    }

    /* ─── JSON: global kill switch (exit all positions, then stop bot) ─── */
    if (path === '/api/kill-switch' && method === 'POST') {
      this.killSwitch?.activate();
      const result = await this.exitAllOpenPositionsAndStop();
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
    })) {
      return;
    }

    /* ─── JSON: all trades across all wallets (for Trade Log) ─── */
    if (path === '/api/trades/all' && method === 'GET') {
      const allTradesMap = this.walletManager.getAllTradeHistories();
      const wallets = this.walletManager.listWallets();
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
          this.walletDisplayNames.get(walletId) ?? ws?.assignedStrategy ?? walletId;
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
      return;
    }

    /* ─── JSON: trade history for a specific wallet ─── */
    if (path.startsWith('/api/trades/') && method === 'GET') {
      const walletId = decodeURIComponent(path.slice('/api/trades/'.length));
      const trades = this.walletManager.getTradeHistory(walletId);
      const walletState = this.walletManager.listWallets().find((w) => w.walletId === walletId);
      if (!walletState) {
        json(res, 404, { ok: false, error: `Wallet "${walletId}" not found` });
        return;
      }

      /* compute summary stats */
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
      return;
    }

    /* ─── JSON: live markets from Polymarket Gamma API ─── */
    if (path === '/api/markets' && method === 'GET') {
      try {
        const fetcher = new MarketFetcher();
        const markets = await fetcher.fetchSnapshot();
        json(res, 200, markets);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        json(res, 500, { ok: false, error: msg });
      }
      return;
    }

    /* ─── Whale API routes (delegated) ─── */
    if (path.startsWith('/api/whales') && this.whaleApi) {
      const handled = await this.whaleApi.handleRequest(req, res);
      if (handled) return;
    }

    /* ─── Console API routes ─── */
    if (path === '/api/console/stream' && method === 'GET') {
      consoleLog.addSSEClient(res);
      return;                // SSE connection stays open
    }

    if (path === '/api/console/logs' && method === 'GET') {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
      const limit = Number(url.searchParams.get('limit')) || 500;
      const offset = Number(url.searchParams.get('offset')) || 0;
      json(res, 200, consoleLog.getEntries(limit, offset));
      return;
    }

    if (path === '/api/console/stats' && method === 'GET') {
      json(res, 200, consoleLog.getStats());
      return;
    }

    /* ─── SSE: Real-time dashboard data stream ─── */
    if (path === '/api/stream' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(':\n\n');  // comment to establish connection

      this.sseClients.add(res);
      req.on('close', () => this.sseClients.delete(res));

      // Send initial data immediately
      const payload = buildDashboardPayload(
        this.walletManager.listWallets(),
        this.walletManager.getAllTradeHistories(),
        this.getLiveMarketPrices(),
        this.engine?.getPausedWallets(),
        this.walletDisplayNames,
      );
      res.write(`event: dashboard\ndata: ${JSON.stringify(payload)}\n\n`);
      return;
    }

    json(res, 404, { error: 'Not found' });
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Full HTML Dashboard — three-tab SPA
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
