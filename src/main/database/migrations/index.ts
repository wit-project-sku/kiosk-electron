import type BetterSqlite3 from 'better-sqlite3';
import { createLogger } from '@main/core/logger';
import type { Migration } from './types';
import { migration001 } from './001_initial';
import { migration002 } from './002_data_layer';
import { migration003 } from './003_kiosk_platform';
import { migration004 } from './004_photo_sessions';
import { migration005 } from './005_translations';
import { migration006 } from './006_default_translations';
import { migration007 } from './007_footfall';

const log = createLogger('migrations');

/**
 * The ordered migration registry. Append new migrations here; never edit or
 * reorder existing ones once shipped.
 */
const MIGRATIONS: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
];

function getCurrentVersion(db: BetterSqlite3.Database): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  const row = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as {
    version: number | null;
  };
  return row.version ?? 0;
}

/**
 * Run all pending migrations in ascending order. Each migration executes inside
 * its own transaction so a failure leaves the database at the last good version.
 */
export function runMigrations(db: BetterSqlite3.Database): void {
  const current = getCurrentVersion(db);
  const pending = MIGRATIONS.filter((m) => m.version > current).sort(
    (a, b) => a.version - b.version,
  );

  if (pending.length === 0) {
    log.info('Database schema up to date', { version: current });
    return;
  }

  log.info('Applying migrations', { from: current, count: pending.length });

  const record = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
  );

  for (const migration of pending) {
    const apply = db.transaction(() => {
      migration.up(db);
      record.run(migration.version, migration.name, new Date().toISOString());
    });
    apply();
    log.info('Applied migration', { version: migration.version, name: migration.name });
  }
}
