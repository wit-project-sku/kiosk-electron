import type { Migration } from './types';

/** Translations table: one entry per key+language combination. */
export const migration005: Migration = {
  version: 5,
  name: 'translations_schema',
  up: (db) => {
    db.exec(`
      CREATE TABLE translations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        language TEXT NOT NULL,
        text TEXT NOT NULL,
        last_synced TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(key, language)
      );

      CREATE INDEX idx_translations_language ON translations (language);
      CREATE INDEX idx_translations_key ON translations (key);
    `);
  },
};
