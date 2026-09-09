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

/**
 * How closely two poses match, 0..1.
 *
 * ── Why angles and not point distances ────────────────────────────────
 * Comparing landmark positions directly would score a tall adult and a small
 * child differently for the identical pose, and would move the score when the
 * visitor takes a step sideways. What actually defines "hands up" is the ANGLE
 * of the upper arm and forearm, which is invariant to where the person is
 * standing, how big they are, and how far from the camera.
 *
 * Each limb contributes its angular error, mapped through a tolerance so that
 * being 20° out still scores well — this is a tourist attraction, not a dance
 * exam. Limbs whose landmarks are not visible are skipped rather than counted
 * as wrong, so a visitor cropped at the hip is not punished for having no legs
 * in frame.
 */
export interface LimbSpec {
  /** Landmark indices: the joint the limb pivots on, then its far end. */
  from: number;
  to: number;
  /** Target angle in degrees, measured screen-wise: 0 = right, 90 = down. */
  angle: number;
  /** Relative importance. A pose's headline limbs weigh more than its details. */
  weight: number;
}

/** Angle of the vector from → to, in degrees, 0 = +x (screen right). */
export function limbAngle(
  landmarks: readonly BodyLandmark[],
  from: number,
  to: number,
): number | null {
  const a = landmarks[from];
  const b = landmarks[to];
  if (!a || !b || a.visibility < MIN_VISIBILITY || b.visibility < MIN_VISIBILITY) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Too short to have a meaningful direction — an arm pointing at the camera.
  if (Math.hypot(dx, dy) < 0.03) return null;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** Smallest absolute difference between two angles, 0..180. */
function angleDelta(a: number, b: number): number {
  const d = Math.abs(((a - b + 180) % 360) - 180);
  return d;
}

/**
 * Degrees of error that still scores full marks, and the point at which a limb
 * scores zero. Generous on purpose — see the note on scorePose.
 */
const FORGIVING_DEG = 22;
const ZERO_AT_DEG = 95;

/**
 * Score a pose against a target, 0..1, plus how much of it we could actually
 * see. A `coverage` below ~0.4 means the score is guesswork and the caller
 * should ask the visitor to step back rather than show them a number.
 */
export function scorePose(
  landmarks: readonly BodyLandmark[],
  limbs: readonly LimbSpec[],
): { score: number; coverage: number } {
  let total = 0;
  let scored = 0;
  let weightSeen = 0;
  let weightAll = 0;

  for (const limb of limbs) {
    weightAll += limb.weight;
    const actual = limbAngle(landmarks, limb.from, limb.to);
    if (actual === null) continue;
    weightSeen += limb.weight;
    const error = angleDelta(actual, limb.angle);
    // Flat top then linear falloff: everything inside FORGIVING_DEG is a
    // perfect limb, so a visitor who is clearly doing the pose gets told so
    // rather than being docked for a few degrees of wrist droop.
    const limbScore =
      error <= FORGIVING_DEG
        ? 1
        : Math.max(0, 1 - (error - FORGIVING_DEG) / (ZERO_AT_DEG - FORGIVING_DEG));
    total += limbScore * limb.weight;
    scored += limb.weight;
  }

  return {
    score: scored > 0 ? total / scored : 0,
    coverage: weightAll > 0 ? weightSeen / weightAll : 0,
  };
}

/** Is the player inside the band the games consider playable? */
export function isInPlayArea(state: PlayerTrackingState): boolean {
  // Deliberately wider than the play field itself. This drives a coaching
  // message, and nagging someone who is only slightly off-centre would be worse
  // than saying nothing.
  return state.centerX > 0.04 && state.centerX < 0.96;
}
