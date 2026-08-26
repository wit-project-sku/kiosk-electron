import type { FootfallDirection, FootfallLine } from '@shared/types/footfall';
import type { TrackedObject } from './types';

export interface Crossing {
  trackId: number;
  direction: FootfallDirection;
}

/**
 * Counts tracks that cross the counting line, once each.
 *
 * ── Why a line and not "how many boxes are on screen" ──────────────────
 * Because the interesting number is people who WENT PAST, and a headcount of
 * the frame answers a different question badly: someone reading the kiosk for
 * four minutes would be counted every frame, and a poster of a person would be
 * counted forever. A crossing is an event — it happens once, it has a
 * direction, and standing still cannot produce one.
 *
 * ── Why an id can only ever be counted once ────────────────────────────
 * Someone waiting for a friend by the counting line will drift back and forth
 * across it a dozen times. `countedIds` means the first crossing is the only
 * one; the id is retired the moment it fires and the tracker eventually drops
 * it. That trades a genuine second pass by the same person (rare, and they get
 * a new id once the track expires) for immunity to loitering (constant, and it
 * would otherwise dominate the data at a kiosk, which is a place people stand).
 */
export class LineCrossingCounter {
  private readonly countedIds = new Set<number>();

  /** Forget counted ids. Pairs with ObjectTracker.reset() — same reason. */
  reset(): void {
    this.countedIds.clear();
  }

  /**
   * Test every track's last step against the line.
   *
   * @param minHits Detections a track needs before it may be counted. A person
   *   is a thing that has been seen several times in a row; one flickering box
   *   that happens to appear on the far side of the line is not.
   */
  check(
    tracks: TrackedObject[],
    line: FootfallLine,
    frameWidth: number,
    frameHeight: number,
    minHits: number,
  ): Crossing[] {
    const crossings: Crossing[] = [];
    const vertical = line.orientation === 'vertical';

    // The line as a segment spanning the frame, in camera pixels.
    const linePosition = vertical ? line.position * frameWidth : line.position * frameHeight;
    const lineA = vertical ? { x: linePosition, y: 0 } : { x: 0, y: linePosition };
    const lineB = vertical
      ? { x: linePosition, y: frameHeight }
      : { x: frameWidth, y: linePosition };

    for (const track of tracks) {
      if (this.countedIds.has(track.id)) continue;
      if (track.hits < minHits) continue;
      if (track.path.length < 2) continue;
      // A coasting track has no evidence behind its movement; let it come back
      // into view and cross for real rather than counting a prediction.
      if (track.missedFrames > 0) continue;

      const previous = track.path[track.path.length - 2]!;
      const current = track.centroid;
      if (!segmentsIntersect(lineA, lineB, previous, current)) continue;

      // Direction along the axis the line cuts: rightwards past a vertical line,
      // downwards past a horizontal one.
      const direction: FootfallDirection = vertical
        ? current.x > previous.x
          ? 'in'
          : 'out'
        : current.y > previous.y
          ? 'in'
          : 'out';

      this.countedIds.add(track.id);
      crossings.push({ trackId: track.id, direction });
    }

    // The set would otherwise grow for the lifetime of the process. Ids are
    // monotonic, so anything far below the oldest live track can never recur.
    if (this.countedIds.size > 512) {
      const oldestLive = tracks.reduce((min, t) => Math.min(min, t.id), Number.MAX_SAFE_INTEGER);
      for (const id of this.countedIds) {
        if (id < oldestLive) this.countedIds.delete(id);
      }
    }

    return crossings;
  }
}

interface Point {
  x: number;
  y: number;
}

/** Standard counter-clockwise orientation test for segment intersection. */
function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const ccw = (p1: Point, p2: Point, p3: Point): boolean =>
    (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);

  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}
