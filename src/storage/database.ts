import BetterSqlite3 from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { WalletState, type OrderExitReason } from '../types';
import type { WalletRuntimeSnapshot } from '../wallets/wallet_manager';
import type { RuntimeCountersPersistedState } from '../reporting/runtime_counters';

export interface AuditEvent {
  event_type: string;  // e.g. 'kill_switch_on', 'kill_switch_off', 'emergency_close', 'wallet_add', 'wallet_remove'
  actor: string;       // 'system', 'dashboard', 'cli', wallet ID, etc.
  market_id?: string;
  details?: Record<string, unknown>;
}

export interface AuditEventRow extends AuditEvent {
  id: number;
  created_at: string;
}

export interface PnlSnapshotRow {
  id: number;
  wallet_id: string;
  balance: number;
  realized_pnl: number;
  open_positions_count: number;
  drawdown_pct: number;
  snapshot_at: string;
}

export interface ExecutionIntentInput {
  intent_id: string;
  wallet_id: string;
  strategy_name: string;
  strategy_run_id?: string;
  market_id: string;
  token_id?: string;
  outcome: 'YES' | 'NO';
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
}

export interface ExecutionSubmissionInput {
  submission_id: string;
  intent_id: string;
  wallet_id: string;
  exchange_order_id?: string;
  dedupe_key?: string;
  status: string;
  error_text?: string;
}

export interface ExecutionEventInput {
  intent_id: string;
  submission_id?: string;
  exchange_event_id?: string;
  event_type: string;
  status_text?: string;
  details?: Record<string, unknown>;
}

export interface WalletSyncCursor {
  walletId: string;
  cursor: string;
  source: 'startup_reconciliation' | 'exchange_sync';
  updatedAt: string;
}

export interface UnresolvedWorkQueueItem {
  id: string;
  walletId: string;
  marketId: string;
  outcome: 'YES' | 'NO';
  size: number;
  reason: string;
  source: 'emergency_close' | 'startup_reconcile' | 'manual';
  status: 'pending' | 'resolved';
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt?: string;
}

export interface UnresolvedOrderQueueItem {
  id: string;
  walletId: string;
  exchangeOrderId?: string;
  marketId?: string;
  outcome?: 'YES' | 'NO';
  reason: string;
  source: 'startup_reconcile' | 'manual';
  status: 'pending' | 'resolved';
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
}

export interface ExecutionFillInput {
  intent_id: string;
  submission_id?: string;
  exchange_order_id?: string;
  fill_id?: string;
  wallet_id: string;
  market_id: string;
  outcome: 'YES' | 'NO';
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  fee_usd?: number;
  fill_ts?: string;
}

export interface ExecutionLedgerRow {
  id: number;
  kind: 'intent' | 'submission' | 'event' | 'fill';
  intent_id: string;
  submission_id?: string;
  wallet_id?: string;
  market_id?: string;
  strategy_name?: string;
  event_type?: string;
  status?: string;
  side?: string;
  outcome?: string;
  price?: number;
  size?: number;
  exchange_order_id?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export type PositionLifecycleEventType = 'entry_open' | 'scale_in' | 'partial_exit' | 'flat' | 'exit_failed';
export type ExitReason = OrderExitReason | 'emergency_close';

export interface PositionLifecycleInput {
  intent_id?: string;
  parent_intent_id?: string;
  wallet_id: string;
  market_id: string;
  outcome: 'YES' | 'NO';
  event_type: PositionLifecycleEventType;
  size: number;
  price: number;
  exit_reason?: ExitReason;
  strategy_name?: string;
  exchange_order_id?: string;
  notes?: string;
}

export interface PositionLifecycleRow extends PositionLifecycleInput {
  id: number;
  created_at: string;
}

export interface ReconciliationWalletReport {
  walletId: string;
  mode: 'LIVE' | 'PAPER';
  status: 'green' | 'yellow' | 'red';
  localOpenPositions: number;
  localTrades: number;
  ledgerOpenPositions?: number;
  ledgerFills?: number;
  exchangeOpenOrders?: number;
  exchangeRecentFills?: number;
  exchangeBalanceUsd?: number;
  notes: string[];
}

export interface ReconciliationReport {
  status: 'green' | 'yellow' | 'red';
  startedAt: string;
  completedAt: string;
  wallets: ReconciliationWalletReport[];
  summary: {
    totalWallets: number;
    liveWallets: number;
    redWallets: number;
    yellowWallets: number;
    greenWallets: number;
  };
}

export class Database {
  private db?: BetterSqlite3.Database;

