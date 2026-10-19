import type { Migration } from './types';

/**
 * 키 측정 — shoulder, chest, waist and hip breadth (cm), from sidecar version 5.
 *
 * Breadth is the side-to-side width of the body seen from the front, not a
 * circumference. Each is NULL when that capture could not measure it honestly —
 * chest, waist and hip need both arms visibly clear of the body, which a
 * visitor standing with arms at their sides does not give.
 */
export const migration010: Migration = {
  version: 10,
  name: 'height_body_widths',
  up: (db) => {
    db.exec(`
      ALTER TABLE height_measurements ADD COLUMN shoulder_width_cm REAL;
      ALTER TABLE height_measurements ADD COLUMN chest_width_cm REAL;
      ALTER TABLE height_measurements ADD COLUMN waist_width_cm REAL;
      ALTER TABLE height_measurements ADD COLUMN hip_width_cm REAL;
    `);
  },
};
