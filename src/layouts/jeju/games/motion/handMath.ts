/**
 * The geometry between MediaPipe's hand output and a playable controller.
 *
 * The hand-shaped half of `poseMath` — pure functions, no state, no DOM, and
 * none of it knows a camera exists. Mirroring, smoothing and range expansion
 * are shared with poseMath rather than reimplemented, because a hand and a body
 * steer the SAME games and must feel the same doing it.
 *
 * ── Mirroring is mandatory, for the same reason ───────────────────────
 * The player is looking at a screen, not through a window. A camera sees their
 * raised right hand on the frame's left. Moving the basket the way the raw data
 * says would mean the basket runs away from the hand — the single most
 * disorienting thing a camera-controlled game can do. See poseMath's header.
 */
import type { HandLandmark } from '@renderer/lib/handGesture';
import { toUpright, type CameraRotation } from './poseMath';

/**
 * The landmark indices this file uses, per MediaPipe's 21-point hand topology.
 *
 * Only the wrist and the four finger knuckles: together they are the PALM, and
 * the palm is the part of a hand that does not change shape. Fingertips move
 * several percent of the frame when someone merely opens their hand, so a
 * controller anchored to one would drift sideways every time the player relaxed
 * their grip.
 */
const WRIST = 0;
const INDEX_MCP = 5;
const MIDDLE_MCP = 9;
const RING_MCP = 13;
const PINKY_MCP = 17;

/** The five points averaged into the palm centre. */
const PALM = [WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP] as const;

/** Convert one raw hand into game space: upright (already) and mirrored. */
export function toGameHand(raw: readonly HandLandmark[], rotation: CameraRotation): HandLandmark[] {
  return raw.map((p) => {
    const { x, y } = toUpright(p.x, p.y, rotation);
    return { x, y, z: p.z };
  });
}

/** Where a hand is and how big it looks. Null when the array is not a hand. */
export interface HandCentre {
  /** Palm centre, 0..1 of the frame, mirrored. The controller. */
  x: number;
  y: number;
  /**
   * Palm width — index knuckle to pinky knuckle — as a fraction of frame width.
   *
   * The hand's own scale, and the closest thing to a distance gauge there is:
   * it grows as the visitor reaches toward the camera and shrinks as they step
   * back. Also the thing that tells a player's hand from a bystander's, three
   * metres further down the concourse.
   */
  span: number;
}

export function handCentre(landmarks: readonly HandLandmark[]): HandCentre | null {
  if (landmarks.length < 21) return null;

  let sx = 0;
  let sy = 0;
  for (const i of PALM) {
    const p = landmarks[i];
    if (!p) return null;
    sx += p.x;
    sy += p.y;
  }

  const index = landmarks[INDEX_MCP];
  const pinky = landmarks[PINKY_MCP];
  if (!index || !pinky) return null;
  const dx = index.x - pinky.x;
  const dy = index.y - pinky.y;

  return {
    x: sx / PALM.length,
    y: sy / PALM.length,
    span: Math.sqrt(dx * dx + dy * dy),
  };
}

/**
 * Apparent size of the hand, independent of the frame's shape.
 *
 * Exactly the argument `apparentSize` makes for shoulders: a span measured as a
 * fraction of frame WIDTH is not comparable between a portrait frame and a
 * landscape one, and the difference is easily enough to trip a distance
 * threshold tuned on the other. Measuring against the SHORTER edge takes the
 * frame's shape out of the answer.
 */
export function handApparentSize(span: number, frameW: number, frameH: number): number {
  if (!frameW || !frameH) return 0;
  return (span * frameW) / Math.min(frameW, frameH);
}

/**
 * How much this really looks like a HAND. Not how far away it is.
 *
 * ══ SHAPE ONLY, AND THAT SEPARATION MATTERS ═══════════════════════════
 * MediaPipe will fit 21 points to a fair amount of nonsense — a face at the
 * right scale, a pattern on a jacket — and a controller that follows one of
 * those is a game that moves on its own. So something has to refuse them.
 *
 * But distance must NOT be folded in here. If a far hand scored badly enough to
 * be refused, "hold your hand a little closer" could never appear: the hand
 * would be rejected before there was anyone to coach, and the visitor would see
 * "raise one hand" while raising one. That is the same dead end the distance
 * GATE on the body version produced, in a new place — see MotionCalibration.
 *
 * So this answers one question, about shape: the fingers sit within a hand's
 * reach of the wrist. A real hand's middle fingertip is roughly one to three
 * palm-widths away; a smear fitted to a jacket seam is not. Scale only softens
 * the score, never to zero. The hard "that is somebody else's hand down the
 * concourse" floor is a span test, and it belongs to the caller, next to the
 * coaching thresholds it has to stay consistent with.
 *
 * Returns 0..1, used to rank candidates and refuse the hopeless ones.
 */
export function handQuality(landmarks: readonly HandLandmark[], span: number): number {
  if (landmarks.length < 21 || span <= 0.001) return 0;

  const wrist = landmarks[WRIST];
  const middleTip = landmarks[12];
  if (!wrist || !middleTip) return 0;

  const dx = middleTip.x - wrist.x;
  const dy = middleTip.y - wrist.y;
  const reach = Math.sqrt(dx * dx + dy * dy) / span;

  // Generous on purpose: this refuses garbage, it does not grade technique. A
  // fist (reach ≈ 1.1) and a splayed open palm (reach ≈ 3) must both score full
  // marks, because both are poses a player will hold for a whole run.
  if (reach < 0.5 || reach > 4.5) return 0;
  const plausible = reach >= 0.9 && reach <= 3.6 ? 1 : 0.6;

  // A bigger hand is a better-resolved one, so a close hand outranks a distant
  // one when both are plausible — which is how the right hand gets the controls
  // when a bystander's is also in frame. Never below half: this is a tie-break,
  // not a distance gate.
  const scale = Math.max(0, Math.min(1, (span - 0.01) / 0.05));

  return plausible * (0.5 + 0.5 * scale);
}
