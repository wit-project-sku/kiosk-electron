import type { Migration } from './types';

/**
 * 유동인구 — one row per kiosk per LOCAL hour.
 *
 * Hourly aggregates rather than one row per crossing, for three reasons: 24
 * rows a day can never outgrow the disk, an hour is the finest granularity the
 * backend reports on anyway, and — most importantly — an aggregate cannot be
 * turned back into a person. The camera's output leaves the renderer as `+1`
 * and is never anything else.
 *
 * `UNIQUE(kiosk_id, bucket_start)` is what makes the writer idempotent: every
 * flush is an UPSERT that ADDS its delta, so a crash between two flushes loses
 * at most one interval and never double-counts one.
 */
export const migration007: Migration = {
  version: 7,
  name: 'footfall_buckets',
  up: (db) => {
    db.exec(`
      CREATE TABLE footfall_buckets (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        kiosk_id       TEXT NOT NULL,
        bucket_start   TEXT NOT NULL,
        local_date     TEXT NOT NULL,
        hour           INTEGER NOT NULL,
        in_count       INTEGER NOT NULL DEFAULT 0,
        out_count      INTEGER NOT NULL DEFAULT 0,
        total_count    INTEGER NOT NULL DEFAULT 0,
        active_seconds INTEGER NOT NULL DEFAULT 0,
        sync_state     TEXT NOT NULL DEFAULT 'pending',
        synced_at      TEXT,
        updated_at     TEXT NOT NULL,
        created_at     TEXT NOT NULL,
        UNIQUE(kiosk_id, bucket_start)
      );

      -- The uploader's only query: pending rows, oldest first.
      CREATE INDEX idx_footfall_sync ON footfall_buckets (sync_state, bucket_start);
      -- The operator view's only query: one day of hours.
      CREATE INDEX idx_footfall_date ON footfall_buckets (local_date);
    `);
  },
};
