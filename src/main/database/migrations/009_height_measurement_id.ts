import type { Migration } from './types';

/**
 * 키 측정 — give each measurement a stable id, and the version of the estimator
 * that produced it.
 *
 * `measurement_id` identifies the row when it is uploaded to the backend, so a
 * retried upload cannot create a duplicate. It is random and links to nothing:
 * collection is anonymous test data until the try-on app ships.
 *
 * `version` is the sidecar's ALGORITHM_VERSION. Rows from before it existed
 * stay NULL on purpose: those came from the abs(cos) calibration bug fixed in
 * version 2, which mirrored heights on a re-mounted camera, and must not be
 * mistaken for good data.
 */
export const migration009: Migration = {
  version: 9,
  name: 'height_measurement_id',
  up: (db) => {
    db.exec(`
      ALTER TABLE height_measurements ADD COLUMN measurement_id TEXT;
      ALTER TABLE height_measurements ADD COLUMN version INTEGER;
      UPDATE height_measurements SET measurement_id = lower(hex(randomblob(16)));
      CREATE UNIQUE INDEX idx_height_measurement_id ON height_measurements (measurement_id);
    `);
  },
};
