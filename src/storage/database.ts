import BetterSqlite3 from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { WalletState } from '../types';
import type { WalletRuntimeSnapshot } from '../wallets/wallet_manager';
import type { RuntimeCountersPersistedState } from '../reporting/runtime_counters';

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
