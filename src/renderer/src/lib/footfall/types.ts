/**
 * Vision-pipeline types for 유동인구 counting.
 *
 * Boxes are `[x, y, width, height]` in the CAMERA's own pixel space, not
 * normalized and not scaled to any element on screen: the detector reports in
 * that space, the tracker compares in it, and the counting line is projected
 * into it once per frame. Nothing here is ever rendered, so there is no third
 * coordinate system to get wrong.
 */

export interface Detection {
  bbox: [number, number, number, number];
  confidence: number;
}

export interface TrackedObject {
  id: number;
  bbox: [number, number, number, number];
  confidence: number;
  centroid: { x: number; y: number };
  /** Recent centroids; the last two are what a crossing test looks at. */
  path: { x: number; y: number }[];
  /** Detections this track has been matched with — noise never gets far. */
  hits: number;
  /** Consecutive frames coasting on prediction alone. */
  missedFrames: number;
  velocity: { x: number; y: number };
}
