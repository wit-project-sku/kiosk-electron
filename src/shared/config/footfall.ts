/**
 * 유동인구 counting — defaults and the parsing of their env overrides.
 *
 * These numbers are the difference between a feature nobody notices and a
 * kiosk that stutters, so each one carries the reason it has the value it has.
 * The machine this runs on has no discrete GPU and is already decoding a 4K
 * attract video on the second monitor; the counting loop is a guest there.
 */

import type { FootfallLine, FootfallTuning } from '../types/footfall';

/**
 * Six frames a second, and the reasoning is worth keeping.
 *
 * A person crossing at walking pace (1.4 m/s) is visible for roughly two
 * seconds in a 3 m field of view, so 6 fps sees them a dozen times — far more
 * than the three sightings a track needs before it may be counted. Camera frame
 * rate (30) would multiply the cost by five and improve the count by nothing.
 *
 * The floor is set by the TRACKER, not by the walk: the further a person moves
 * between two passes, the less their box overlaps its own previous position,
 * and association degrades. 6 fps keeps a normal walking step at roughly half a
 * box width, which stays comfortably inside overlap. Below about 3 fps a brisk
 * walker starts producing disjoint boxes on every frame and the count leans on
 * ObjectTracker's proximity fallback instead of on real overlap.
 */
const DEFAULT_TARGET_FPS = 6;

export const DEFAULT_FOOTFALL_TUNING: FootfallTuning = {
  targetFps: DEFAULT_TARGET_FPS,
  /**
   * EfficientDet-Lite0 resizes its input to 320×320 internally, so anything
   * larger than this is thrown away by the model after costing us the downscale.
   */
  inputWidth: 320,
  /**
   * Low on purpose. ByteTrack's whole point is that weak boxes are still useful
   * for KEEPING a track alive through a blur or a partial occlusion — they just
   * may not START one. `trackScoreThreshold` is the bar for starting.
   */
  scoreThreshold: 0.2,
  trackScoreThreshold: 0.45,
  /**
   * 0.3 on ObjectTracker's unified score: accept any genuine box overlap, and
   * accept a non-overlapping candidate only while its centroid is within about
   * half the search radius and it is the same size as the track it would join.
   */
  matchThreshold: 0.3,
  /**
   * At 6 fps this is ~3 seconds of coasting on predicted motion. Long enough to
   * survive someone walking behind a pillar, short enough that the id is not
   * still alive when a different person arrives in the same spot.
   */
  maxTrackAge: 18,
  /**
   * A single stray box must never become a visitor. Three sightings at 6 fps is
   * half a second of a thing that keeps existing and keeps moving like a person.
   */
  minTrackHits: 3,
  /**
   * 1.5% of the frame. Filters the people visible through a doorway at the far
   * end of a concourse — real people, but not people passing THIS kiosk, and
   * counting them would inflate every hour by a constant nobody can subtract.
   */
  minBoxAreaRatio: 0.015,
  /**
   * USB cameras open dark and auto-expose over the first second or so, and the
   * detector hallucinates on the noise while they do. Discard those frames
   * rather than let a restart invent visitors.
   */
  warmupFrames: 8,
};

/** Vertical line down the middle — see FootfallLine for why that is the default. */
export const DEFAULT_FOOTFALL_LINE: FootfallLine = { orientation: 'vertical', position: 0.5 };

/**
 * Parse `FOOTFALL_LINE` — `vertical:0.5`, `horizontal:0.6`, or just `vertical`.
 * Anything unparseable falls back to the default rather than throwing: a typo in
 * a .env on a kiosk 400 km away must not stop the app from starting.
 */
export function parseFootfallLine(raw: string | undefined): FootfallLine {
  if (!raw) return DEFAULT_FOOTFALL_LINE;
  const [orientationRaw, positionRaw] = raw.split(':');
  const orientation = orientationRaw?.trim().toLowerCase();
  if (orientation !== 'vertical' && orientation !== 'horizontal') return DEFAULT_FOOTFALL_LINE;
  const position = positionRaw === undefined ? 0.5 : Number.parseFloat(positionRaw);
  if (!Number.isFinite(position) || position <= 0.05 || position >= 0.95) {
    return { orientation, position: 0.5 };
  }
  return { orientation, position };
}

/** Numeric env override with a sane-range guard, falling back to `fallback`. */
export function parseNumberInRange(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < min || value > max) return fallback;
  return value;
}

/**
 * How often the renderer hands its accumulated crossings to main.
 *
 * Not per crossing: a group walking past together would otherwise fire five IPC
 * round-trips inside one second. Not per minute either — a power cut would then
 * lose a minute of counts, and this is exactly the kind of feature nobody
 * notices is under-reporting.
 */
export const FOOTFALL_REPORT_INTERVAL_MS = 5_000;

/**
 * How often main flushes its in-memory bucket deltas into SQLite. Bounds what a
 * power cut can lose to one minute of counting, at one tiny UPSERT per minute.
 */
export const FOOTFALL_FLUSH_INTERVAL_MS = 60_000;

/** Local hour/minute the day's counts are pushed to the backend. */
export const FOOTFALL_UPLOAD_HOUR = 21;
export const FOOTFALL_UPLOAD_MINUTE = 30;

/**
 * Synced buckets older than this are deleted at the nightly run. 24 rows a day
 * is nothing, but "nothing" accumulated for five years on a machine nobody logs
 * into is how an offline kiosk runs out of disk.
 */
export const FOOTFALL_RETENTION_DAYS = 180;
