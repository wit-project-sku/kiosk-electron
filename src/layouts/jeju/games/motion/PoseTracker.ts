/**
 * Body-pose detection for 제주's motion games.
 *
 * A deliberate sibling of `lib/footfall/PersonDetector.ts` — same vendored WASM
 * runtime, same `appres://` model path, same module-level cached promise, same
 * GPU-then-CPU fallback. If you are changing one, read the other first; the two
 * are meant to stay recognisably the same shape.
 *
 * ── Why a third model and not the two already vendored ────────────────
 * EfficientDet (footfall) reports a person as a BOX. A box tells you where
 * someone is standing, which is enough to steer a basket, but says nothing
 * about where their arms are — and 포즈 챌린지 is entirely about where their
 * arms are. HandLandmarker (the 손동작 게이트) sees hands but has no idea they
 * belong to a body. Pose landmarks are the only thing that serves all three
 * games, and using one model for all three is what keeps a single camera pass
 * feeding every game.
 *
 * See `scripts/vendor-mediapipe.mjs` for why the LITE build.
 *
 * ── Nothing here retains an image ─────────────────────────────────────
 * `detect()` is handed a live <video> element, reads one frame, and returns
 * numbers. No frame is copied, stored, encoded or sent anywhere; the only thing
 * that outlives the call is the landmark array, which the caller overwrites on
 * the next pass.
 */
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { RawLandmark } from './poseMath';

/** Base path served by the appres:// protocol handler. */
const RUNTIME_BASE = 'appres://mediapipe';
const MODEL_FILE = 'pose_landmarker_lite.task';

/**
 * Two, not one.
 *
 * `numPoses: 1` would let MediaPipe pick the most prominent person every frame,
 * with no continuity — a bystander stepping past closer than the player would
 * silently take the controls mid-game. Asking for two means the caller can see
 * that a second person exists, keep its own lock, and say "one player please"
 * instead of the game lurching. See the lock in useMotionTracking.
 *
 * Two rather than four because this is a kiosk with no discrete GPU: each extra
 * pose is real inference cost, and a 제주 airport queue behind the player would
 * make four a permanent tax for no gameplay benefit.
 */
const MAX_POSES = 2;

/**
 * One landmarker for the whole renderer, kept alive between games.
 *
 * Loading is 9.5 MB of WASM plus a 5.8 MB model — around a second here. A
 * visitor who plays 감귤 받기, exits, then picks 돌 피하기 must not wait for that
 * twice, so the instance survives the game screen. Only INFERENCE stops on
 * unmount (see useMotionTracking); the model staying resident is the cheap half.
 *
 * The promise, not the instance, is cached so two callers racing share one load.
 */
let trackerPromise: Promise<PoseLandmarker> | null = null;

async function create(delegate: 'GPU' | 'CPU'): Promise<PoseLandmarker> {
  // Dynamic import: the MediaPipe glue is only needed by the features that use a
  // camera, and keeping it out of the initial chunk keeps boot instant.
  const { FilesetResolver, PoseLandmarker: Landmarker } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(RUNTIME_BASE);
  return Landmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: `${RUNTIME_BASE}/${MODEL_FILE}`, delegate },
    runningMode: 'VIDEO',
    numPoses: MAX_POSES,
    // Lower than MediaPipe's 0.5 defaults on purpose. The 제주 camera is
    // portrait and crops the visitor at the hip, so a good half of the model's
    // expected body is simply not in frame and its confidence is correspondingly
    // pessimistic. At 0.5 a perfectly visible torso would drop out every few
    // seconds; the caller's own visibility checks (see poseMath) are what
    // actually decide whether a joint is usable.
    minPoseDetectionConfidence: 0.35,
    minPosePresenceConfidence: 0.35,
    minTrackingConfidence: 0.35,
    // We never draw the segmentation mask, and asking for it costs a full-frame
    // buffer per pose per frame.
    outputSegmentationMasks: false,
  });
}

function load(): Promise<PoseLandmarker> {
  trackerPromise ??= (async () => {
    try {
      // GPU keeps a lite pass near 10 ms here. CPU is several times that and
      // competes with the attract video's decode for the same cores.
      return await create('GPU');
    } catch {
      // An unavailable GPU delegate must not disable the games — same fallback
      // PersonDetector makes, for the same reason.
      return await create('CPU');
    }
  })().catch((error) => {
    // Clear the cache so a later game retries rather than inheriting a rejected
    // promise for the rest of the day.
    trackerPromise = null;
    throw error;
  });
  return trackerPromise;
}

/** One person's landmarks as the tracker reports them, before correction. */
export interface RawPose {
  landmarks: RawLandmark[];
}

export class PoseTracker {
  private landmarker: PoseLandmarker | null = null;
  /**
   * MediaPipe's VIDEO mode requires strictly increasing timestamps and throws
   * on a repeat. Video currentTime is not reliable for this (it repeats while
   * paused, and jumps on a seek), so the clock is ours.
   */
  private clock = 0;

  async load(): Promise<void> {
    this.landmarker = await load();
  }

  get ready(): boolean {
    return this.landmarker !== null;
  }

  /**
   * Run one pass. Returns [] for "no one there" AND for "not ready" — the
   * caller's loss-grace window makes those the same thing from a game's point
   * of view, and distinguishing them here would only push a branch outward.
   */
  detect(video: HTMLVideoElement): RawPose[] {
    const landmarker = this.landmarker;
    // readyState < 2 means no frame is decoded yet; handing that to MediaPipe
    // throws rather than returning nothing.
    if (!landmarker || video.readyState < 2 || video.videoWidth === 0) return [];

    this.clock += 1;
    const result = landmarker.detectForVideo(video, this.clock);
    if (!result.landmarks || result.landmarks.length === 0) return [];

    return result.landmarks.map((landmarks) => ({
      landmarks: landmarks as RawLandmark[],
    }));
  }

  /**
   * Forget the timestamp sequence.
   *
   * Called when a game restarts the camera. The shared landmarker outlives any
   * one game, so its internal tracking state carries over; resetting the clock
   * is what stops a new session inheriting the last one's timeline.
   */
  resetClock(): void {
    this.clock = 0;
  }
}
