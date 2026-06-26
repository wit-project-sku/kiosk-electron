import type { Migration } from './types';

/** Initial schema: customers, images, and key/value settings. */
export const migration001: Migration = {
  version: 1,
  name: 'initial_schema',
  up: (db) => {
    db.exec(`
      CREATE TABLE customers (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name  TEXT    NOT NULL,
        last_name   TEXT    NOT NULL,
        email       TEXT,
        phone       TEXT,
        notes       TEXT,
        created_at  TEXT    NOT NULL,
        updated_at  TEXT    NOT NULL
      );

      CREATE INDEX idx_customers_last_name ON customers (last_name);
      CREATE INDEX idx_customers_email     ON customers (email);

      CREATE TABLE images (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id    INTEGER,
        file_name      TEXT    NOT NULL,
        file_path      TEXT    NOT NULL,
        thumbnail_path TEXT,
        mime_type      TEXT    NOT NULL,
        byte_size      INTEGER NOT NULL,
        width          INTEGER,
        height         INTEGER,
        created_at     TEXT    NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
      );

      CREATE INDEX idx_images_customer_id ON images (customer_id);
      CREATE INDEX idx_images_created_at  ON images (created_at);
    `);
  },
};
