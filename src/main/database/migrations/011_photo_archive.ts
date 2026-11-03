import type { Migration } from './types';

/**
 * 사진 보관(구글 드라이브) — what PhotoArchiveService has sent from the photo folder.
 *
 * One row per ORIGINAL file name (`Captured_<YYYYMMDD>_<n>.jpg`); the composite
 * travels with it, and `with_result` records whether it did. A file with no row
 * has never been tried. `photo_archive_meta.enabled_since` is when the server
 * first said "enabled" to this kiosk — photos older than that are never sent
 * (past photos are uploaded by hand).
 */
export const migration011: Migration = {
  version: 11,
  name: 'photo_archive',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS photo_archive_files (
        file_name    TEXT PRIMARY KEY,
        state        TEXT NOT NULL CHECK (state IN ('pending', 'sent', 'given_up')),
        with_result  INTEGER NOT NULL DEFAULT 0,
        attempts     INTEGER NOT NULL DEFAULT 0,
        last_status  INTEGER,
        last_error   TEXT,
        sent_at      TEXT,
        updated_at   TEXT NOT NULL,
        created_at   TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS photo_archive_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  },
};
