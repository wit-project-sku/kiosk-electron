/**
 * SQLite connection manager.
 *
 * Owns the single better-sqlite3 connection for the process. better-sqlite3 is
 * synchronous, which is ideal in the main process: queries are fast, run on the
 * native thread, and avoid the callback/promise overhead that would otherwise
 * serialize through Node's event loop. PRAGMAs below tune it for a desktop,
 * single-writer, offline-first workload.
 */

import BetterSqlite3 from 'better-sqlite3';
import { appPaths } from '@main/core/paths';
import { AppError } from '@main/core/AppError';
import { createLogger } from '@main/core/logger';
import { runMigrations } from './migrations';

const log = createLogger('database');

export class Database {
  private connection: BetterSqlite3.Database | null = null;

  /** Open the connection, apply PRAGMAs, and run migrations. Idempotent. */
  init(): void {
    if (this.connection) return;

    try {
      const db = new BetterSqlite3(appPaths.database);

      // WAL gives much better read/write concurrency and crash resilience.
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('foreign_keys = ON');
      db.pragma('busy_timeout = 5000');

      this.connection = db;
      log.info('Database opened', { path: appPaths.database });

      runMigrations(db);
    } catch (error) {
      log.error('Failed to open database', error);
      throw AppError.database('Could not open the local database.');
    }
  }

  /** The live connection. Throws if accessed before init(). */
  get conn(): BetterSqlite3.Database {
    if (!this.connection) {
      throw AppError.database('Database accessed before initialization.');
    }
    return this.connection;
  }

  /** Run a function inside a transaction with automatic rollback on throw. */
  transaction<T>(fn: () => T): T {
    return this.conn.transaction(fn)();
  }

  /** Flush WAL and close cleanly on shutdown. */
  close(): void {
    if (!this.connection) return;
    try {
      this.connection.pragma('wal_checkpoint(TRUNCATE)');
      this.connection.close();
      log.info('Database closed');
    } catch (error) {
      log.error('Error while closing database', error);
    } finally {
      this.connection = null;
    }
  }
}

/** Process-wide singleton. Wired into repositories at startup. */
export const database = new Database();
