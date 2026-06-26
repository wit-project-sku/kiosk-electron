import type { Migration } from './types';

/**
 * Adds kiosk platform tables: local_cache for synced content and
 * failed_requests for durable error recovery.
 */
export const migration003: Migration = {
  version: 3,
  name: 'kiosk_platform',
  up: (db) => {
    db.exec(`
      CREATE TABLE local_cache (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        cache_key  TEXT    NOT NULL UNIQUE,
        data       TEXT    NOT NULL,
        source     TEXT,
        updated_at TEXT    NOT NULL
      );
      CREATE INDEX idx_local_cache_key ON local_cache (cache_key);

      CREATE TABLE failed_requests (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id  TEXT    NOT NULL UNIQUE,
        type        TEXT    NOT NULL,
        payload     TEXT    NOT NULL,
        error       TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT    NOT NULL,
        updated_at  TEXT    NOT NULL
      );
      CREATE INDEX idx_failed_requests_type       ON failed_requests (type);
      CREATE INDEX idx_failed_requests_retry_count ON failed_requests (retry_count);
    `);
  },
};
