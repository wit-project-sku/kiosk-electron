import type { Detection, TrackedObject } from './types';

/**
 * ByteTrack-style multi-object tracker (no appearance model, no re-ID).
 *
 * Ported from the standalone counting prototype and trimmed to what a kiosk
 * needs. The interesting property is the DOUBLE association: a naive tracker
 * throws away every low-confidence box, so a person who turns sideways, walks
 * behind a bollard, or is briefly blurred by the rolling shutter loses their
 * track and gets a fresh id — and a fresh id crossing the line is a second
 * visitor that never existed. ByteTrack keeps those weak boxes for MATCHING
 * (they can continue a track) while refusing them for INITIATION (they cannot
 * start one), which is exactly the asymmetry that stops a corridor's worth of
 * noise from inflating the count.
 *
 * There is no appearance model and no Kalman filter — a constant-velocity
 * prediction plus greedy association is enough at these frame rates, and it
 * costs microseconds on a machine that has none to spare.
 */
export class ObjectTracker {
  private tracks: TrackedObject[] = [];
  private nextId = 1;

  getTracks(): TrackedObject[] {
    return this.tracks;
  }

  /**
   * Forget everything.
   *
   * Called whenever the camera stream is interrupted — a photo session, a
   * device replug, a resumed suspend. Track ids only mean anything within one
   * continuous view of the world; carrying them across a gap would let a track
   * from before the gap "cross" the line by teleporting.
   */
  reset(): void {
    this.tracks = [];
    this.nextId = 1;
  }

  update(
    detections: Detection[],
    options: { matchThreshold: number; trackScoreThreshold: number; maxAge: number },
  ): TrackedObject[] {
    const { matchThreshold, trackScoreThreshold, maxAge } = options;

    // Where each track should be now, if it kept doing what it was doing.
    const predictions = this.tracks.map((track) => {
      const [x, y, w, h] = track.bbox;
      const predictedBbox: [number, number, number, number] = [
        x + track.velocity.x,
        y + track.velocity.y,
        w,
        h,
      ];
      return { track, predictedBbox };
    });

    const high: Detection[] = [];
    const low: Detection[] = [];
    for (const detection of detections) {
      if (detection.confidence >= trackScoreThreshold) high.push(detection);
      else low.push(detection);
    }

    const matchedTracks = new Set<number>();

    // ── Pass 1: strong detections against every track ──────────────────
    const matchedHigh = this.associate(predictions, high, matchedTracks, matchThreshold);

    // ── Pass 2: the leftovers, weak detections against surviving tracks ─
    this.associate(predictions, low, matchedTracks, matchThreshold);

    // ── Tracks nobody matched: coast on the prediction ─────────────────
    for (let t = 0; t < predictions.length; t++) {
      if (matchedTracks.has(t)) continue;
      const { track, predictedBbox } = predictions[t]!;
      track.missedFrames += 1;
      track.bbox = predictedBbox;
      const [px, py, pw, ph] = predictedBbox;
      const centroid = { x: px + pw / 2, y: py + ph / 2 };
      track.centroid = centroid;
      pushPath(track, centroid);
      // Bleed off the velocity: a person who has been invisible for a second is
      // more likely to have stopped than to have kept walking at full speed, and
      // a coasting box that sails across the counting line is a phantom count.
      track.velocity.x *= 0.8;
      track.velocity.y *= 0.8;
    }

    // ── Strong detections nobody matched: new people ───────────────────
    for (let h = 0; h < high.length; h++) {
      if (matchedHigh.has(h)) continue;
      const detection = high[h]!;
      const [x, y, w, boxH] = detection.bbox;
      const centroid = { x: x + w / 2, y: y + boxH / 2 };
      this.tracks.push({
        id: this.nextId++,
        bbox: [x, y, w, boxH],
        confidence: detection.confidence,
        centroid,
        path: [centroid],
        hits: 1,
        missedFrames: 0,
        velocity: { x: 0, y: 0 },
      });
    }

    this.tracks = this.tracks.filter((track) => track.missedFrames <= maxAge);
    return this.tracks;
  }

