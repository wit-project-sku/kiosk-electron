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

/**
 * Longest edge of the frame actually handed to the model.
 *
 * The 제주 Elgato runs PORTRAIT at 1080×1920 and we now open it at its native
 * mode (see the note in useMotionTracking), which is more pixels than a pose
 * pass needs. Scaling to this on our own canvas keeps the per-frame cost flat
 * whatever camera a venue has, and costs one drawImage.
 *
 * ── Why not smaller ───────────────────────────────────────────────────
 * The model letterboxes its input into a SQUARE. A 9:16 portrait frame
 * therefore lands in a narrow column down the middle of that square — at a 480
 * long edge the whole frame is only ~144px wide inside it, and a person
 * standing back from the kiosk is a fraction of that. 720 keeps the column wide
 * enough for a torso to survive the letterbox, and the extra cost is one larger
 * drawImage at 20fps, not extra inference.
 */
const WORK_LONG_EDGE = 720;

export class PoseTracker {
  private landmarker: PoseLandmarker | null = null;
  /** What the model is doing. Surfaced on the diagnostic panel. */
  modelState: 'loading' | 'ready' | 'failed' = 'loading';
  /**
   * The frame the model actually sees: the camera's, scaled down and — if the
   * venue's camera is bolted sideways — turned upright.
   *
   * ── Why the model must not be handed the raw <video> ──────────────────
   * A pose model is trained on people who are the right way up. Feed it a frame
   * from a camera mounted at 90° and it sees a person lying down, and either
   * finds nobody or returns nonsense. The hand-landmark model the 손동작 게이트
   * uses is far more rotation-tolerant, which is why that feature never needed
   * this and why the trap is easy to miss.
   *
   * Doing the turn here rather than in poseMath also means the landmarks come
   * back ALREADY upright, so the geometry downstream only has to mirror.
   */
  private work: HTMLCanvasElement | null = null;
  private workCtx: CanvasRenderingContext2D | null = null;

  /**
   * Size of the frame the model was last shown, AFTER any rotation.
   *
   * The distance estimate needs it: shoulder span is normalized to this frame,
   * and comparing it against a threshold means knowing what shape the frame
   * was. See `apparentSize` in poseMath.
   */
  frameW = 0;
  frameH = 0;
  /**
   * MediaPipe's VIDEO mode requires strictly increasing timestamps and throws
   * on a repeat. Video currentTime is not reliable for this (it repeats while
   * paused, and jumps on a seek), so the clock is ours.
   */
  private clock = 0;

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
   * Run one pass. Returns [] for "no one there" AND for "not ready" — the
   * caller's loss-grace window makes those the same thing from a game's point
   * of view, and distinguishing them here would only push a branch outward.
   */
  /**
   * Run one pass.
   *
   * @param rotation Degrees the RAW frame must be turned clockwise to stand
   *   upright — the venue's `cameraRotation`. The frame is turned here, before
   *   inference, for the reason on {@link work}.
   */
  detect(video: HTMLVideoElement, rotation: 0 | 90 | 180 | 270 = 0): RawPose[] {
    const landmarker = this.landmarker;
    // readyState < 2 means no frame is decoded yet; handing that to MediaPipe
    // throws rather than returning nothing.
    if (!landmarker || video.readyState < 2 || video.videoWidth === 0) return [];

    const source = this.prepare(video, rotation);
    if (!source) return [];

    this.clock += 1;
    const result = landmarker.detectForVideo(source, this.clock);
    if (!result.landmarks || result.landmarks.length === 0) return [];

    return result.landmarks.map((landmarks) => ({
      landmarks: landmarks as RawLandmark[],
    }));
  }

  /**
   * Draw the current video frame onto {@link work}, upright and scaled.
   *
   * Returns null only when the frame has no size yet. The canvas is allocated
   * once and reused for the life of the tracker — a new canvas per frame would
   * be 20 allocations a second on a machine that runs for days.
   */
  private prepare(video: HTMLVideoElement, rotation: 0 | 90 | 180 | 270): HTMLCanvasElement | null {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    // After a quarter turn the frame's axes swap.
    const quarter = rotation === 90 || rotation === 270;
    const uprightW = quarter ? vh : vw;
    const uprightH = quarter ? vw : vh;
    const scale = Math.min(1, WORK_LONG_EDGE / Math.max(uprightW, uprightH));
    const w = Math.max(1, Math.round(uprightW * scale));
    const h = Math.max(1, Math.round(uprightH * scale));

    if (!this.work) {
      this.work = document.createElement('canvas');
      // `willReadFrequently: false` — MediaPipe uploads this to the GPU; we
      // never read it back, and asking for a readback-optimised surface would
      // force a software canvas.
      this.workCtx = this.work.getContext('2d');
    }
    const canvas = this.work;
    const ctx = this.workCtx;
    if (!ctx) return null;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    this.frameW = w;
    this.frameH = h;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    // Drawn about the centre in the SOURCE's own aspect, so a quarter turn
    // fills the swapped canvas exactly rather than letterboxing.
    const drawW = quarter ? h : w;
    const drawH = quarter ? w : h;
    ctx.drawImage(video, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    return canvas;
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

  /**
   * Drop the working canvas.
   *
   * The landmarker is shared and deliberately outlives a game; this buffer is
   * per-tracker and should not. Called when the tracking hook tears down.
   */
  dispose(): void {
    this.work = null;
    this.workCtx = null;
  }
}
