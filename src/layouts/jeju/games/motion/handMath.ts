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

/** Middle joint and tip of each of the four fingers. The thumb is left out. */
const GAME_FINGERS: ReadonlyArray<{ pip: number; tip: number }> = [
  { pip: 6, tip: 8 },
  { pip: 10, tip: 12 },
  { pip: 14, tip: 16 },
  { pip: 18, tip: 20 },
];

/**
 * Open hand, V-sign or fist, tuned for a GAME controller rather than a trigger.
 *
 * ══ WHY NOT THE CAPTURE SCREEN'S CLASSIFIER ═══════════════════════════
 * `classifyHand` in lib/handGesture starts a photo countdown, so it is strict
 * on purpose: all four fingers must agree, and a hand below a minimum size is
 * ignored. A false positive there fires a camera at somebody.
 *
 * Here the fist is how she DUCKS, and the costs are the other way round. A fist
 * the model reads with one finger half-open — very common, because a curled
 * finger hides behind its neighbours — must still count, or the visitor makes a
 * perfectly good fist and gets hit by the gull. So three fingers of four decide
 * it, and there is no size floor (the tracker already refuses hands too small
 * to be the player's).
 *
 * The thumb is excluded for the same reason as there: it folds across a fist on
 * some people and sticks out on others.
 *
 * ══ ✌️ IS THE JUMP ════════════════════════════════════════════════════
 * Jumping used to be "move your hand up", measured against where the hand
 * rested during the countdown, and visitors found it very hard: nothing says
 * how far "up" is, the rest point drifts as an arm tires, and a jump would not
 * re-arm until the hand came back down. A SHAPE has none of that — like the
 * fist, it is either made or it is not, wherever the hand happens to be.
 *
 * A V-sign because nearly every visitor already makes one for photos, and
 * because it sits cleanly between the other two shapes: index finger OUT, ring
 * and pinky IN. A sloppy V whose middle finger folds is a pointing finger,
 * which is still index-out, ring-and-pinky-in — so it still jumps rather than
 * falling through to a fist. That is why the fist also needs the index in.
 *
 * Returns null for anything in between — a hand changing shape. The caller
 * treats null as "no change", which is what stops the half-second it takes to
 * close a hand from flickering her up and down.
 */
export type GameHandShape = 'open' | 'fist' | 'victory' | 'point';

export function classifyGameHand(landmarks: readonly HandLandmark[]): GameHandShape | null {
  if (landmarks.length < 21) return null;
  const wrist = landmarks[WRIST];
  if (!wrist) return null;

  // Per finger — index, middle, ring, pinky: 1 extended, -1 curled, 0 unsure.
  const fingers: number[] = [];
  for (const { pip, tip } of GAME_FINGERS) {
    const p = landmarks[pip];
    const t = landmarks[tip];
    const pipReach = p ? Math.hypot(p.x - wrist.x, p.y - wrist.y) : 0;
    if (!p || !t || pipReach <= 0) {
      fingers.push(0);
      continue;
    }
    // Rotation-invariant: how far the tip is from the wrist, against how far the
    // middle joint is. Curled tips come back in past their own middle joint.
    const ratio = Math.hypot(t.x - wrist.x, t.y - wrist.y) / pipReach;
    // 0.9, not the capture gate's looser-looking 1.0: against a kinematic hand
    // model, 1.0 called a half-closed "claw" (50% curl) a fist, and 0.9 moves
    // that boundary to 60% while a loose 70–80% fist still counts.
    fingers.push(ratio >= 1.15 ? 1 : ratio <= 0.9 ? -1 : 0);
  }
  const [index, middle, ring, pinky] = fingers as [number, number, number, number];
  const extended = fingers.filter((f) => f === 1).length;
  const curled = fingers.filter((f) => f === -1).length;

  // ✌️ / ☝️ before the fist: a pointing finger has three curled fingers too.
  // Told apart because a fist OPENING passes through ☝️ when the index finger
  // leads — runControl refuses that one for a moment after a fist.
  if (index === 1 && ring === -1 && pinky === -1) return middle === -1 ? 'point' : 'victory';
  if (curled >= 3 && index !== 1) return 'fist';
  if (extended >= 3) return 'open';
  return null;
}
