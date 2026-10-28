/**
 * 키 측정 — anonymous visitor-height analytics, 제주 only.
 *
 * A ZED 2i mounted beside the photo camera measures the visitor while the 제주
 * photo flow is photographing them. Nothing here reaches the renderer: there is
 * no UI, no live value, no preview. The whole feature is a number written to
 * SQLite after the fact.
 *
 * ── Linked to a photo only on the server ───────────────────────────────
 * The local SQLite rows stay unlinked: no session id, no photo reference. Each
 * capture's result is also sent once with the AR original photo to
 * `POST /api/stats/shots/v2` (private bucket). That pairing is body-measurement
 * data about an identifiable individual under PIPA, so it relies on the kiosk
 * showing the matching consent notice.
 */

/** One capture's worth of measurement, as the sidecar reports it. */
export interface HeightMeasurement {
  /** Median across the capture window. Null when the number would not mean
   *  anything — see {@link HeightMeasurement.reason}. */
  heightCm: number | null;
  /** 0–1, from how closely the window's frames agreed (MAD), not from any one frame. */
  confidence: number;
  /** Frames that contributed to the median. */
  samples: number;
  /**
   * People standing in the measurement zone. 1 is the only case that yields a
   * height: a 같이찍기 (together) capture has two or more, and "the visitor's
   * height" stops being a well-defined thing. The count is still recorded —
   * knowing how many captures are group captures is itself useful, and a
   * smaller honest dataset beats a bigger one with a coin-flip in it.
   */
  subjects: number;
  /** Why there is no height, or null when there is one. */
  reason: string | null;
  /**
   * Side-to-side body breadth seen from the front, in cm — not circumference.
   * Null when the capture could not measure it honestly: chest, waist and hip
   * need both arms visibly clear of the body.
   */
  shoulderWidthCm: number | null;
  chestWidthCm: number | null;
  waistWidthCm: number | null;
  hipWidthCm: number | null;
  /** The sidecar's ALGORITHM_VERSION. Null from a sidecar that predates it —
   *  treat those numbers as untrustworthy (see migration 009). */
  version: number | null;
}

/** A stored row. Note what is absent: no session id, no photo reference. */
export interface HeightRecord extends HeightMeasurement {
  /** Random UUID, linked to nothing — lets an upload be retried without duplicating the row. */
  id: string;
  kioskId: string;
  /** Local ISO-8601 with offset — the wall clock behind the kiosk, never UTC. */
  measuredAt: string;
  localDate: string;
  hour: number;
}

/** Runtime state of the sidecar, for diagnostics only. Never gates the photo flow. */
export interface HeightRuntime {
  /** The kiosk is 제주 and the feature is switched on. */
  enabled: boolean;
  /** The sidecar process is up and answered `ready`. */
  running: boolean;
  /** A floor calibration was found on disk. Without one nothing is measured. */
  calibrated: boolean;
  /** Metres from the floor to the camera, from that calibration. */
  cameraHeightM: number | null;
  lastError: string | null;
}
