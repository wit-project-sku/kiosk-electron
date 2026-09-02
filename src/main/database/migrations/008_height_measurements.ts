import type { Migration } from './types';

/**
 * 키 측정 — one row per 제주 capture that produced a usable measurement.
 *
 * ── What this table deliberately does NOT have ─────────────────────────
 * No `session_id`, and no reference of any kind to a photo. That is the whole
 * design, not an oversight.
 *
 * A height with a timestamp is not personal data. The same height joined to a
 * photo session — and through it to a picture of the person it came from — is
 * body-measurement data about an identifiable individual, which under PIPA is a
 * different thing entirely and would need a consent notice on the kiosk. The
 * analytics this was built for (what sizes of visitor pass through, by hour)
 * need no such join, so it cannot be made. Anyone adding a link here is
 * changing the feature's legal posture, not just its schema.
 *
 * Unlike 유동인구 (see 007) this is one row per capture rather than an hourly
 * aggregate, because the distribution is the point — a mean height per hour
 * would answer none of the questions this was asked for. That is affordable:
 * a busy kiosk takes a few hundred photos a day, not a few hundred thousand
 * crossings, and `local_date` is indexed so the retention sweep stays cheap.
 *
 * Rows with a null `height_cm` are kept on purpose. "Nobody was in the zone" and
 * "this was a 같이찍기 capture with two people in frame" are the measurements
 * that tell you whether the estimator is working at all; dropping them would
 * leave a dataset that always looks healthy.
 */
export const migration008: Migration = {
  version: 8,
  name: 'height_measurements',
  up: (db) => {
    db.exec(`
      CREATE TABLE height_measurements (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        kiosk_id      TEXT NOT NULL,
        measured_at   TEXT NOT NULL,
        local_date    TEXT NOT NULL,
        hour          INTEGER NOT NULL,
        height_cm     REAL,
        confidence    REAL NOT NULL DEFAULT 0,
        samples       INTEGER NOT NULL DEFAULT 0,
        subjects      INTEGER NOT NULL DEFAULT 0,
        reason        TEXT,
        created_at    TEXT NOT NULL
      );

      -- The only query anything runs: one day, or a range of days.
      CREATE INDEX idx_height_date ON height_measurements (local_date);
    `);
  },
};
