import type { Migration } from './types';

/**
 * Adds the data/analytics/sync layer: sessions, analytics events, reports,
 * templates, and the durable sync queue. Analytics and sync rows are designed
 * for append-only, crash-safe writes so business data is never lost.
 */
export const migration002: Migration = {
  version: 2,
  name: 'data_layer',
  up: (db) => {
    db.exec(`
      CREATE TABLE sessions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        status      TEXT    NOT NULL DEFAULT 'active',
        metadata    TEXT,
        started_at  TEXT    NOT NULL,
        ended_at    TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
      );
      CREATE INDEX idx_sessions_status ON sessions (status);

      CREATE TABLE analytics_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        payload     TEXT,
        session_id  INTEGER,
        customer_id INTEGER,
        sync_state  TEXT    NOT NULL DEFAULT 'pending',
        created_at  TEXT    NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE SET NULL,
        FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
      );
      CREATE INDEX idx_analytics_name       ON analytics_events (name);
      CREATE INDEX idx_analytics_sync_state ON analytics_events (sync_state);
      CREATE INDEX idx_analytics_created_at ON analytics_events (created_at);

      CREATE TABLE reports (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        title      TEXT    NOT NULL,
        type       TEXT    NOT NULL,
        data       TEXT    NOT NULL,
        created_at TEXT    NOT NULL
      );
      CREATE INDEX idx_reports_type ON reports (type);

      CREATE TABLE templates (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        key        TEXT    NOT NULL UNIQUE,
        name       TEXT    NOT NULL,
        content    TEXT    NOT NULL,
        enabled    INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT    NOT NULL
      );

      CREATE TABLE sync_queue (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        type            TEXT    NOT NULL,
        payload         TEXT    NOT NULL,
        status          TEXT    NOT NULL DEFAULT 'pending',
        attempts        INTEGER NOT NULL DEFAULT 0,
        max_attempts    INTEGER NOT NULL DEFAULT 10,
        last_error      TEXT,
        next_attempt_at TEXT    NOT NULL,
        created_at      TEXT    NOT NULL,
        updated_at      TEXT    NOT NULL
      );
      CREATE INDEX idx_sync_status       ON sync_queue (status);
      CREATE INDEX idx_sync_next_attempt ON sync_queue (next_attempt_at);
    `);
  },
};
