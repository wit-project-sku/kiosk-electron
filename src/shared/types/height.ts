/**
 * 키 측정 — anonymous visitor-height analytics, 제주 only.
 *
 * A ZED 2i mounted beside the photo camera measures the visitor while the 제주
 * photo flow is photographing them. Nothing here reaches the renderer: there is
 * no UI, no live value, no preview. The whole feature is a number written to
 * SQLite after the fact.
 *
 * ── Why nothing links a measurement to a photo ─────────────────────────
 * A height on its own, with a timestamp, is not personal data. The same height
 * attached to a session id — and through it to a photograph of the person it was
 * taken from — is body-measurement data about an identifiable individual, which
 * under PIPA is a different thing entirely and would need its own consent
 * notice on the kiosk.
 *
 * The analytics this was asked for (what sizes of visitor come through, by hour)
 * need no such link, so the link is deliberately not made. If a future feature
 * wants height to influence the generated image, that is when the linkage gets
 * added — deliberately, with a notice — rather than something we carried
 * quietly through a test.
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
}

/** A stored row. Note what is absent: no session id, no photo reference. */
export interface HeightRecord extends HeightMeasurement {
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