  constructor(private readonly dbPath = path.resolve('.runtime/bot-state.sqlite')) {}

  async connect(): Promise<void> {
    if (this.db) return;
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new BetterSqlite3(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runtime_wallet_snapshot (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        snapshot_json TEXT NOT NULL,
        saved_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS runtime_state (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS runtime_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        actor TEXT NOT NULL,
        market_id TEXT,
        details_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pnl_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_id TEXT NOT NULL,
        balance REAL NOT NULL,
        realized_pnl REAL NOT NULL,
        open_positions_count INTEGER NOT NULL,
        drawdown_pct REAL NOT NULL,
        snapshot_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_runtime_audit_created ON runtime_audit(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_pnl_snapshots_wallet ON pnl_snapshots(wallet_id, snapshot_at DESC);

      CREATE TABLE IF NOT EXISTS order_intents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        intent_id TEXT NOT NULL UNIQUE,
        wallet_id TEXT NOT NULL,
        strategy_name TEXT NOT NULL,
        strategy_run_id TEXT,
        market_id TEXT NOT NULL,
        token_id TEXT,
        outcome TEXT NOT NULL,
        side TEXT NOT NULL,
        price REAL NOT NULL,
        size REAL NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS order_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id TEXT NOT NULL UNIQUE,
        intent_id TEXT NOT NULL,
        wallet_id TEXT NOT NULL,
        exchange_order_id TEXT,
        dedupe_key TEXT,
        status TEXT NOT NULL,
        error_text TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(intent_id) REFERENCES order_intents(intent_id)
      );

      CREATE TABLE IF NOT EXISTS order_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        intent_id TEXT NOT NULL,
        submission_id TEXT,
        exchange_event_id TEXT,
        event_type TEXT NOT NULL,
        status_text TEXT,
        details_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(intent_id) REFERENCES order_intents(intent_id)
      );

      CREATE TABLE IF NOT EXISTS fill_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        intent_id TEXT NOT NULL,
        submission_id TEXT,
        exchange_order_id TEXT,
        fill_id TEXT,
        wallet_id TEXT NOT NULL,
        market_id TEXT NOT NULL,
        outcome TEXT NOT NULL,
        side TEXT NOT NULL,
        price REAL NOT NULL,
        size REAL NOT NULL,
        fee_usd REAL,
        fill_ts TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(intent_id) REFERENCES order_intents(intent_id)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_fill_events_fill_id ON fill_events(fill_id) WHERE fill_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_order_submissions_dedupe_key ON order_submissions(dedupe_key) WHERE dedupe_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_order_events_exchange_event_id ON order_events(exchange_event_id) WHERE exchange_event_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_order_intents_wallet_created ON order_intents(wallet_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_order_submissions_intent_created ON order_submissions(intent_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_order_events_intent_created ON order_events(intent_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_fill_events_intent_created ON fill_events(intent_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS position_lifecycle (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        intent_id TEXT,
        parent_intent_id TEXT,
        wallet_id TEXT NOT NULL,
        market_id TEXT NOT NULL,
        outcome TEXT NOT NULL,
        event_type TEXT NOT NULL,
        size REAL NOT NULL,
        price REAL NOT NULL,
        exit_reason TEXT,
        strategy_name TEXT,
        exchange_order_id TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(intent_id) REFERENCES order_intents(intent_id)
      );
      CREATE INDEX IF NOT EXISTS idx_position_lifecycle_wallet_market ON position_lifecycle(wallet_id, market_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_position_lifecycle_created ON position_lifecycle(created_at DESC);

      CREATE TABLE IF NOT EXISTS runtime_reconciliation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT NOT NULL,
        report_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_runtime_reconciliation_created ON runtime_reconciliation(created_at DESC);
    `);

    // Lightweight migrations for existing runtime DBs.
    this.ensureColumnExists('order_submissions', 'dedupe_key', 'TEXT');
    this.ensureColumnExists('order_events', 'exchange_event_id', 'TEXT');
    this.ensureColumnExists('position_lifecycle', 'parent_intent_id', 'TEXT');
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_order_submissions_dedupe_key ON order_submissions(dedupe_key) WHERE dedupe_key IS NOT NULL');
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_order_events_exchange_event_id ON order_events(exchange_event_id) WHERE exchange_event_id IS NOT NULL');
  }

  async close(): Promise<void> {
    if (!this.db) return;
    this.db.close();
    this.db = undefined;
  }

  async saveWallets(wallets: WalletState[]): Promise<void> {
    this.ensureConnected();
    this.saveRuntimeValue('wallets_array', wallets);
  }

  async loadWallets(): Promise<WalletState[]> {
    this.ensureConnected();
    const wallets = this.loadRuntimeValue<WalletState[]>('wallets_array');
    return Array.isArray(wallets) ? wallets : [];
  }

  async saveRuntimeSnapshot(snapshot: WalletRuntimeSnapshot): Promise<void> {
    this.ensureConnected();
    const stmt = this.db!.prepare(`
      INSERT INTO runtime_wallet_snapshot (id, snapshot_json, saved_at)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        snapshot_json = excluded.snapshot_json,
        saved_at = excluded.saved_at
    `);
    stmt.run(JSON.stringify(snapshot), new Date().toISOString());
  }

  async loadRuntimeSnapshot(): Promise<WalletRuntimeSnapshot | null> {
    this.ensureConnected();
    const row = this.db!
      .prepare('SELECT snapshot_json FROM runtime_wallet_snapshot WHERE id = 1')
      .get() as { snapshot_json: string } | undefined;
    if (!row) return null;

    try {
      return JSON.parse(row.snapshot_json) as WalletRuntimeSnapshot;
    } catch {
      return null;
    }
  }

  async clearRuntimeSnapshot(): Promise<void> {
    this.ensureConnected();
    this.db!.prepare('DELETE FROM runtime_wallet_snapshot WHERE id = 1').run();
  }

  async saveKillSwitchState(enabled: boolean): Promise<void> {
    this.ensureConnected();
    this.saveRuntimeValue('kill_switch_enabled', enabled);
  }

  async loadKillSwitchState(): Promise<boolean | null> {
    this.ensureConnected();
    const value = this.loadRuntimeValue<boolean>('kill_switch_enabled');
    if (typeof value !== 'boolean') return null;
    return value;
  }

  async saveExecutionCountersState(state: RuntimeCountersPersistedState): Promise<void> {
    this.ensureConnected();
    this.saveRuntimeValue('execution_counters_state', state);
  }

  async loadExecutionCountersState(): Promise<RuntimeCountersPersistedState | null> {
    this.ensureConnected();
    return this.loadRuntimeValue<RuntimeCountersPersistedState>('execution_counters_state');
  }

  saveWalletSyncCursor(walletId: string, cursor: string, source: WalletSyncCursor['source'] = 'exchange_sync'): void {
    this.ensureConnected();
    const payload: WalletSyncCursor = {
      walletId,
      cursor,
      source,
      updatedAt: new Date().toISOString(),
    };
    this.saveRuntimeValue(`wallet_sync_cursor:${walletId}`, payload);
  }

  loadWalletSyncCursor(walletId: string): WalletSyncCursor | null {
    this.ensureConnected();
    return this.loadRuntimeValue<WalletSyncCursor>(`wallet_sync_cursor:${walletId}`);
  }

  loadUnresolvedWorkQueue(): UnresolvedWorkQueueItem[] {
    this.ensureConnected();
    const rows = this.loadRuntimeValue<UnresolvedWorkQueueItem[]>('unresolved_work_queue');
    return Array.isArray(rows) ? rows : [];
  }

  enqueueUnresolvedWorkItems(
    items: Array<Omit<UnresolvedWorkQueueItem, 'id' | 'status' | 'attempts' | 'createdAt' | 'updatedAt'>>,
  ): void {
    this.ensureConnected();
    if (items.length === 0) return;
    const now = new Date().toISOString();
    const queue = this.loadUnresolvedWorkQueue();
    for (const item of items) {
      const existing = queue.find(
        (q) =>
          q.status === 'pending'
          && q.walletId === item.walletId
          && q.marketId === item.marketId
          && q.outcome === item.outcome,
      );
      if (existing) {
        existing.size = Math.max(existing.size, item.size);
        existing.reason = item.reason;
        existing.updatedAt = now;
        continue;
      }
      queue.push({
        id: `${item.walletId}:${item.marketId}:${item.outcome}:${now}`,
        walletId: item.walletId,
        marketId: item.marketId,
        outcome: item.outcome,
        size: item.size,
        reason: item.reason,
        source: item.source,
        status: 'pending',
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
    this.saveRuntimeValue('unresolved_work_queue', queue);
  }

  recordUnresolvedWorkQueueAttempt(stillOpen: Array<{ walletId: string; marketId: string; outcome: 'YES' | 'NO'; size: number }>): {
    resolved: number;
    pending: number;
  } {
    this.ensureConnected();
    const now = new Date().toISOString();
    const queue = this.loadUnresolvedWorkQueue();
    const stillOpenKeys = new Set(stillOpen.map((s) => `${s.walletId}:${s.marketId}:${s.outcome}`));
    let resolved = 0;
    let pending = 0;

    for (const item of queue) {
      if (item.status !== 'pending') continue;
      const key = `${item.walletId}:${item.marketId}:${item.outcome}`;
      if (stillOpenKeys.has(key)) {
        item.attempts += 1;
        item.lastAttemptAt = now;
        item.updatedAt = now;
        pending += 1;
      } else {
        item.status = 'resolved';
        item.updatedAt = now;
        resolved += 1;
      }
    }

    this.saveRuntimeValue('unresolved_work_queue', queue);
    return { resolved, pending };
  }

  loadPendingUnresolvedWorkQueue(): UnresolvedWorkQueueItem[] {
    this.ensureConnected();
    return this.loadUnresolvedWorkQueue().filter((q) => q.status === 'pending');
  }

  loadUnresolvedOrderQueue(): UnresolvedOrderQueueItem[] {
    this.ensureConnected();
    const rows = this.loadRuntimeValue<UnresolvedOrderQueueItem[]>('unresolved_order_queue');
    return Array.isArray(rows) ? rows : [];
  }

  enqueueUnresolvedOrderItems(
    items: Array<Omit<UnresolvedOrderQueueItem, 'id' | 'status' | 'attempts' | 'createdAt' | 'updatedAt'>>,
  ): void {
    this.ensureConnected();
    if (items.length === 0) return;
    const now = new Date().toISOString();
    const queue = this.loadUnresolvedOrderQueue();
    for (const item of items) {
      const existing = queue.find(
        (q) =>
          q.status === 'pending'
          && q.walletId === item.walletId
          && (q.exchangeOrderId ?? '') === (item.exchangeOrderId ?? '')
          && (q.marketId ?? '') === (item.marketId ?? '')
          && (q.outcome ?? '') === (item.outcome ?? ''),
      );
      if (existing) {
        existing.reason = item.reason;
        existing.lastSeenAt = now;
        existing.updatedAt = now;
        continue;
      }
      queue.push({
        id: `${item.walletId}:${item.exchangeOrderId ?? item.marketId ?? 'unknown'}:${now}`,
        walletId: item.walletId,
        exchangeOrderId: item.exchangeOrderId,
        marketId: item.marketId,
        outcome: item.outcome,
        reason: item.reason,
        source: item.source,
        status: 'pending',
        attempts: 0,
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
      });
    }
    this.saveRuntimeValue('unresolved_order_queue', queue);
  }

  recordUnresolvedOrderQueueAttempt(
    stillOpenOrders: Array<{ walletId: string; exchangeOrderId?: string; marketId?: string; outcome?: 'YES' | 'NO' }>,
  ): { resolved: number; pending: number } {
    this.ensureConnected();
    const now = new Date().toISOString();
    const queue = this.loadUnresolvedOrderQueue();
    const stillOpenKeys = new Set(
      stillOpenOrders.map(
        (o) => `${o.walletId}:${o.exchangeOrderId ?? ''}:${o.marketId ?? ''}:${o.outcome ?? ''}`,
      ),
    );

    let resolved = 0;
    let pending = 0;
    for (const item of queue) {
      if (item.status !== 'pending') continue;
      const key = `${item.walletId}:${item.exchangeOrderId ?? ''}:${item.marketId ?? ''}:${item.outcome ?? ''}`;
      if (stillOpenKeys.has(key)) {
        item.attempts += 1;
        item.lastSeenAt = now;
        item.updatedAt = now;
        pending += 1;
      } else {
        item.status = 'resolved';
        item.updatedAt = now;
        resolved += 1;
      }
    }

    this.saveRuntimeValue('unresolved_order_queue', queue);
    return { resolved, pending };
  }

  loadPendingUnresolvedOrderQueue(): UnresolvedOrderQueueItem[] {
    this.ensureConnected();
    return this.loadUnresolvedOrderQueue().filter((q) => q.status === 'pending');
  }

  /* ━━━━━━━━━━━━━━ Audit Log ━━━━━━━━━━━━━━ */

  appendAuditEvent(event: AuditEvent): void {
    this.ensureConnected();
    const stmt = this.db!.prepare(`
      INSERT INTO runtime_audit (event_type, actor, market_id, details_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      event.event_type,
      event.actor,
      event.market_id ?? null,
      event.details ? JSON.stringify(event.details) : null,
      new Date().toISOString(),
    );
  }

  loadAuditEvents(limit = 200): AuditEventRow[] {
    this.ensureConnected();
    const rows = this.db!.prepare(
      'SELECT id, event_type, actor, market_id, details_json, created_at FROM runtime_audit ORDER BY created_at DESC LIMIT ?',
    ).all(limit) as Array<{
      id: number;
      event_type: string;
      actor: string;
      market_id: string | null;
      details_json: string | null;
      created_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      event_type: r.event_type,
      actor: r.actor,
      market_id: r.market_id ?? undefined,
      details: r.details_json ? (JSON.parse(r.details_json) as Record<string, unknown>) : undefined,
      created_at: r.created_at,
    }));
  }

  /* ━━━━━━━━━━━━━━ PnL Time-Series Snapshots ━━━━━━━━━━━━━━ */

  savePnlSnapshot(wallets: WalletState[]): void {
    this.ensureConnected();
    const stmt = this.db!.prepare(`
      INSERT INTO pnl_snapshots (wallet_id, balance, realized_pnl, open_positions_count, drawdown_pct, snapshot_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    const insert = this.db!.transaction((ws: WalletState[]) => {
      for (const w of ws) {
        const drawdown = w.capitalAllocated > 0
          ? Math.max(0, (w.capitalAllocated - w.availableBalance) / w.capitalAllocated)
          : 0;
        stmt.run(w.walletId, w.availableBalance, w.realizedPnl, w.openPositions.length, drawdown, now);
      }
    });
    insert(wallets);
  }

  loadPnlHistory(walletId: string, limit = 500): PnlSnapshotRow[] {
    this.ensureConnected();
    const rows = this.db!.prepare(
      'SELECT id, wallet_id, balance, realized_pnl, open_positions_count, drawdown_pct, snapshot_at FROM pnl_snapshots WHERE wallet_id = ? ORDER BY snapshot_at DESC LIMIT ?',
    ).all(walletId, limit) as PnlSnapshotRow[];
    return rows.reverse(); // return chronological order
  }

  loadPnlHistoryAllWallets(limit = 500): PnlSnapshotRow[] {
    this.ensureConnected();
    const rows = this.db!.prepare(
      'SELECT id, wallet_id, balance, realized_pnl, open_positions_count, drawdown_pct, snapshot_at FROM pnl_snapshots ORDER BY snapshot_at DESC LIMIT ?',
    ).all(limit) as PnlSnapshotRow[];
    return rows.reverse();
  }

  appendExecutionIntent(intent: ExecutionIntentInput): void {
    this.ensureConnected();
    const stmt = this.db!.prepare(`
      INSERT INTO order_intents (
        intent_id, wallet_id, strategy_name, strategy_run_id, market_id, token_id,
        outcome, side, price, size, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      intent.intent_id,
      intent.wallet_id,
      intent.strategy_name,
      intent.strategy_run_id ?? null,
      intent.market_id,
      intent.token_id ?? null,
      intent.outcome,
      intent.side,
      intent.price,
      intent.size,
      new Date().toISOString(),
    );
  }

  appendExecutionSubmission(submission: ExecutionSubmissionInput): void {
    this.ensureConnected();
    const stmt = this.db!.prepare(`
      INSERT OR IGNORE INTO order_submissions (
        submission_id, intent_id, wallet_id, exchange_order_id, dedupe_key, status, error_text, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const dedupeKey = submission.dedupe_key
      ?? `${submission.intent_id}:${submission.wallet_id}:${submission.status}:${submission.exchange_order_id ?? ''}`;
    stmt.run(
      submission.submission_id,
      submission.intent_id,
      submission.wallet_id,
      submission.exchange_order_id ?? null,
      dedupeKey,
      submission.status,
      submission.error_text ?? null,
      new Date().toISOString(),
    );
  }

  appendExecutionEvent(event: ExecutionEventInput): void {
    this.ensureConnected();
    const stmt = this.db!.prepare(`
      INSERT OR IGNORE INTO order_events (
        intent_id, submission_id, exchange_event_id, event_type, status_text, details_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      event.intent_id,
      event.submission_id ?? null,
      event.exchange_event_id ?? null,
      event.event_type,
      event.status_text ?? null,
      event.details ? JSON.stringify(event.details) : null,
      new Date().toISOString(),
    );
  }

  appendExecutionFill(fill: ExecutionFillInput): void {
    this.ensureConnected();
    const stmt = this.db!.prepare(`
      INSERT INTO fill_events (
        intent_id, submission_id, exchange_order_id, fill_id, wallet_id, market_id,
        outcome, side, price, size, fee_usd, fill_ts, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      fill.intent_id,
      fill.submission_id ?? null,
      fill.exchange_order_id ?? null,
      fill.fill_id ?? null,
      fill.wallet_id,
      fill.market_id,
      fill.outcome,
      fill.side,
      fill.price,
      fill.size,
      fill.fee_usd ?? null,
      fill.fill_ts ?? new Date().toISOString(),
      new Date().toISOString(),
    );
  }

  loadExecutionLedger(limit = 500, walletId?: string): ExecutionLedgerRow[] {
    this.ensureConnected();
    const safeLimit = Math.min(5000, Math.max(1, limit));
    const params: unknown[] = [];
    let walletFilterClause = '';

    if (walletId && walletId.trim()) {
      walletFilterClause = `
        WHERE wallet_id = ?
      `;
      params.push(walletId.trim());
    }

    const query = `
      SELECT * FROM (
        SELECT
          id,
          'intent' AS kind,
          intent_id,
          NULL AS submission_id,
          wallet_id,
          market_id,
          strategy_name,
          NULL AS event_type,
          NULL AS status,
          side,
          outcome,
          price,
          size,
          NULL AS exchange_order_id,
          NULL AS details_json,
          created_at
        FROM order_intents
        ${walletFilterClause}

        UNION ALL

        SELECT
          os.id,
          'submission' AS kind,
          os.intent_id,
          os.submission_id,
          os.wallet_id,
          NULL AS market_id,
          NULL AS strategy_name,
          NULL AS event_type,
          os.status,
          NULL AS side,
          NULL AS outcome,
          NULL AS price,
          NULL AS size,
          os.exchange_order_id,
          CASE WHEN os.error_text IS NOT NULL THEN json_object('error_text', os.error_text) ELSE NULL END AS details_json,
          os.created_at
        FROM order_submissions os
        ${walletFilterClause ? 'WHERE os.wallet_id = ?' : ''}

        UNION ALL

        SELECT
          oe.id,
          'event' AS kind,
          oe.intent_id,
          oe.submission_id,
          oi.wallet_id,
          oi.market_id,
          oi.strategy_name,
          oe.event_type,
          oe.status_text AS status,
          oi.side,
          oi.outcome,
          oi.price,
          oi.size,
          NULL AS exchange_order_id,
          oe.details_json,
          oe.created_at
        FROM order_events oe
        JOIN order_intents oi ON oi.intent_id = oe.intent_id
        ${walletFilterClause ? 'WHERE oi.wallet_id = ?' : ''}

        UNION ALL

        SELECT
          fe.id,
          'fill' AS kind,
          fe.intent_id,
          fe.submission_id,
          fe.wallet_id,
          fe.market_id,
          oi.strategy_name,
          NULL AS event_type,
          NULL AS status,
          fe.side,
          fe.outcome,
          fe.price,
          fe.size,
          fe.exchange_order_id,
          json_object('fill_id', fe.fill_id, 'fee_usd', fe.fee_usd, 'fill_ts', fe.fill_ts) AS details_json,
          fe.created_at
        FROM fill_events fe
        LEFT JOIN order_intents oi ON oi.intent_id = fe.intent_id
        ${walletFilterClause ? 'WHERE fe.wallet_id = ?' : ''}
      )
      ORDER BY created_at DESC
      LIMIT ?
    `;

    if (walletFilterClause) {
      params.push(walletId!.trim(), walletId!.trim(), walletId!.trim());
    }
    params.push(safeLimit);

    const rows = this.db!.prepare(query).all(...params) as Array<{
      id: number;
      kind: 'intent' | 'submission' | 'event' | 'fill';
      intent_id: string;
      submission_id: string | null;
      wallet_id: string | null;
      market_id: string | null;
      strategy_name: string | null;
      event_type: string | null;
      status: string | null;
      side: string | null;
      outcome: string | null;
      price: number | null;
      size: number | null;
      exchange_order_id: string | null;
      details_json: string | null;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      intent_id: row.intent_id,
      submission_id: row.submission_id ?? undefined,
      wallet_id: row.wallet_id ?? undefined,
      market_id: row.market_id ?? undefined,
      strategy_name: row.strategy_name ?? undefined,
      event_type: row.event_type ?? undefined,
      status: row.status ?? undefined,
      side: row.side ?? undefined,
      outcome: row.outcome ?? undefined,
      price: row.price ?? undefined,
      size: row.size ?? undefined,
      exchange_order_id: row.exchange_order_id ?? undefined,
      details: row.details_json ? (JSON.parse(row.details_json) as Record<string, unknown>) : undefined,
      created_at: row.created_at,
    }));
  }

  /* ━━━━━━━━━━━━━━ Position Lifecycle ━━━━━━━━━━━━━━ */

  appendPositionLifecycle(entry: PositionLifecycleInput): void {
    this.ensureConnected();
    const stmt = this.db!.prepare(`
      INSERT INTO position_lifecycle (
        intent_id, parent_intent_id, wallet_id, market_id, outcome, event_type,
        size, price, exit_reason, strategy_name, exchange_order_id, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      entry.intent_id ?? null,
      entry.parent_intent_id ?? null,
      entry.wallet_id,
      entry.market_id,
      entry.outcome,
      entry.event_type,
      entry.size,
      entry.price,
      entry.exit_reason ?? null,
      entry.strategy_name ?? null,
      entry.exchange_order_id ?? null,
      entry.notes ?? null,
      new Date().toISOString(),
    );
  }

  loadPositionLifecycle(walletId: string, marketId?: string, limit = 200): PositionLifecycleRow[] {
    this.ensureConnected();
    const safeLimit = Math.min(2000, Math.max(1, limit));
    const params: unknown[] = [walletId];
    let marketFilter = '';
    if (marketId?.trim()) {
      marketFilter = ' AND market_id = ?';
      params.push(marketId.trim());
    }
    params.push(safeLimit);
    const rows = this.db!
      .prepare(
        `SELECT id, intent_id, wallet_id, market_id, outcome, event_type, size, price,
          parent_intent_id, exit_reason, strategy_name, exchange_order_id, notes, created_at
         FROM position_lifecycle
         WHERE wallet_id = ?${marketFilter}
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(...params) as Array<{
        id: number;
        intent_id: string | null;
        parent_intent_id: string | null;
        wallet_id: string;
        market_id: string;
        outcome: string;
        event_type: string;
        size: number;
        price: number;
        exit_reason: string | null;
        strategy_name: string | null;
        exchange_order_id: string | null;
        notes: string | null;
        created_at: string;
      }>;
    return rows.map((r) => ({
      id: r.id,
      intent_id: r.intent_id ?? undefined,
      parent_intent_id: r.parent_intent_id ?? undefined,
      wallet_id: r.wallet_id,
      market_id: r.market_id,
      outcome: r.outcome as 'YES' | 'NO',
      event_type: r.event_type as PositionLifecycleEventType,
      size: r.size,
      price: r.price,
      exit_reason: r.exit_reason as ExitReason | undefined,
      strategy_name: r.strategy_name ?? undefined,
      exchange_order_id: r.exchange_order_id ?? undefined,
      notes: r.notes ?? undefined,
      created_at: r.created_at,
    }));
  }

  loadActiveEntryIntentId(walletId: string, marketId: string, outcome: 'YES' | 'NO'): string | undefined {
    this.ensureConnected();
    const row = this.db!
      .prepare(`
        SELECT intent_id
        FROM position_lifecycle
        WHERE wallet_id = ?
          AND market_id = ?
          AND outcome = ?
          AND event_type = 'entry_open'
          AND created_at > COALESCE(
            (
              SELECT MAX(created_at)
              FROM position_lifecycle
              WHERE wallet_id = ?
                AND market_id = ?
                AND outcome = ?
                AND event_type = 'flat'
            ),
            ''
          )
        ORDER BY created_at ASC
        LIMIT 1
      `)
      .get(walletId, marketId, outcome, walletId, marketId, outcome) as { intent_id: string | null } | undefined;
    return row?.intent_id ?? undefined;
  }

  /**
   * Returns positions that have at least one entry_open or scale_in event
   * but no flat event yet — i.e., positions still considered open per the lifecycle table.
   */
  loadOpenLifecyclePositions(walletId: string): Array<{ market_id: string; outcome: 'YES' | 'NO'; net_size: number; last_event: string }> {
    this.ensureConnected();
    const rows = this.db!
      .prepare(`
        SELECT
          market_id,
          outcome,
          SUM(CASE WHEN event_type IN ('entry_open', 'scale_in') THEN size
                   WHEN event_type IN ('partial_exit', 'flat') THEN -size
                   ELSE 0 END) AS net_size,
          MAX(created_at) AS last_event
        FROM position_lifecycle
        WHERE wallet_id = ?
        GROUP BY market_id, outcome
        HAVING net_size > 0.0000001
      `)
      .all(walletId) as Array<{
        market_id: string;
        outcome: string;
        net_size: number;
        last_event: string;
      }>;
    return rows.map((r) => ({
      market_id: r.market_id,
      outcome: r.outcome as 'YES' | 'NO',
      net_size: Number(r.net_size),
      last_event: r.last_event,
    }));
  }

  loadLifecycleUnresolvedExits(walletId?: string): Array<{ wallet_id: string; market_id: string; outcome: 'YES' | 'NO'; size: number; exit_reason: string; created_at: string }> {
    this.ensureConnected();
    const params: unknown[] = [];
    let walletFilter = '';
    if (walletId?.trim()) {
      walletFilter = ' WHERE wallet_id = ?';
      params.push(walletId.trim());
    }
    const rows = this.db!
      .prepare(
        `SELECT wallet_id, market_id, outcome, size, exit_reason, created_at
         FROM position_lifecycle
         WHERE event_type = 'exit_failed'${walletId?.trim() ? ' AND wallet_id = ?' : ''}
         ORDER BY created_at DESC LIMIT 200`,
      )
      .all(...params) as Array<{
        wallet_id: string;
        market_id: string;
        outcome: string;
        size: number;
        exit_reason: string | null;
        created_at: string;
      }>;
    return rows.map((r) => ({
      wallet_id: r.wallet_id,
      market_id: r.market_id,
      outcome: r.outcome as 'YES' | 'NO',
      size: r.size,
      exit_reason: r.exit_reason ?? 'unknown',
      created_at: r.created_at,
    }));
  }

  saveReconciliationReport(report: ReconciliationReport): void {
    this.ensureConnected();
    const now = new Date().toISOString();
    const stmt = this.db!.prepare(`
      INSERT INTO runtime_reconciliation (status, report_json, created_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(report.status, JSON.stringify(report), now);
    this.saveRuntimeValue('latest_reconciliation_report', report);
  }

  loadLatestReconciliationReport(): ReconciliationReport | null {
    this.ensureConnected();
    const latest = this.loadRuntimeValue<ReconciliationReport>('latest_reconciliation_report');
    if (latest) return latest;

    const row = this.db!
      .prepare('SELECT report_json FROM runtime_reconciliation ORDER BY created_at DESC LIMIT 1')
      .get() as { report_json: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.report_json) as ReconciliationReport;
    } catch {
      return null;
    }
  }

  loadReconciliationHistory(limit = 50): ReconciliationReport[] {
    this.ensureConnected();
    const safeLimit = Math.min(500, Math.max(1, limit));
    const rows = this.db!
      .prepare('SELECT report_json FROM runtime_reconciliation ORDER BY created_at DESC LIMIT ?')
      .all(safeLimit) as Array<{ report_json: string }>;
    const parsed: ReconciliationReport[] = [];
    for (const row of rows) {
      try {
        parsed.push(JSON.parse(row.report_json) as ReconciliationReport);
      } catch {
        // Skip malformed historical rows.
      }
    }
    return parsed;
  }

  loadExecutionFillCount(walletId: string): number {
    this.ensureConnected();
    const row = this.db!
      .prepare('SELECT COUNT(*) AS count FROM fill_events WHERE wallet_id = ?')
      .get(walletId) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  loadLedgerOpenPositionCount(walletId: string): number {
    this.ensureConnected();
    const rows = this.db!
      .prepare(`
        SELECT
          market_id,
          outcome,
          SUM(CASE WHEN side = 'BUY' THEN size ELSE -size END) AS net_size
        FROM fill_events
        WHERE wallet_id = ?
        GROUP BY market_id, outcome
      `)
      .all(walletId) as Array<{ market_id: string; outcome: string; net_size: number }>;

    return rows.filter((row) => Number(row.net_size) > 0.0000001).length;
  }

  private ensureConnected(): void {
    if (!this.db) {
      throw new Error('Database is not connected. Call connect() before use.');
    }
  }

  private ensureColumnExists(table: string, column: string, type: string): void {
    const rows = this.db!
      .prepare(`PRAGMA table_info(${table})`)
      .all() as Array<{ name: string }>;
    const exists = rows.some((r) => r.name === column);
    if (!exists) {
      this.db!.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  }

  private saveRuntimeValue(key: string, value: unknown): void {
    const stmt = this.db!.prepare(`
      INSERT INTO runtime_state (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `);
    stmt.run(key, JSON.stringify(value), new Date().toISOString());
  }

  private loadRuntimeValue<T>(key: string): T | null {
    const row = this.db!
      .prepare('SELECT value_json FROM runtime_state WHERE key = ?')
      .get(key) as { value_json: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.value_json) as T;
    } catch {
      return null;
    }
  }
}
