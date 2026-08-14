/**
 * Open-palm / closed-fist classification from MediaPipe hand landmarks.
 *
 * 제주's camera screen hands the countdown trigger to the visitor: an open palm
 * starts it, a fist holds it. Those two poses are all this needs to tell apart,
 * so it reads the 21 landmarks directly rather than shipping the heavier canned
 * `gesture_recognizer.task` classifier — which buys 7 gestures we do not want
 * and gives no way to tune the two we do.
 *
 * ── Why distances-from-the-wrist and not "is the tip above the knuckle" ──
 * The obvious test (`tip.y < pip.y` ⇒ extended) assumes the hand is held
 * upright. Visitors do not hold it upright: they wave, they tilt, and a hand
 * raised sideways reads as a fist under that test while looking wide open on
 * screen. Comparing how FAR the tip is from the wrist against how far the
 * middle joint is is rotation-invariant — it holds however the hand is turned,
 * which is the only version that survives a real kiosk.
 */

/** One landmark as MediaPipe reports it: normalized to the frame, 0..1. */
export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export type HandGesture = 'open' | 'fist';

/**
 * Landmark indices, per MediaPipe's hand model.
 *   0 = wrist, then 4 per finger: MCP (knuckle), PIP, DIP, TIP.
 *
 * The thumb is deliberately absent. It folds across the palm on some people's
 * fists and sticks out on others', and it is the one finger whose "extended"
 * test is unreliable at kiosk distance — including it turned real fists into
 * 'none' often enough to make the hold gesture feel broken. Four fingers agree
 * far more consistently, and nobody makes a fist with four fingers open.
 */
const FINGERS: ReadonlyArray<{ pip: number; tip: number }> = [
  { pip: 6, tip: 8 }, // index
  { pip: 10, tip: 12 }, // middle
  { pip: 14, tip: 16 }, // ring
  { pip: 18, tip: 20 }, // pinky
];

const WRIST = 0;
/** Index knuckle → pinky knuckle: the palm's width, used as the hand's scale. */
const INDEX_MCP = 5;
const PINKY_MCP = 17;

function distance(a: HandLandmark, b: HandLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * A curled finger's tip sits BELOW its own middle joint on the wrist axis, an
 * extended one well beyond it. The margins are asymmetric on purpose: a pose
 * has to be clearly open to count as open and clearly closed to count as
 * closed, and anything in between is 'none' rather than a coin flip. Half-poses
 * are what produce a countdown that starts and stops on its own.
 */
const EXTENDED_RATIO = 1.15;
const CURLED_RATIO = 0.95;

/**
 * Minimum palm width, as a fraction of the frame. A hand smaller than this is
 * too far away for the landmarks to mean anything — at 제주's framing that is
 * usually a bystander walking past behind the visitor, and acting on it would
 * start someone else's countdown.
 */
const MIN_PALM_WIDTH = 0.035;

/**
 * Classify one hand. Returns null when the pose is neither — pointing, a peace
 * sign, a hand mid-way through opening, or a hand too far from the camera.
 */
export function classifyHand(landmarks: readonly HandLandmark[]): HandGesture | null {
  if (landmarks.length < 21) return null;

  const wrist = landmarks[WRIST] as HandLandmark;
  const palmWidth = distance(landmarks[INDEX_MCP] as HandLandmark, landmarks[PINKY_MCP] as HandLandmark);
  if (palmWidth < MIN_PALM_WIDTH) return null;

  let extended = 0;
  let curled = 0;
  for (const { pip, tip } of FINGERS) {
    const pipReach = distance(landmarks[pip] as HandLandmark, wrist);
    if (pipReach === 0) continue;
    const ratio = distance(landmarks[tip] as HandLandmark, wrist) / pipReach;
    if (ratio >= EXTENDED_RATIO) extended += 1;
    else if (ratio <= CURLED_RATIO) curled += 1;
  }

  // All four out — the deliberate "I'm ready" pose the guide asks for.
  if (extended === 4) return 'open';
  // All four in. A fist is the pose people hold LONGEST by accident (arms
  // folded, hands in pockets, holding a phone), so it stays strict too.
  if (curled === 4) return 'fist';
  return null;
}

/**
 * Classify a frame that may contain several hands.
 *
 * 'open' wins over 'fist' when two hands disagree: the visitor is being asked
 * to start a countdown, and the hand doing the asking should not be vetoed by
 * their other hand resting closed at their side — or by the friend standing
 * next to them in a 함께 촬영.
 */
export function classifyFrame(hands: ReadonlyArray<readonly HandLandmark[]>): HandGesture | null {
  let sawFist = false;
  for (const hand of hands) {
    const gesture = classifyHand(hand);
    if (gesture === 'open') return 'open';
    if (gesture === 'fist') sawFist = true;
  }
  return sawFist ? 'fist' : null;
}

/**
 * Debounces the per-frame classification into a stable reading.
 *
 * Raw frames flicker — a finger crosses another, the detector drops a frame,
 * and a single stray 'fist' inside an open palm would pause a countdown the
 * visitor never meant to pause. Only a pose held for `framesToConfirm`
 * consecutive frames is published, which at the ~12 fps this runs at is roughly
 * a third of a second: fast enough to feel immediate, slow enough that noise
 * never reaches the workflow.
 */
export class GestureStabilizer {
  private candidate: HandGesture | null = null;
  private streak = 0;
  private stable: HandGesture | null = null;

  constructor(private readonly framesToConfirm = 4) {}

  /** Feeds one frame's classification in; returns the current stable gesture. */
  push(gesture: HandGesture | null): HandGesture | null {
    if (gesture === this.candidate) {
      this.streak += 1;
    } else {
      this.candidate = gesture;
      this.streak = 1;
    }
    if (this.streak >= this.framesToConfirm) this.stable = this.candidate;
    return this.stable;
  }

  reset(): void {
    this.candidate = null;
    this.streak = 0;
    this.stable = null;
  }
}
