/**
 * 유동인구 (footfall) — anonymous passer-by counting.
 *
 * The kiosk camera watches the walkway in front of it and counts how many
 * people cross an imaginary line. NOTHING about a person is retained: no
 * frames, no faces, no embeddings, no identifiers. A crossing collapses into
 * `+1` on an hourly bucket the moment it happens, and that integer is the only
 * thing that ever reaches SQLite or the backend.
 *
 * Types are shared by main and renderer: the renderer runs the vision pipeline
 * (it is the process with a camera and a GPU), main owns the durable counts and
 * the nightly upload.
 */

/**
 * Which way the person went across the counting line.
 *
 * The labels are geometric, not semantic — for a vertical line 'in' is
 * left→right, for a horizontal line 'in' is top→bottom. Which physical
 * direction that corresponds to depends on how the camera is mounted, so
 * reporting keeps both and lets the backend decide. `total` (in + out) is the
 * number this feature actually exists to produce.
 */
export type FootfallDirection = 'in' | 'out';

export type FootfallLineOrientation = 'vertical' | 'horizontal';

/**
 * The counting line, in normalized frame coordinates.
 *
 * A kiosk camera faces the crowd walking PAST it, so the default is a vertical
 * line down the middle of the frame: someone walking along the corridor crosses
 * it exactly once. A camera aimed down an approach (people walking toward the
 * kiosk) wants `horizontal` instead — see FOOTFALL_LINE in .env.
 */
export interface FootfallLine {
  orientation: FootfallLineOrientation;
  /** 0..1 across the frame — 0.5 is the centre. */
  position: number;
}

/**
 * Everything the vision loop is allowed to tune per site. Defaults live in
 * `@shared/config/footfall`; main overrides them from env at startup so a noisy
 * location can be re-tuned without a rebuild.
 */
export interface FootfallTuning {
  /** Detector passes per second. Deliberately low — see the config file. */
  targetFps: number;
  /** Frame width fed to the detector; height follows the camera's aspect. */
  inputWidth: number;
  /** Minimum detector score for a box to be considered at all. */
  scoreThreshold: number;
  /** Boxes at/above this score can start a NEW track (ByteTrack's high band). */
  trackScoreThreshold: number;
  /**
   * Association score needed to call a detection the same person as a track.
   * Any real box overlap scores 0.5 or better; below that the score comes from
   * how near the two centroids are relative to their size. See ObjectTracker.
   */
  matchThreshold: number;
  /** Frames a track survives without a detection before it is dropped. */
  maxTrackAge: number;
  /** Detections a track needs before it is allowed to trigger a count. */
  minTrackHits: number;
  /** Boxes smaller than this share of the frame are ignored (far background). */
  minBoxAreaRatio: number;
  /** Frames discarded after the camera starts, while exposure settles. */
  warmupFrames: number;
}

/** What the renderer's counting loop is told to do, and with what. */
export interface FootfallRuntime {
  /** Feature switch for this machine (FOOTFALL_ENABLED). */
  enabled: boolean;
  /**
   * Whether the loop should be holding the camera RIGHT NOW. False whenever
   * something with a stronger claim on the camera is running — see
   * `suspendReason`. The renderer must release its MediaStream on false, not
   * merely stop inferring: the photo pipeline needs the device at 1920×1080 and
   * Chromium hands the second opener whatever format the first one asked for.
   */
  active: boolean;
  /**
   * Why counting is not producing numbers, for the log and the operator view.
   * Informational: 'no-camera' can appear alongside `active: true`, because main
   * still wants counting and it is the renderer's own retry loop that is waiting
   * on the hardware.
   */
  suspendReason: FootfallSuspendReason | null;
  /** Camera to open — the same device the photo flow resolves. */
  deviceId: string | null;
  line: FootfallLine;
  tuning: FootfallTuning;
}

/**
 * Every reason the counter yields the camera. Ordered loosely by how long the
 * pause lasts; the string is what shows up in the logs.
 */
export type FootfallSuspendReason =
  | 'photo-session'
  | 'display-camera'
  | 'cooldown'
  | 'no-camera'
  | 'disabled';

/** One line crossing, as seen by the renderer. */
export interface FootfallCrossing {
  direction: FootfallDirection;
  /**
   * ISO-8601 instant (`Date.prototype.toISOString`). Main converts it to the
   * machine's LOCAL hour to pick a bucket, so the two processes never have to
   * agree on a timezone — only on an instant.
   */
  at: string;
}

/**
 * A batch handed to main. Sent every few seconds rather than per crossing so a
 * busy corridor cannot turn into an IPC storm, and `activeMs` rides along so the
 * backend can tell "nobody walked past" apart from "the camera was busy".
 */
export interface FootfallReport {
  crossings: FootfallCrossing[];
  /** Milliseconds the loop spent actually watching since the last report. */
  activeMs: number;
}

/** One hour of counting for one kiosk — the durable unit, and the upload unit. */
export interface FootfallBucket {
  kioskId: string;
  /** Local ISO-8601 start of the hour, e.g. `2026-08-24T14:00:00+09:00`. */
  bucketStart: string;
  /** Local calendar date `YYYY-MM-DD`, denormalized for day queries. */
  localDate: string;
  /** Local hour 0–23. */
  hour: number;
  inCount: number;
  outCount: number;
  totalCount: number;
  /** Seconds the counter was actually running during this hour. */
  activeSeconds: number;
}

/** Operator/diagnostic snapshot. Never shown to visitors. */
export interface FootfallStats {
  runtime: FootfallRuntime;
  /** Today's totals so far. */
  today: { date: string; inCount: number; outCount: number; totalCount: number };
  /** Per-hour totals for today, ascending. */
  hours: { hour: number; totalCount: number }[];
  pendingBuckets: number;
  lastUploadAt: string | null;
  lastUploadError: string | null;
}
