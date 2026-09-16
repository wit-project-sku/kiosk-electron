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

import type { HandGesture } from '@renderer/lib/handGesture';

/**
 * One body point, already normalized and already turned upright — see
 * `toUpright` in poseMath. `x` 0..1 left→right AS THE PLAYER SEES IT (mirrored),
 * `y` 0..1 top→bottom.
 */
export type { HandGesture } from '@renderer/lib/handGesture';

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
  /**
   * What is actually driving the game, or null when nothing is.
   *
   * ── Games branch on this, they do not choose it ───────────────────────
   * The tracker picks: a raised HAND wherever there is one, the BODY when there
   * is not (see the fallback in useMotionTracking). A game never asks for one
   * or the other — `centerX`/`centerY` mean the same thing either way — but the
   * two move at very different scales, and a game with a movement THRESHOLD has
   * to know which it is reading. Raising a hand crosses a third of the frame;
   * jumping moves the shoulders by a twentieth of it. One threshold cannot
   * serve both, and 제주 달리기 is the game that proves it.
   */
  source: 'hand' | 'body' | null;
  /**
   * 0..1, smoothed, mirrored, range-expanded. THE HORIZONTAL CONTROLLER.
   *
   * The palm centre when a hand is steering, the torso centre when the body is.
   * Deliberately the same field for both: 감귤 받기 maps this onto the basket
   * and has never needed to know which one it is reading.
   */
  centerX: number;
  /**
   * 0..1, smoothed, mirrored. THE VERTICAL CONTROLLER.
   *
   * The palm centre when a hand is steering, the shoulder line when the body
   * is. Used against a baseline measured on this visitor during the countdown,
   * never as an absolute — where a hand or a shoulder sits in the frame depends
   * on the person's height and how far back they stood.
   */
  centerY: number;
  /**
   * Apparent size of whatever is steering, as a fraction of the frame's SHORT
   * edge — palm width for a hand, shoulder span for a body. A rough "how close
   * are they", and the only thing the distance coaching is computed from.
   */
  width: number;
  /** Hip-to-shoulder span, same units. Zero while a hand is steering. */
  height: number;
  /** 0..1. How much the games should trust the numbers above. */
  confidence: number;
  /**
   * The open palm / closed fist the steering hand is holding, or null.
   *
   * Classified by the same `handGesture` code the capture screen's 손동작 게이트
   * uses. No game requires it today — the controller is positional, which is
   * legible without instructions — but it is the natural home for a discrete
   * action, and it costs nothing to publish from a hand we have already found.
   */
  gesture: HandGesture | null;
  /**
   * The upright, mirrored 33-point pose, or null when no BODY is locked.
   *
   * Null throughout a hand-steered run: the pose model is not even run while a
   * hand is visible. A game that reads this directly is a game that breaks the
   * moment somebody plays the intended way — read `centerX`/`centerY`.
   */
  landmarks: BodyLandmark[] | null;
  /**
   * How many candidates the model saw this frame — hands while a hand steers,
   * people while the body does. >1 drives the 'crowded' hint.
   */
  people: number;
  /** performance.now() of the last frame that actually contained the player. */
  lastSeenAt: number;
}

/** The state a game sees before anyone has stepped up. */
export function emptyTrackingState(): PlayerTrackingState {
  return {
    detected: false,
    source: null,
    centerX: 0.5,
    centerY: 0.5,
    width: 0,
    height: 0,
    confidence: 0,
    gesture: null,
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
