import { afterEach, describe, expect, it } from 'vitest';
import { DashboardServer } from '../src/reporting/dashboard_server';
import { WalletManager } from '../src/wallets/wallet_manager';
import type { WalletState } from '../src/types';
import { resetRuntimeCounters } from '../src/reporting/runtime_counters';

class StubWallet {
  constructor(private readonly state: WalletState) {}

  getState(): WalletState {
    return this.state;
  }

  getTradeHistory() {
    return [];
  }

  async placeOrder(): Promise<void> {
    return;
  }

  updateBalance(): void {
    return;
  }
}

const BASE_STATE: WalletState = {
  walletId: 'paper_test_wallet',
  mode: 'PAPER',
  assignedStrategy: 'momentum',
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
};

function nextPort(): number {
  return 34000 + Math.floor(Math.random() * 5000);
}

async function waitForServer(url: string, timeoutMs = 2000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status > 0) return;
    } catch {
      // retry until timeout
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms: ${url}`);
}

describe('DashboardServer hardening', () => {
  const envBackup: Record<string, string | undefined> = {};
  const servers: DashboardServer[] = [];

  afterEach(() => {
    for (const server of servers.splice(0, servers.length)) {
      server.stop();
    }
    resetRuntimeCounters();

    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
      delete envBackup[key];
    }
  });

  it('binds to all interfaces by default for remote access', () => {
    envBackup.DASHBOARD_BIND_HOST = process.env.DASHBOARD_BIND_HOST;
    delete process.env.DASHBOARD_BIND_HOST;

    const manager = new WalletManager();
    manager.registerExternalWallet(BASE_STATE.walletId, new StubWallet(BASE_STATE));

    const server = new DashboardServer(manager, nextPort());
    servers.push(server);

    expect((server as any).listenHost).toBe('0.0.0.0');
  });

  it('returns hardening headers on API responses', async () => {
    const manager = new WalletManager();
    manager.registerExternalWallet(BASE_STATE.walletId, new StubWallet(BASE_STATE));

    const port = nextPort();
    const server = new DashboardServer(manager, port);
    servers.push(server);
    server.start();

    const url = `http://127.0.0.1:${port}/api/data`;
    await waitForServer(url);

    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('same-origin');
    expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin');
  });

  it('rate-limits API routes by IP', async () => {
    const manager = new WalletManager();
    manager.registerExternalWallet(BASE_STATE.walletId, new StubWallet(BASE_STATE));

    envBackup.DASHBOARD_RATE_LIMIT_MAX_REQUESTS = process.env.DASHBOARD_RATE_LIMIT_MAX_REQUESTS;
    envBackup.DASHBOARD_RATE_LIMIT_WINDOW_MS = process.env.DASHBOARD_RATE_LIMIT_WINDOW_MS;
    process.env.DASHBOARD_RATE_LIMIT_MAX_REQUESTS = '3';
    process.env.DASHBOARD_RATE_LIMIT_WINDOW_MS = '60000';

    const port = nextPort();
    const server = new DashboardServer(manager, port);
    servers.push(server);
    server.start();

    const url = `http://127.0.0.1:${port}/api/data`;
    await waitForServer(url);

    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const response = await fetch(url);
      statuses.push(response.status);
    }

    const okCount = statuses.filter((s) => s === 200).length;
    const limitedCount = statuses.filter((s) => s === 429).length;

    expect(okCount).toBeGreaterThan(0);
    expect(limitedCount).toBeGreaterThan(0);

    const countersResponse = await fetch(`http://127.0.0.1:${port}/api/system/counters`, {
      headers: {
        'x-forwarded-for': '10.99.99.99',
      },
    });
    expect(countersResponse.status).toBe(200);
    const counters = await countersResponse.json() as {
      dashboard: {
        apiRequests: number;
        apiRateLimited: number;
      };
      execution: {
        routeAttempts: number;
        routeLastLatencyAtMs: number;
        submitTimeouts: number;
        submitLastLatencyAtMs: number;
        submitLatencyAvgMs: number;
        routeLatencyP95Ms: number;
        submitLatencyP95Ms: number;
      };
    };
    expect(counters.dashboard.apiRequests).toBeGreaterThan(0);
    expect(counters.dashboard.apiRateLimited).toBeGreaterThan(0);
    expect(counters.execution.routeAttempts).toBeGreaterThanOrEqual(0);
    expect(counters.execution.routeLastLatencyAtMs).toBeGreaterThanOrEqual(0);
    expect(counters.execution.submitTimeouts).toBeGreaterThanOrEqual(0);
    expect(counters.execution.submitLastLatencyAtMs).toBeGreaterThanOrEqual(0);
    expect(counters.execution.submitLatencyAvgMs).toBeGreaterThanOrEqual(0);
    expect(counters.execution.routeLatencyP95Ms).toBeGreaterThanOrEqual(0);
    expect(counters.execution.submitLatencyP95Ms).toBeGreaterThanOrEqual(0);
  });
});
