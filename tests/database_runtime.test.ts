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

  it('persists and queries execution ledger rows', async () => {
    const db = new Database(makeDbPath());
    await db.connect();

    db.appendExecutionIntent({
      intent_id: 'intent-1',
      wallet_id: 'w-live-1',
      strategy_name: 'momentum',
      market_id: 'POLY-ABC',
      outcome: 'YES',
      side: 'BUY',
      price: 0.42,
      size: 10,
    });
    db.appendExecutionSubmission({
      submission_id: 'sub-1',
      intent_id: 'intent-1',
      wallet_id: 'w-live-1',
      status: 'submit_attempted',
    });
    db.appendExecutionEvent({
      intent_id: 'intent-1',
      submission_id: 'sub-1',
      event_type: 'submit_accepted',
    });
    db.appendExecutionFill({
      intent_id: 'intent-1',
      submission_id: 'sub-1',
      exchange_order_id: 'ex-1',
      fill_id: 'fill-1',
      wallet_id: 'w-live-1',
      market_id: 'POLY-ABC',
      outcome: 'YES',
      side: 'BUY',
      price: 0.42,
      size: 10,
    });

    const allRows = db.loadExecutionLedger(50);
    expect(allRows.length).toBeGreaterThanOrEqual(4);

    const walletRows = db.loadExecutionLedger(50, 'w-live-1');
    expect(walletRows.length).toBeGreaterThanOrEqual(4);
    expect(walletRows.some((r) => r.kind === 'intent' && r.intent_id === 'intent-1')).toBe(true);
    expect(walletRows.some((r) => r.kind === 'fill' && r.exchange_order_id === 'ex-1')).toBe(true);

    await db.close();
  });

  it('persists and loads reconciliation reports', async () => {
    const db = new Database(makeDbPath());
    await db.connect();

    const report = {
      status: 'yellow' as const,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      wallets: [
        {
          walletId: 'live_1',
          mode: 'LIVE' as const,
          status: 'yellow' as const,
          localOpenPositions: 1,
          localTrades: 3,
          exchangeOpenOrders: 0,
          exchangeRecentFills: 2,
          notes: ['exchange open orders unavailable'],
        },
      ],
      summary: {
        totalWallets: 1,
        liveWallets: 1,
        redWallets: 0,
        yellowWallets: 1,
        greenWallets: 0,
      },
    };

    db.saveReconciliationReport(report);

    const latest = db.loadLatestReconciliationReport();
    expect(latest).not.toBeNull();
    expect(latest?.status).toBe('yellow');
    expect(latest?.wallets[0].walletId).toBe('live_1');

    const history = db.loadReconciliationHistory(10);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].summary.liveWallets).toBe(1);

    await db.close();
  });

  it('deduplicates submissions and exchange events by idempotency keys', async () => {
    const db = new Database(makeDbPath());
    await db.connect();

    db.appendExecutionIntent({
      intent_id: 'intent-dedupe-1',
      wallet_id: 'w-live-1',
      strategy_name: 'momentum',
      market_id: 'POLY-XYZ',
      outcome: 'YES',
      side: 'BUY',
      price: 0.2,
      size: 5,
    });

    db.appendExecutionSubmission({
      submission_id: 'sub-dedupe-1',
      intent_id: 'intent-dedupe-1',
      wallet_id: 'w-live-1',
      dedupe_key: 'intent-dedupe-1:submit_attempted',
      status: 'submit_attempted',
    });
    db.appendExecutionSubmission({
      submission_id: 'sub-dedupe-2',
      intent_id: 'intent-dedupe-1',
      wallet_id: 'w-live-1',
      dedupe_key: 'intent-dedupe-1:submit_attempted',
      status: 'submit_attempted',
    });

    db.appendExecutionEvent({
      intent_id: 'intent-dedupe-1',
      submission_id: 'sub-dedupe-1',
      exchange_event_id: 'evt-1',
      event_type: 'submit_attempted',
    });
    db.appendExecutionEvent({
      intent_id: 'intent-dedupe-1',
      submission_id: 'sub-dedupe-1',
      exchange_event_id: 'evt-1',
      event_type: 'submit_attempted',
    });

    const ledger = db.loadExecutionLedger(100, 'w-live-1');
    const submissionRows = ledger.filter((r) => r.kind === 'submission' && r.intent_id === 'intent-dedupe-1');
    const eventRows = ledger.filter((r) => r.kind === 'event' && r.intent_id === 'intent-dedupe-1');

    expect(submissionRows).toHaveLength(1);
    expect(eventRows).toHaveLength(1);

    await db.close();
  });

  it('persists per-wallet sync cursors for replay-safe startup sync', async () => {
    const db = new Database(makeDbPath());
    await db.connect();

    db.saveWalletSyncCursor('live_1', '2026-04-11T23:59:59.000Z', 'startup_reconciliation');
    const loaded = db.loadWalletSyncCursor('live_1');

    expect(loaded).not.toBeNull();
    expect(loaded?.walletId).toBe('live_1');
    expect(loaded?.cursor).toBe('2026-04-11T23:59:59.000Z');
    expect(loaded?.source).toBe('startup_reconciliation');

    await db.close();
  });

  it('persists unresolved work queue and marks resolved vs pending after attempt', async () => {
    const db = new Database(makeDbPath());
    await db.connect();

    db.enqueueUnresolvedWorkItems([
      {
        walletId: 'live_1',
        marketId: 'mkt-1',
        outcome: 'YES',
        size: 12,
        reason: 'kill-switch activated',
        source: 'emergency_close',
      },
      {
        walletId: 'live_2',
        marketId: 'mkt-2',
        outcome: 'NO',
        size: 4,
        reason: 'startup unresolved queue drain',
        source: 'startup_reconcile',
      },
    ]);

    const pending = db.loadPendingUnresolvedWorkQueue();
    expect(pending).toHaveLength(2);

    const result = db.recordUnresolvedWorkQueueAttempt([
      { walletId: 'live_2', marketId: 'mkt-2', outcome: 'NO', size: 4 },
    ]);

    expect(result.resolved).toBe(1);
    expect(result.pending).toBe(1);

    const pendingAfter = db.loadPendingUnresolvedWorkQueue();
    expect(pendingAfter).toHaveLength(1);
    expect(pendingAfter[0].walletId).toBe('live_2');
    expect(pendingAfter[0].attempts).toBe(1);

    await db.close();
  });

  it('persists unresolved order queue and tracks pending/resolved by order id', async () => {
    const db = new Database(makeDbPath());
    await db.connect();

    db.enqueueUnresolvedOrderItems([
      {
        walletId: 'live_1',
        exchangeOrderId: 'ord-1',
        reason: 'exchange open orders exceed local open positions',
        source: 'startup_reconcile',
      },
      {
        walletId: 'live_2',
        exchangeOrderId: 'ord-2',
        reason: 'exchange open orders exceed local open positions',
        source: 'startup_reconcile',
      },
    ]);

    const pending = db.loadPendingUnresolvedOrderQueue();
    expect(pending).toHaveLength(2);

    const attempt = db.recordUnresolvedOrderQueueAttempt([
      { walletId: 'live_2', exchangeOrderId: 'ord-2' },
    ]);
    expect(attempt.resolved).toBe(1);
    expect(attempt.pending).toBe(1);

    const pendingAfter = db.loadPendingUnresolvedOrderQueue();
    expect(pendingAfter).toHaveLength(1);
    expect(pendingAfter[0].walletId).toBe('live_2');
    expect(pendingAfter[0].attempts).toBe(1);

    await db.close();
  });
});
