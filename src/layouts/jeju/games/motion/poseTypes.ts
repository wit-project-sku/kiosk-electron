/**
 * The vocabulary the 제주 motion games share.
 *
 * Everything downstream of the camera speaks {@link PlayerTrackingState} and
 * nothing else — a game never sees a MediaPipe result, a video element or a
 * pixel. That boundary is the whole point of this folder: three games, one
 * camera pipeline, and the games can be reasoned about (and replaced) without
 * touching vision code.
 *
 * ── Privacy ───────────────────────────────────────────────────────────
 * Nothing in these types is an image, and nothing here is ever persisted,
 * uploaded, or written to disk. A landmark is a number pair that exists for one
 * frame; the tracker holds the latest one and forgets the rest. When a game
 * ends, {@link useMotionTracking} releases the camera and drops the state.
 */

/**
 * One body point, already normalized and already turned upright — see
 * `toUpright` in poseMath. `x` 0..1 left→right AS THE PLAYER SEES IT (mirrored),
 * `y` 0..1 top→bottom.
 */
export interface BodyLandmark {
  x: number;
  y: number;
  /** MediaPipe's own visibility score, 0..1. Below ~0.5 the point is a guess. */
  visibility: number;
}

/**
 * MediaPipe's 33-point pose topology, by index.
 *
 * Only the points these games actually use are named. The legs are deliberately
 * absent from every game rule: 제주's camera is mounted between the two screens
 * at chest height in portrait, and a visitor standing where the AR photo wants
 * them is cropped at roughly the hip. A game that needed ankles would be a game
 * that never worked at this venue.
 */
export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
} as const;

/**
 * How the tracker is currently doing. Drives the on-screen coaching.
 *
 * Re-exported from `shared` rather than declared here because it CROSSES A
 * PROCESS BOUNDARY: Monitor 2 measures it and Monitor 1 renders coaching from
 * it, so the two windows have to agree on the exact union. Declaring it twice
 * is how they would eventually stop agreeing.
 */
export type { MotionTrackingStatus as TrackingStatus } from '@shared/types/motionGame';

/**
 * Everything a game is allowed to know about the person in front of it.
 *
 * Read from a REF, once per animation frame — never from React state. Inference
 * runs ~20 times a second and a state update per result would re-render every
 * game screen 20 times a second for a number only the render loop reads.
 */
export interface PlayerTrackingState {
  /** Is there a locked player right now (within the loss-grace window)? */
  detected: boolean;
  /** 0..1, smoothed, mirrored. The horizontal controller for Catch and Dodge. */
  centerX: number;
  /** 0..1, smoothed. Rarely used — the camera crops too tight to trust it. */
  centerY: number;
  /** Shoulder span as a fraction of frame width — a rough "how close are they". */
  width: number;
  /** Hip-to-shoulder span, same units. */
  height: number;
  /** 0..1. How much the games should trust the numbers above. */
  confidence: number;
  /**
   * The upright, mirrored 33-point pose, or null when nobody is locked.
   *
   * Only 포즈 챌린지 reads this. Catch and Dodge use `centerX` alone, which is
   * why they keep working when half the landmarks are off-frame.
   */
  landmarks: BodyLandmark[] | null;
  /** How many people the model saw this frame. >1 drives the 'crowded' hint. */
  people: number;
  /** performance.now() of the last frame that actually contained the player. */
  lastSeenAt: number;
}

/** The state a game sees before anyone has stepped up. */
export function emptyTrackingState(): PlayerTrackingState {
  return {
    detected: false,
    centerX: 0.5,
    centerY: 0.5,
    width: 0,
    height: 0,
    confidence: 0,
    landmarks: null,
    people: 0,
    lastSeenAt: 0,
  };
}

/**
 * The lifecycle every motion game moves through, in this order.
 *
 *   calibrating → countdown → playing → result
 *
 * `calibrating` is the "step in front of the screen" state and is the one that
 * makes these games work without a touchscreen: it does not advance until a
 * player is actually locked, so the countdown can never start into an empty
 * room. See MotionCalibration.
 */
export type { MotionGamePhase as MotionPhase } from '@shared/types/motionGame';
