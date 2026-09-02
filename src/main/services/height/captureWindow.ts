import type { PhotoWorkflowPhase } from '@shared/types/photo';
import type { HeightMeasurement } from '@shared/types/height';

/**
 * When the ZED is allowed to sample, and how its answer is read.
 *
 * Separated from HeightService so both decisions can be checked by
 * `npm run height:selftest` — neither needs Electron, a database or a camera,
 * and both are the kind of thing that breaks silently rather than loudly.
 */

/**
 * Is the camera live, i.e. is the visitor standing in front of the kiosk?
 *
 * This is the measurement window, and it is deliberately WIDER than the
 * countdown. 제주 arms the 손동작 게이트 first (`preview`), so the visitor has
 * already walked into position and started posing before the 10 seconds begin —
 * sampling from `preview` rather than `countdown` yields 15-30 s of frames
 * instead of 10, which is what lets the sidecar take a median and stop caring
 * about individual bad frames.
 *
 * Exhaustive on purpose rather than a `!==` list: adding a phase to
 * PhotoWorkflowPhase should be a compile error here, not a silent change to how
 * long the ZED watches for.
 */
export function isCameraLive(phase: PhotoWorkflowPhase): boolean {
  switch (phase) {
    case 'preview':
    case 'countdown':
      return true;
    case 'idle':
    case 'clothing':
    case 'style':
    case 'generating':
    case 'result':
      return false;
    default: {
      // A phase nobody taught this function about. Not sampling is the safe
      // reading: an over-long window would fold the previous visitor's frames
      // into the next visitor's median.
      const exhaustive: never = phase;
      void exhaustive;
      return false;
    }
  }
}

/**
 * Read a `result` frame off the sidecar.
 *
 * Defensive about every field. This parses output from a separate process that
 * is upgraded independently of the app — a kiosk can easily be running a
 * sidecar built from a different commit — so a missing or wrong-typed field
 * must degrade to "no measurement", never throw inside the photo workflow's
 * broadcast.
 */
export function toMeasurement(event: Record<string, unknown>): HeightMeasurement {
  return {
    heightCm: finiteOrNull(event['heightCm']),
    confidence: finiteOr(event['confidence'], 0),
    samples: finiteOr(event['samples'], 0),
    subjects: finiteOr(event['subjects'], 0),
    reason: typeof event['reason'] === 'string' ? event['reason'] : null,
  };
}

export function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function finiteOr(value: unknown, fallback: number): number {
  return finiteOrNull(value) ?? fallback;
}
