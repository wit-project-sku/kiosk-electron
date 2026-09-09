/**
 * The geometry between MediaPipe's output and a playable controller.
 *
 * Pure functions, no state, no DOM — everything here is testable in isolation
 * and none of it knows a camera exists.
 *
 * ── Rotation is NOT done here any more ────────────────────────────────
 * It used to be, and that was the wrong place. A pose model has to be handed an
 * UPRIGHT frame or it will not find a person at all, so the turn now happens
 * before inference, on PoseTracker's own canvas — by the time landmarks reach
 * this file they are already the right way up. Turning them again here would
 * undo it.
 *
 * `toUpright` therefore only mirrors, and keeps its rotation argument solely so
 * a venue whose frames arrive pre-rotated by some other path can still be
 * handled without a second function.
 *
 * ── Mirroring, which IS mandatory ─────────────────────────────────────
 *     The player is looking at a screen, not through a window. A
 *     camera sees their left hand on the frame's right. If the game moved the
 *     basket the way the raw data says, stepping right would move it left —
 *     the single most disorienting thing a body-controlled game can do. Every
 *     x below is therefore flipped, exactly like a bathroom mirror.
 *
 *     Note this is the OPPOSITE choice from `useKioskCamera.capture`, which
 *     deliberately does not mirror — a mirrored photograph flips the text on
 *     someone's t-shirt. A control surface and a photograph want opposite
 *     things, and both are right.
 */
import type { BodyLandmark, PlayerTrackingState } from './poseTypes';
import { LM } from './poseTypes';

/** MediaPipe's raw landmark, before either correction. */
export interface RawLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type CameraRotation = 0 | 90 | 180 | 270;

/**
 * Turn a raw normalized point upright, then mirror it.
 *
 * The rotation cases are the same quarter-turns `useKioskCamera.capture`
 * applies to the canvas, done in normalized space: rotating the FRAME clockwise
 * by θ moves a point the same way, and for a quarter turn the axes swap because
 * the output's width is the input's height.
 *
 *   90°:  (x, y) → (1 − y,     x)
 *   180°: (x, y) → (1 − x, 1 − y)
 *   270°: (x, y) → (    y, 1 − x)
 *
 * The final `1 − x` is the mirror, applied after the turn so it always flips the
 * player's real-world horizontal axis rather than whichever raw axis happened to
 * be pointing sideways.
 */
export function toUpright(
  x: number,
  y: number,
  rotation: CameraRotation,
): { x: number; y: number } {
  let ux: number;
  let uy: number;
  switch (rotation) {
    case 90:
      ux = 1 - y;
      uy = x;
      break;
    case 180:
      ux = 1 - x;
      uy = 1 - y;
      break;
    case 270:
      ux = y;
      uy = 1 - x;
      break;
    default:
      ux = x;
      uy = y;
  }
  return { x: 1 - ux, y: uy };
}

/** Convert a whole MediaPipe pose into game space. */
export function toBodyLandmarks(
  raw: readonly RawLandmark[],
  rotation: CameraRotation,
): BodyLandmark[] {
  return raw.map((p) => {
    const { x, y } = toUpright(p.x, p.y, rotation);
    return { x, y, visibility: p.visibility ?? 0 };
  });
}

/** Average of the points that are actually visible, or null if none are. */
function meanOf(
  landmarks: readonly BodyLandmark[],
  indices: readonly number[],
  minVisibility: number,
): { x: number; y: number; visibility: number } | null {
  let sx = 0;
  let sy = 0;
  let sv = 0;
  let n = 0;
  for (const i of indices) {
    const p = landmarks[i];
    if (!p || p.visibility < minVisibility) continue;
    sx += p.x;
    sy += p.y;
    sv += p.visibility;
    n += 1;
  }
  if (n === 0) return null;
  return { x: sx / n, y: sy / n, visibility: sv / n };
}

/** Below this a landmark is MediaPipe guessing at an occluded joint. */
const MIN_VISIBILITY = 0.45;

/**
 * Where the player is, as one number the games can steer with.
 *
 * ── Why the fallback ladder ───────────────────────────────────────────
 * The brief asks for body centre, then torso, then hips. In practice at this
 * venue the order is the other way round in reliability terms, so this takes
 * the best AVAILABLE estimate rather than a fixed joint:
 *
 *   hips + shoulders  → the true torso centre, and the steadiest signal there
 *                       is. Arms wave; a torso does not.
 *   shoulders only    → the common case here, because the camera crops at the
 *                       hip. Slightly higher than the real centre, which does
 *                       not matter: the games only use the HORIZONTAL value.
 *   nose              → last resort. Jittery (a head turn moves it) but far
 *                       better than dropping the frame and stalling the player.
 *
 * Returning null means "this frame told us nothing", which the caller treats as
 * a dropped frame inside the loss-grace window — not as the player leaving.
 */
export function torsoCenter(landmarks: readonly BodyLandmark[]): {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
} | null {
  const shoulders = meanOf(landmarks, [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER], MIN_VISIBILITY);
  const hips = meanOf(landmarks, [LM.LEFT_HIP, LM.RIGHT_HIP], MIN_VISIBILITY);

  const ls = landmarks[LM.LEFT_SHOULDER];
  const rs = landmarks[LM.RIGHT_SHOULDER];
  // Shoulder span doubles as a crude distance gauge: it shrinks as the visitor
  // steps back. Games use it only to notice someone standing far too close.
  const width = ls && rs ? Math.abs(ls.x - rs.x) : 0;

  if (shoulders && hips) {
    return {
      x: (shoulders.x + hips.x) / 2,
      y: (shoulders.y + hips.y) / 2,
      width,
      height: Math.abs(hips.y - shoulders.y),
      confidence: Math.min(1, (shoulders.visibility + hips.visibility) / 2),
    };
  }
  if (shoulders) {
    return {
      x: shoulders.x,
      y: shoulders.y,
      width,
      height: 0,
      confidence: shoulders.visibility * 0.9,
    };
  }
  const nose = landmarks[LM.NOSE];
  if (nose && nose.visibility >= MIN_VISIBILITY) {
    // Explicitly discounted: a head is not a torso, and the games should treat
    // a nose-only frame as something to coast through rather than trust.
    return { x: nose.x, y: nose.y, width, height: 0, confidence: nose.visibility * 0.6 };
  }
  return null;
}

