import BetterSqlite3 from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { WalletState } from '../types';
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
    `);
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

  private ensureConnected(): void {
    if (!this.db) {
      throw new Error('Database is not connected. Call connect() before use.');
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
