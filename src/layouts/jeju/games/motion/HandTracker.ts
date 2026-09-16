/**
 * Hand detection for 제주's motion games — the PRIMARY controller.
 *
 * ══ WHY THE GAMES ARE STEERED BY A HAND AND NOT A BODY ════════════════
 * These games used to read the visitor's torso: you played 감귤 받기 by walking
 * left and right, and 제주 달리기 by physically jumping. That works in a
 * living room and is a poor fit for the place this kiosk actually stands.
 *
 *   · 제주공항 is a concourse. Asking a visitor to jump up and down in an
 *     airport, in front of a queue, is asking most of them not to play.
 *   · A torso controller needs the visitor two metres back so their shoulders
 *     fit the frame. That is also the distance at which they can no longer
 *     reach the touch screen, read anything on it, or hear the sound.
 *   · Someone waiting for an AR photo is usually holding a bag, a phone, or a
 *     child's hand. A whole-body game assumes both are free.
 *
 * A raised hand costs none of that. It works from where the visitor is already
 * standing, it is legible to them (they can see the thing they are moving), and
 * it is a gesture this kiosk already asks for — the 손동작 게이트 on the capture
 * screen starts the photo countdown from an open palm.
 *
 * ── The same model the capture screen already loads ───────────────────
 * `hand_landmarker.task` is vendored for that gate (see useHandGesture) and is
 * very often already resident by the time a visitor reaches the games — the
 * photo is taken first. This is a deliberate sibling of that hook and of
 * PoseTracker: same runtime, same `appres://` path, same module-level cached
 * promise, same GPU-then-CPU fallback with a timeout. Change one, read the
 * others.
 *
 * ── Nothing here retains an image ─────────────────────────────────────
 * `detect()` is handed one prepared frame, reads it, and returns numbers. No
 * frame is copied, stored, encoded or sent anywhere; the only thing that
 * outlives the call is the landmark array, which the caller overwrites on the
 * next pass.
 */
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandLandmark } from '@renderer/lib/handGesture';
import { nextFrameStamp } from './FrameSource';

/** Base path served by the appres:// protocol handler. */
const RUNTIME_BASE = 'appres://mediapipe';
const MODEL_FILE = 'hand_landmarker.task';

/**
 * Two hands, not one.
 *
 * Not so both can steer — exactly one does, and the caller locks onto it. Two
 * because the player's OTHER hand is usually in frame too (at their side, or
 * holding a phone), and because a companion standing beside them has hands as
 * well. Asking for one would let MediaPipe silently hand the controls to
 * whichever it found most prominent this frame, which is the mid-game lurch the
 * lock in useMotionTracking exists to prevent.
 */
const MAX_HANDS = 2;

/**
 * One landmarker for the whole renderer, kept alive between games.
 *
 * Loading is 9.5 MB of WASM plus a 7.5 MB model. A visitor who plays 감귤 받기,
 * exits, then picks 제주 달리기 must not wait for that twice, so the instance
 * survives the game screen. Only INFERENCE stops on unmount.
 *
 * The promise, not the instance, is cached so two callers racing share one load.
 *
 * ── Deliberately NOT shared with useHandGesture's singleton ───────────
 * That one belongs to the capture screen and is often mid-flight there. They
 * cost one model load each and the file is the same on disk, so the second load
 * is a disk-cache hit; sharing the INSTANCE would couple the games' frame clock
 * to the photo gate's, and MediaPipe's VIDEO mode is exactly where shared
 * timestamp state goes wrong — see nextFrameStamp.
 */
let landmarkerPromise: Promise<HandLandmarker> | null = null;

async function create(delegate: 'GPU' | 'CPU'): Promise<HandLandmarker> {
  // Dynamic import: the MediaPipe glue is only needed by the features that use a
  // camera, and keeping it out of the initial chunk keeps boot instant.
  const { FilesetResolver, HandLandmarker: Landmarker } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(RUNTIME_BASE);
  return Landmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: `${RUNTIME_BASE}/${MODEL_FILE}`, delegate },
    runningMode: 'VIDEO',
    numHands: MAX_HANDS,
    // Lower than the capture gate's 0.5. That gate is deciding whether to fire
    // a countdown and can afford to be certain; this is a game controller, and
    // a hand that drops out for a few frames mid-swipe is a basket that stops
    // dead under the visitor's hand. The caller's own loss-grace window and
    // palm-size floor are what actually decide whether a hand is usable.
    minHandDetectionConfidence: 0.35,
    minHandPresenceConfidence: 0.35,
    minTrackingConfidence: 0.35,
  });
}

/**
 * How long the GPU delegate gets before we stop waiting for it.
 *
 * ══ A TRY/CATCH DOES NOT CATCH A HANG ═════════════════════════════════
 * Same trap PoseTracker documents: a delegate that REFUSES is caught, one that
 * never answers is not. Six seconds is far longer than a real GPU init (~1s
 * here) and far shorter than a visitor's patience.
 */
const GPU_LOAD_TIMEOUT_MS = 6000;

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

function load(): Promise<HandLandmarker> {
  landmarkerPromise ??= (async () => {
    try {
      return await withTimeout(create('GPU'), GPU_LOAD_TIMEOUT_MS, 'GPU hand delegate');
    } catch {
      // An unavailable — or unresponsive — GPU delegate must not disable the
      // games. A CPU pass that RUNS beats a GPU pass that never starts.
      return await create('CPU');
    }
  })().catch((error) => {
    // Clear the cache so a later game retries rather than inheriting a rejected
    // promise for the rest of the day.
    landmarkerPromise = null;
    throw error;
  });
  return landmarkerPromise;
}

/** One hand's 21 landmarks as the model reports them, before correction. */
export interface RawHand {
  landmarks: HandLandmark[];
}

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  /** What the model is doing. Surfaced on the diagnostic panel. */
  modelState: 'loading' | 'ready' | 'failed' = 'loading';

  /**
   * Begin loading the shared landmarker.
   *
   * The caller must NOT block its frame loop on this — see
   * {@link GPU_LOAD_TIMEOUT_MS}. `detect()` returns [] until it resolves, so the
   * loop runs (and reports diagnostics) from the first frame.
   */
  async load(): Promise<void> {
    try {
      this.landmarker = await load();
      this.modelState = 'ready';
    } catch {
      this.modelState = 'failed';
      throw new Error('Hand model failed to load');
    }
  }

  get ready(): boolean {
    return this.landmarker !== null;
  }

  /**
   * Run one pass over an already-upright frame.
   *
   * @param source The prepared frame from {@link FrameSource}, NOT the raw
   *   <video>. The hand model would find hands in a sideways frame quite
   *   happily, but their coordinates would move along the wrong axis — which is
   *   worse than not finding them, because the game would look like it was
   *   working.
   */
  detect(source: HTMLCanvasElement): RawHand[] {
    const landmarker = this.landmarker;
    if (!landmarker) return [];

    // The timestamp comes from the shared clock, never from a counter of our
    // own — see nextFrameStamp for the run-two-sees-nobody bug that caused.
    const result = landmarker.detectForVideo(source, nextFrameStamp());
    if (!result.landmarks || result.landmarks.length === 0) return [];

    return result.landmarks.map((landmarks) => ({
      landmarks: landmarks as HandLandmark[],
    }));
  }
}