  /**
   * Greedy best-first matching of `detections` against unmatched predictions.
   * Returns the indices of the detections that found a home.
   */
  private associate(
    predictions: { track: TrackedObject; predictedBbox: [number, number, number, number] }[],
    detections: Detection[],
    matchedTracks: Set<number>,
    matchThreshold: number,
  ): Set<number> {
    const pairs: { trackIndex: number; detIndex: number; score: number }[] = [];

    for (let t = 0; t < predictions.length; t++) {
      if (matchedTracks.has(t)) continue;
      const predicted = predictions[t]!.predictedBbox;
      for (let d = 0; d < detections.length; d++) {
        const score = matchScore(predicted, detections[d]!.bbox);
        if (score >= matchThreshold) pairs.push({ trackIndex: t, detIndex: d, score });
      }
    }

    pairs.sort((a, b) => b.score - a.score);

    const matchedDetections = new Set<number>();
    for (const pair of pairs) {
      if (matchedTracks.has(pair.trackIndex) || matchedDetections.has(pair.detIndex)) continue;
      matchedTracks.add(pair.trackIndex);
      matchedDetections.add(pair.detIndex);
      applyDetection(predictions[pair.trackIndex]!.track, detections[pair.detIndex]!);
    }

    return matchedDetections;
  }
}

function applyDetection(track: TrackedObject, detection: Detection): void {
  const [newX, newY, newW, newH] = detection.bbox;
  const [oldX, oldY] = track.bbox;

  // Low-pass filtered velocity. Raw frame-to-frame deltas jitter enough at this
  // frame rate to make a stationary person's box drift across the line.
  track.velocity = {
    x: 0.6 * (newX - oldX) + 0.4 * track.velocity.x,
    y: 0.6 * (newY - oldY) + 0.4 * track.velocity.y,
  };
  track.bbox = [newX, newY, newW, newH];
  track.confidence = detection.confidence;
  track.hits += 1;
  track.missedFrames = 0;

  const centroid = { x: newX + newW / 2, y: newY + newH / 2 };
  track.centroid = centroid;
  pushPath(track, centroid);
}

/** Keep a short tail — the crossing test only ever reads the last two points. */
function pushPath(track: TrackedObject, centroid: { x: number; y: number }): void {
  track.path.push(centroid);
  if (track.path.length > 8) track.path.shift();
}

/**
 * How far apart two boxes may be, in box-widths, and still be the same person.
 *
 * This is the part a textbook SORT/ByteTrack does not need and a kiosk does. At
 * 30 fps a walking person barely moves between frames and their boxes always
 * overlap, so IoU alone associates them. At the handful of frames per second
 * this runs at, a person crossing the view can move most of their own width
 * between passes — and two boxes that do not touch have an IoU of exactly zero,
 * which is indistinguishable from "different person on the other side of the
 * corridor". Every track would then be one frame long and nothing would ever be
 * counted (measured, not assumed — see the walk-across test).
 *
 * Note where the cost actually falls: it is ONLY the first association that has
 * to bridge the full step, because a track that has matched once carries a
 * velocity and its prediction lands on top of the next detection. So the loose
 * gate applies to bootstrapping a track, not to keeping one, which is what
 * keeps it from stealing identities in a crowd.
 */
const MAX_GAP_WIDTHS = 1.2;

/**
 * Association score in [0, 1], thresholded by `matchThreshold`.
 *
 * Overlapping boxes score in [0.5, 1] and disjoint-but-near ones in [0, 0.5),
 * so any real overlap always outranks any proximity guess in the greedy sort.
 * That ordering is the point of folding both into one number: a threshold near
 * 0.3 then reads as "accept any overlap, and accept a gap of up to about half
 * the search radius".
 */
function matchScore(
  predicted: [number, number, number, number],
  detected: [number, number, number, number],
): number {
  const iou = intersectionOverUnion(predicted, detected);
  if (iou > 0) return 0.5 + 0.5 * iou;

  const [px, py, pw, ph] = predicted;
  const [dx, dy, dw, dh] = detected;
  const meanWidth = (pw + dw) / 2;
  if (meanWidth === 0) return 0;

  const centreDx = px + pw / 2 - (dx + dw / 2);
  const centreDy = py + ph / 2 - (dy + dh / 2);
  const gap = Math.hypot(centreDx, centreDy) / meanWidth;
  if (gap > MAX_GAP_WIDTHS) return 0;

  // A person does not change size between two frames. Without this, a distant
  // box and a near one that happen to be close on screen could be matched.
  const scale =
    (Math.min(pw, dw) / Math.max(pw, dw)) * (Math.min(ph, dh) / Math.max(ph, dh));
  if (scale < 0.4) return 0;

  return 0.5 * (1 - gap / MAX_GAP_WIDTHS) * scale;
}

export function intersectionOverUnion(
  boxA: [number, number, number, number],
  boxB: [number, number, number, number],
): number {
  const [ax, ay, aw, ah] = boxA;
  const [bx, by, bw, bh] = boxB;

  const x1 = Math.max(ax, bx);
  const y1 = Math.max(ay, by);
  const x2 = Math.min(ax + aw, bx + bw);
  const y2 = Math.min(ay + ah, by + bh);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (intersection === 0) return 0;

  return intersection / (aw * ah + bw * bh - intersection);
}
