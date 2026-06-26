import type BetterSqlite3 from 'better-sqlite3';

/**
 * A single, irreversible-forward schema migration.
 *
 * Migrations are pure SQL/DDL applied in ascending `version` order inside a
 * transaction. The applied version is tracked in the `schema_migrations`
 * table so each migration runs exactly once.
 */
export interface Migration {
  /** Monotonically increasing version. Must be unique and gap-free-friendly. */
  version: number;
  /** Human-readable name for logs. */
  name: string;
  /** Apply the migration. Runs inside a transaction. */
  up: (db: BetterSqlite3.Database) => void;
}