/**
 * Exponential smoothing with a real time constant.
 *
 * `1 - exp(-dt / tau)` rather than a fixed per-frame alpha, because the
 * inference loop's interval is not constant — it slows under load, and a fixed
 * alpha would make the controller feel heavier exactly when the machine is
 * struggling. With tau the response is the same wall-clock speed regardless.
 *
 * tau ≈ 0.09s is the sweet spot found for this camera: shorter and the shoulder
 * jitter reaches the screen, longer and the basket lags visibly behind a quick
 * sidestep.
 */
export function smoothToward(
  current: number,
  target: number,
  dtSeconds: number,
  tau = 0.09,
): number {
  if (dtSeconds <= 0) return current;
  const alpha = 1 - Math.exp(-dtSeconds / tau);
  return current + (target - current) * alpha;
}

/**
 * Stretch the usable slice of the frame across the full play area.
 *
 * A visitor does not walk the entire width of the camera's view — they shuffle
 * a step either side of centre, which without this maps to the middle third of
 * the screen and makes the game feel unresponsive and the edges unreachable.
 * Rescaling the middle band to the full 0..1 means a comfortable sidestep
 * reaches the edge of the play field.
 */
export function expandRange(x: number, band = 0.62): number {
  const lo = 0.5 - band / 2;
  return Math.max(0, Math.min(1, (x - lo) / band));
}

/** Is the player inside the band the games consider playable? */
export function isInPlayArea(state: PlayerTrackingState): boolean {
  // Deliberately wider than the play field itself. This drives a coaching
  // message, and nagging someone who is only slightly off-centre would be worse
  // than saying nothing.
  return state.centerX > 0.04 && state.centerX < 0.96;
}

/**
 * How much this pose looks like a real person standing in front of a kiosk.
 *
 * ══ WHY THIS EXISTS ═══════════════════════════════════════════════════
 * MediaPipe does not answer "is anyone there" with a yes or a no. Handed a
 * frame with a person lying sideways in it — which is exactly what a camera
 * whose rotation setting has been lost produces — it will still return a pose:
 * a low-confidence skeleton draped over whatever it found, with joints in
 * implausible places.
 *
 * The orientation probe cannot treat that as success. If it does, it locks onto
 * the wrong orientation on the first frame, and everything downstream reads the
 * garbage: a nonsense shoulder span becomes "step closer", forever, to a
 * visitor who is already close. That was a real failure on the floor.
 *
 * So the probe asks how GOOD the pose is, and only settles for a plausible one.
 *
 * Three things have to hold for a real standing visitor, and none of them holds
 * reliably for a skeleton fitted to a sideways body:
 *   · both shoulders actually visible, not inferred;
 *   · the shoulder line roughly level — a standing person's is, a sideways
 *     one's is nearly vertical;
 *   · a plausible apparent size.
 */
export function poseQuality(landmarks: readonly BodyLandmark[]): number {
  const ls = landmarks[LM.LEFT_SHOULDER];
  const rs = landmarks[LM.RIGHT_SHOULDER];
  if (!ls || !rs) return 0;

  // Confidence in the two joints everything else is measured from.
  const vis = Math.min(ls.visibility, rs.visibility);
  if (vis < MIN_VISIBILITY) return 0;

  const dx = Math.abs(ls.x - rs.x);
  const dy = Math.abs(ls.y - rs.y);
  if (dx < 0.01) return 0;

  // Level-ness. A standing person's shoulders are near-horizontal; a body lying
  // on its side has them near-vertical, which is the signal that the frame is
  // the wrong way up. Full marks below ~30° of tilt, nothing past ~60°.
  const tilt = Math.atan2(dy, dx);
  const level = Math.max(0, Math.min(1, (Math.PI / 3 - tilt) / (Math.PI / 3 - Math.PI / 6)));

  // A torso, if we can see one, is strong corroboration.
  const hips = meanOf(landmarks, [LM.LEFT_HIP, LM.RIGHT_HIP], MIN_VISIBILITY);
  const torso = hips ? 1 : 0.75;

  return vis * level * torso;
}

/**
 * Apparent size of the visitor, independent of the frame's shape.
 *
 * Shoulder span as a fraction of frame WIDTH is not comparable between a
 * portrait frame and a landscape one — the same person at the same distance
 * scores roughly half as much in landscape, which is enough to trip a
 * "step closer" threshold tuned on portrait. Measuring against the frame's
 * SHORTER edge removes the frame's shape from the answer.
 *
 * Returns 0 when there is nothing to measure.
 */
export function apparentSize(
  landmarks: readonly BodyLandmark[],
  frameW: number,
  frameH: number,
): number {
  const ls = landmarks[LM.LEFT_SHOULDER];
  const rs = landmarks[LM.RIGHT_SHOULDER];
  if (!ls || !rs || ls.visibility < MIN_VISIBILITY || rs.visibility < MIN_VISIBILITY) return 0;
  if (!frameW || !frameH) return 0;
  const spanPx = Math.abs(ls.x - rs.x) * frameW;
  return spanPx / Math.min(frameW, frameH);
}
