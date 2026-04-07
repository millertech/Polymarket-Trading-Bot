import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { Database } from '../src/storage/database';
import type { WalletRuntimeSnapshot } from '../src/wallets/wallet_manager';
import type { RuntimeCountersPersistedState } from '../src/reporting/runtime_counters';

const tmpDirs: string[] = [];

function makeDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'polybot-dbtest-'));
  tmpDirs.push(dir);
  return path.join(dir, 'runtime.sqlite');
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0, tmpDirs.length)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

describe('Database runtime persistence', () => {
  it('saves and reloads runtime snapshot', async () => {
    const db = new Database(makeDbPath());
    await db.connect();

    const snapshot: WalletRuntimeSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      wallets: [
        {
          walletId: 'w1',
          displayName: 'Wallet One',
          state: {
            walletId: 'w1',
            mode: 'PAPER',
            assignedStrategy: 'momentum',
            capitalAllocated: 1000,
            availableBalance: 950,
            openPositions: [],
            realizedPnl: 10,
            riskLimits: {
              maxPositionSize: 100,
              maxExposurePerMarket: 200,
              maxDailyLoss: 100,
              maxOpenTrades: 5,
              maxDrawdown: 0.2,
            },
          },
          trades: [],
        },
      ],
    };

    await db.saveRuntimeSnapshot(snapshot);
    const loaded = await db.loadRuntimeSnapshot();

    expect(loaded).not.toBeNull();
    expect(loaded?.wallets).toHaveLength(1);
    expect(loaded?.wallets[0].walletId).toBe('w1');

    await db.close();
  });

  it('persists and reloads kill-switch state', async () => {
    const db = new Database(makeDbPath());
    await db.connect();

    await db.saveKillSwitchState(true);
    expect(await db.loadKillSwitchState()).toBe(true);

    await db.saveKillSwitchState(false);
    expect(await db.loadKillSwitchState()).toBe(false);

    await db.close();
  });

  it('clears runtime snapshot when requested', async () => {
    const db = new Database(makeDbPath());
    await db.connect();

    const snapshot: WalletRuntimeSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      wallets: [],
    };

    await db.saveRuntimeSnapshot(snapshot);
    expect(await db.loadRuntimeSnapshot()).not.toBeNull();

    await db.clearRuntimeSnapshot();
    expect(await db.loadRuntimeSnapshot()).toBeNull();

    await db.close();
  });

  it('persists and reloads execution counters state', async () => {
    const db = new Database(makeDbPath());
    await db.connect();

    const state: RuntimeCountersPersistedState = {
      version: 1,
      counters: {
        dashboard: {
          apiRequests: 7,
          apiRateLimited: 2,
        },
        orderRouter: {
          riskRejections: 1,
          riskLogSuppressed: 0,
        },
        whaleIngestion: {
          clob4xxLogSuppressed: 3,
          authCircuitOpened: 1,
          authCircuitShortCircuits: 2,
        },
        execution: {
          routeAttempts: 3,
          routeSuccesses: 2,
          routeFailures: 1,
          routeLastAttemptAtMs: Date.now(),
          routeLastLatencyAtMs: Date.now(),
          routeLatencyAvgMs: 12,
          routeLatencyMaxMs: 30,
          routeLatencyRecentAvgMs: 14,
          routeLatencyP95Ms: 30,
          routeLatencyP99Ms: 30,
          submitAttempts: 2,
          submitFailures: 1,
          submitTimeouts: 1,
          submitLastAttemptAtMs: Date.now(),
          submitLastLatencyAtMs: Date.now(),
          submitLatencyAvgMs: 22,
          submitLatencyMaxMs: 40,
          submitLatencyRecentAvgMs: 22,
          submitLatencyP95Ms: 40,
          submitLatencyP99Ms: 40,
        },
      },
      executionStats: {
        routeLatencyTotalMs: 36,
        routeLatencySamples: 3,
        routeLatencyRolling: [3, 3, 30],
        submitLatencyTotalMs: 44,
        submitLatencySamples: 2,
        submitLatencyRolling: [4, 40],
      },
    };

    await db.saveExecutionCountersState(state);
    const loaded = await db.loadExecutionCountersState();

    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(1);
    expect(loaded?.counters.execution.routeAttempts).toBe(3);
    expect(loaded?.executionStats.submitLatencyRolling).toHaveLength(2);

    await db.close();
  });
});
