/**
 * Body-pose detection for 제주's motion games — the FALLBACK controller.
 *
 * A deliberate sibling of `lib/footfall/PersonDetector.ts` — same vendored WASM
 * runtime, same `appres://` model path, same module-level cached promise, same
 * GPU-then-CPU fallback. If you are changing one, read the other first; the two
 * are meant to stay recognisably the same shape.
 *
 * ── Why a pose model is still here now the games are hand-controlled ──
 * The games are steered by a raised HAND (see HandTracker), and while one is
 * visible this model is not run at all. It earns its place on the three jobs a
 * hand cannot do:
 *
 *   · ORIENTATION. A hand model finds hands in a sideways frame quite happily,
 *     which is precisely what makes it useless for noticing that the frame IS
 *     sideways — and a sideways frame moves the controller along the wrong
 *     axis. A body has an unmistakable right way up, so the probe in
 *     useMotionTracking scores poses, not hands.
 *   · PRESENCE. "Step in front of the screen" needs to know somebody is THERE
 *     but not raising a hand. Without a body there is no way to tell that from
 *     an empty concourse.
 *   · THE FALLBACK ITSELF. A visitor holding a suitcase in one hand and a
 *     coffee in the other still gets to play with their body, exactly as before.
 *
 * See `scripts/vendor-mediapipe.mjs` for why the LITE build.
 *
 * ── Nothing here retains an image ─────────────────────────────────────
 * `detect()` is handed one prepared frame, reads it, and returns numbers. No
 * frame is copied, stored, encoded or sent anywhere; the only thing that
 * outlives the call is the landmark array, which the caller overwrites on the
 * next pass.
 */
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { nextFrameStamp } from './FrameSource';
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

/**
 * How long the GPU delegate gets before we stop waiting for it.
 *
 * ══ A TRY/CATCH DOES NOT CATCH A HANG ═════════════════════════════════
 * This used to be a bare `try { GPU } catch { CPU }`, which handles a delegate
 * that REFUSES and does nothing at all for one that never answers. On the 제주
 * machine it never answered: the model load sat unresolved, and because the
 * frame loop was started after awaiting it, the loop never ran a single
 * iteration. The camera was open and the preview was live — the stream is
 * attached before this — so everything looked fine except that nothing was ever
 * detected, and the diagnostic panel showed CAM 0×0 / FRAMES 0 because the code
 * that fills those numbers had never executed.
 *
 * Six seconds is far longer than a real GPU init (~1s here) and far shorter
 * than a visitor's patience.
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

function load(): Promise<PoseLandmarker> {
  trackerPromise ??= (async () => {
    try {
      // GPU keeps a lite pass near 10 ms here. CPU is several times that and
      // competes with the attract video's decode for the same cores — but a CPU
      // pass that RUNS beats a GPU pass that never starts.
      return await withTimeout(create('GPU'), GPU_LOAD_TIMEOUT_MS, 'GPU pose delegate');
    } catch {
      // An unavailable — or unresponsive — GPU delegate must not disable the
      // games. Same fallback PersonDetector makes, for the same reason.
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
  /** What the model is doing. Surfaced on the diagnostic panel. */
  modelState: 'loading' | 'ready' | 'failed' = 'loading';

  /**
   * Begin loading the shared landmarker.
   *
   * The caller must NOT block its frame loop on this — see the note on
   * {@link GPU_LOAD_TIMEOUT_MS}. `detect()` returns [] until this resolves, so
   * the loop is free to run (and to report diagnostics) from the first frame.
   */
  async load(): Promise<void> {
    try {
      this.landmarker = await load();
      this.modelState = 'ready';
    } catch {
      this.modelState = 'failed';
      throw new Error('Pose model failed to load');
    }
  }

  get ready(): boolean {
    return this.landmarker !== null;
  }

  /**
   * Run one pass over an already-upright frame.
   *
   * Returns [] for "no one there" AND for "not ready" — the caller's loss-grace
   * window makes those the same thing from a game's point of view, and
   * distinguishing them here would only push a branch outward.
   *
   * @param source The prepared frame from {@link FrameSource}, NOT the raw
   *   <video>. The rotation has already been applied there, so the landmarks
   *   come back upright and only the mirror is left for poseMath.
   */
  detect(source: HTMLCanvasElement): RawPose[] {
    const landmarker = this.landmarker;
    if (!landmarker) return [];

    // The timestamp comes from the shared clock, never from a counter of our
    // own — see nextFrameStamp for the run-two-sees-nobody bug that caused.
    const result = landmarker.detectForVideo(source, nextFrameStamp());
    if (!result.landmarks || result.landmarks.length === 0) return [];

    return result.landmarks.map((landmarks) => ({
      landmarks: landmarks as RawLandmark[],
    }));
  }
}
