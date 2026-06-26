import type { Migration } from './types';

/** AI photo session metadata — image files live on disk in data/generated/. */
export const migration004: Migration = {
  version: 4,
  name: 'photo_sessions',
  up: (db) => {
    db.exec(`
      CREATE TABLE photo_sessions (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id        TEXT    NOT NULL UNIQUE,
        clothing_key      TEXT,
        style_key         TEXT,
        result_image_path TEXT    NOT NULL,
        drive_sync_state  TEXT    NOT NULL DEFAULT 'pending',
        drive_file_id     TEXT,
        created_at        TEXT    NOT NULL
      );
      CREATE INDEX idx_photo_sessions_session_id   ON photo_sessions (session_id);
      CREATE INDEX idx_photo_sessions_drive_sync     ON photo_sessions (drive_sync_state);
      CREATE INDEX idx_photo_sessions_created_at   ON photo_sessions (created_at);
    `);
  },
};
