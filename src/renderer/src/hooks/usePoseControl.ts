import { useEffect, useRef, useState, type RefObject } from 'react';
import { PoseLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Full-body control for the wait-time mini game (Monitor 2).
 *
 * Runs the MediaPipe PoseLandmarker against the live `<video>` and turns the
 * visitor's body into the game's only input:
 *   - physically JUMP  → `onJump()` fires once per jump (edge-triggered)
 *   - CROUCH / squat   → `ducking` stays true for as long as they stay down
 *
 * Model + wasm come from the same bundle the face/gesture hooks use
 * (src/renderer/public/mediapipe), served via `media://app/*` in production.
 *
 * Fails CLOSED, visibly: if the model can't load, `ready` stays false, Monitor 1
 * says motion control is unavailable and simply hands over the photo when it is
 * done. There is no touch fallback — the game is the body, or it is nothing.
 */

const MP_BASE = import.meta.env.DEV
  ? `${window.location.origin}/mediapipe`
  : 'media://app/mediapipe';

/** MediaPipe BlazePose landmark indices we care about. */
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

/**
 * Throttle inference to ~30fps. Two MediaPipe graphs against one <video> starve
 * each other (see useHandGesture) — and 30fps is well inside the reaction window
 * for a jump, while leaving the GPU free for the game's own rendering.
 */
const POSE_MIN_INTERVAL_MS = 33;

/**
 * All movement is measured in TORSO LENGTHS (shoulder→hip), not raw normalized
 * pixels, so the thresholds hold whether the visitor stands close to the kiosk
 * or several metres back — the same physical jump reads the same either way.
 */
/** Rise above the resting baseline that counts as a jump. */
export const JUMP_RATIO = 0.13;
/**
 * Upward speed, in torso-lengths per second, that counts as a launch on its own.
 * Displacement alone is a late and fragile signal — it needs the apex, which is
 * exactly the blurriest frame and often the one where the shoulders clip out of
 * a portrait frame. Speed shows up on the way UP. A jump launches at roughly
 * 4-5 torso/s; swaying and standing up sit well under 2.
 */
const JUMP_VELOCITY_RATIO = 2.2;
/**
 * A jump must ALSO be moving up at least this fast, even when the displacement
 * threshold is already met. Walking toward the camera lifts the body in frame
 * just as far, only slowly — without this, stepping closer to the kiosk read as
 * a leap. Landmark jitter is worth ~0.2 torso/s over the window, so this clears
 * the noise floor comfortably.
 */
const JUMP_MIN_VELOCITY = 0.8;
/**
 * The velocity trigger additionally requires the body to be ABOVE its resting
 * height. This is what separates a jump from standing up out of a crouch: a
 * jump carries you past where you normally stand, a stand-up only returns you
 * to it.
 */
const JUMP_MIN_RISE = 0.06;
/** Window the upward speed is measured over, and the minimum usable span. */
const VELOCITY_WINDOW_MS = 120;
const VELOCITY_MIN_SPAN_S = 0.05;
/** Drop below the resting baseline that counts as a crouch. */
export const DUCK_RATIO = 0.17;
/**
 * A crouch must be held this long to count. Every jump begins with a knee bend,
 * and treating that wind-up as a duck made the dino drop into its crouch pose
 * and then stand up — which reads on screen as the head rising, not a jump.
 */
const DUCK_HOLD_MS = 200;
/** Inside this band the body is "at rest" and the baseline tracks it quickly. */
const NEUTRAL_RATIO = 0.09;
/** One jump per this long — stops a single hop double-firing on the way down. */
const JUMP_COOLDOWN_MS = 420;
/**
 * Reject implausibly small torsos: a bad/partial detection (or someone at the
 * far end of the hall) yields a tiny torso, which would make every threshold
 * hair-trigger. 0.05 of frame height ≈ the person is genuinely in shot.
 */
const MIN_TORSO = 0.05;
/**
 * Landmarks below this visibility are treated as not seen at all. Kept low on
 * purpose: a jumping body is motion-blurred and half-clipped, and a strict gate
 * discards precisely the frames that carry the jump.
 */
const MIN_VISIBILITY = 0.35;
/** Tolerate brief detection dropouts before declaring the player gone. */
const ABSENCE_GRACE_MS = 700;
/** Complain to the log if the detector is up but no frames ever arrive. */
const NO_FRAMES_WARN_MS = 4000;

/**
 * Baseline = where this person's shoulders sit when standing still. It has to
 * adapt (people drift, step closer, swap places) but must NOT drift during a
 * held crouch, or a duck would silently become the new "standing".
 *
 * So it moves fast while the body is inside the neutral band and nearly freezes
 * outside it. At 30fps: ~1.6s to settle when at rest, ~20s when jumping/ducking.
 */
const BASELINE_ALPHA_NEUTRAL = 0.02;
const BASELINE_ALPHA_ACTIVE = 0.0015;

/** Live pose readout for the on-screen coach (drawn per-frame, never in state). */
export interface PoseSnapshot {
  /** Latest raw landmarks, or null when nobody is detected. */
  landmarks: NormalizedLandmark[] | null;
  /** Body height vs. resting baseline, in torso lengths. + = up, − = down. */
  offset: number;
  /** Resting shoulder height (normalized y), or null before calibration. */
  baselineY: number | null;
}

interface UsePoseControlOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  /** Fires once on the rising edge of a jump. */
  onJump: () => void;
}

interface UsePoseControlResult {
  /** True once the landmarker has loaded and is driving the game. */
  ready: boolean;
  /** True while a body is visible in frame. */
  tracking: boolean;
  /** True for as long as the player is crouched. */
  ducking: boolean;
  /**
   * Live pose for the coach overlay. A ref, not state — the game canvas reads it
   * every frame, and re-rendering React at 30fps would fight the game loop.
   */
  poseRef: RefObject<PoseSnapshot>;
}

/** Reject if a promise hasn't settled in `ms` — guards a GPU init that hangs. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);
}

async function createLandmarker(): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
  const modelAssetPath = `${MP_BASE}/pose_landmarker_lite.task`;
  try {
    return await withTimeout(
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      }),
      5000,
      'pose GPU init',
    );
  } catch {
    // Some kiosk GPUs reject (or stall on) the WebGL delegate — fall back to CPU.
    return PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  }
}

/** What the body is telling the game on a given frame. */
export interface PoseDecision {
  /** True on the single frame a jump is recognised. */
  jump: boolean;
  /** True for as long as the player is genuinely crouched. */
  ducking: boolean;
}

/**
 * The gesture state machine, kept free of React and MediaPipe so it can be
 * driven frame by frame with synthetic motion in a test harness. Everything it
 * receives is already reduced to two numbers: shoulder height and torso length,
 * both in normalized frame units (y grows DOWNWARD).
 */
export function createPoseGestureDetector() {
  let baseline: number | null = null;
  let airborne = false;
  let lastJump = 0;
  let duckSince = 0;
  let samples: Array<{ t: number; y: number }> = [];

  return {
    reset(): void {
      baseline = null;
      airborne = false;
      lastJump = 0;
      duckSince = 0;
      samples = [];
    },

    /** Resting shoulder height, or null before the first frame. */
    baselineY(): number | null {
      return baseline;
    },

    update(now: number, shoulderY: number, torso: number): PoseDecision {
      if (baseline === null) baseline = shoulderY;

      // y grows downward, so a body that has RISEN sits at a smaller y.
      const offset = (baseline - shoulderY) / torso;

      // Upward speed in torso-lengths per second, measured across a short window
      // rather than frame to frame: landmark jitter alone is worth about a torso
      // per second at kiosk framing, which single-frame differencing would
      // happily mistake for a launch. A jump ascends for ~200ms, so a ~120ms
      // window still catches it while averaging the noise down.
      samples.push({ t: now, y: shoulderY });
      while (samples.length > 2 && now - samples[0]!.t > VELOCITY_WINDOW_MS) samples.shift();

      let rise = 0;
      const oldest = samples[0];
      const span = oldest ? (now - oldest.t) / 1000 : 0;
      if (oldest && span >= VELOCITY_MIN_SPAN_S) {
        rise = (oldest.y - shoulderY) / torso / span;
      }

      // Two ways to register, and BOTH demand real upward motion:
      //  - lifted high enough while still moving up (the classic signal), or
      //  - moving up hard and already past standing height (catches a launch
      //    early, before the apex, which is the blurriest frame of all).
      const rising = rise > JUMP_MIN_VELOCITY;
      const lifted = offset > JUMP_RATIO && rising;
      const launched = rise > JUMP_VELOCITY_RATIO && offset > JUMP_MIN_RISE;

      let jump = false;
      let ducking = false;

      if (lifted || launched) {
        if (!airborne && now - lastJump > JUMP_COOLDOWN_MS) {
          airborne = true;
          lastJump = now;
          jump = true;
        }
        duckSince = 0;
      } else {
        // Re-arm once they are back near the ground, so the next hop counts.
        if (offset < NEUTRAL_RATIO) airborne = false;

        // A crouch must be HELD to count. Every jump starts by bending the
        // knees, and letting that instant wind-up flip the dino into its duck
        // pose made a jump look like the dino merely standing back up.
        if (offset < -DUCK_RATIO) {
          if (duckSince === 0) duckSince = now;
          ducking = now - duckSince >= DUCK_HOLD_MS;
        } else {
          duckSince = 0;
        }
      }

      // Track the resting height - fast at rest, near-frozen mid-jump/crouch.
      const alpha =
        Math.abs(offset) < NEUTRAL_RATIO ? BASELINE_ALPHA_NEUTRAL : BASELINE_ALPHA_ACTIVE;
      baseline += (shoulderY - baseline) * alpha;

      return { jump, ducking };
    },
  };
}

export function usePoseControl({
  videoRef,
  enabled,
  onJump,
}: UsePoseControlOptions): UsePoseControlResult {
  const [ready, setReady] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [ducking, setDucking] = useState(false);

  // Keep the callback in a ref so the detection loop never re-subscribes when
  // the parent re-renders (which would thrash the landmarker).
  const onJumpRef = useRef(onJump);
  onJumpRef.current = onJump;

  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const poseRef = useRef<PoseSnapshot>({ landmarks: null, offset: 0, baselineY: null });

  const detectorRef = useRef(createPoseGestureDetector());
  const lastSeenRef = useRef(0);
  const lastTsRef = useRef(0);
  const lastInferRef = useRef(0);
  const warnedNoFrames = useRef(false);
  /** Last good shoulder-to-hip distance; the scale every threshold is measured in. */
  const torsoRef = useRef<number | null>(null);

  // Load the landmarker once for the lifetime of the window.
  useEffect(() => {
    let cancelled = false;
    // Each run tracks only the instance IT created. Under StrictMode the effect
    // mounts twice, and a cleanup that blindly closed `landmarkerRef` would tear
    // down the OTHER run's detector — leaving `ready: true` with nothing behind
    // it, which looks exactly like "nobody is standing in front of the camera".
    let mine: PoseLandmarker | null = null;

    void (async () => {
      try {
        const landmarker = await createLandmarker();
        mine = landmarker;
        if (cancelled) {
          landmarker.close();
          mine = null;
          return;
        }
        landmarkerRef.current = landmarker;
        setReady(true);
        // eslint-disable-next-line no-console
        console.info('[pose-control] landmarker ready — body control active');
      } catch (error) {
        // Unavailable → Monitor 1 says so and the photo simply arrives as usual.
        // eslint-disable-next-line no-console
        console.error('[pose-control] landmarker init failed; body control off', error);
        setReady(false);
      }
    })();

    return () => {
      cancelled = true;
      if (!mine) return;
      mine.close();
      if (landmarkerRef.current === mine) landmarkerRef.current = null;
      mine = null;
    };
  }, []);

  // Detection loop — only while the game is on screen and the model is loaded.
  useEffect(() => {
    if (!enabled || !ready) return;

    let stopped = false;
    const startedAt = performance.now();
    warnedNoFrames.current = false;
    // Each session starts uncalibrated: the first frames establish the baseline
    // for whoever is standing there now, not whoever played last.
    detectorRef.current.reset();
    torsoRef.current = null;
    lastSeenRef.current = performance.now();
    setDucking(false);

    const loop = (): void => {
      if (stopped) return;
      rafRef.current = requestAnimationFrame(loop);

      const now = performance.now();
      if (now - lastInferRef.current < POSE_MIN_INTERVAL_MS) return;
      lastInferRef.current = now;

      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker || video.readyState < 2 || video.videoWidth === 0) {
        // A ready detector that never sees a frame looks exactly like "nobody is
        // standing there", which silently disables PLAY. Say so once — on the
        // kiosk this is only diagnosable from the log file.
        if (!warnedNoFrames.current && now - startedAt > NO_FRAMES_WARN_MS) {
          warnedNoFrames.current = true;
          // eslint-disable-next-line no-console
          console.warn(
            '[pose-control] no camera frames after %dms — readyState=%s videoWidth=%s. ' +
              'The <video> is mounted but has no live srcObject.',
            NO_FRAMES_WARN_MS,
            video?.readyState,
            video?.videoWidth,
          );
        }
        return;
      }

      // detectForVideo requires strictly increasing timestamps.
      let ts = now;
      if (ts <= lastTsRef.current) ts = lastTsRef.current + 1;
      lastTsRef.current = ts;

      let landmarks: NormalizedLandmark[] | null = null;
      try {
        landmarks = landmarker.detectForVideo(video, ts).landmarks[0] ?? null;
      } catch {
        return; // Transient inference error — skip this frame.
      }

      const visible = (i: number): NormalizedLandmark | null => {
        const lm = landmarks?.[i];
        return lm && (lm.visibility ?? 1) > MIN_VISIBILITY ? lm : null;
      };
      const mid = (a: NormalizedLandmark | null, b: NormalizedLandmark | null): number | null => {
        if (a && b) return (a.y + b.y) / 2;
        return a ? a.y : b ? b.y : null;
      };

      // Shoulders OR hips is enough. Demanding all four meant the apex of a jump
      // — motion-blurred, and often with the shoulders clipping out of a portrait
      // frame — was thrown away as "not seen", so the one moment that defines a
      // jump was the one moment we refused to look at.
      const rawShoulderY = mid(visible(LEFT_SHOULDER), visible(RIGHT_SHOULDER));
      const hipY = mid(visible(LEFT_HIP), visible(RIGHT_HIP));

      if (rawShoulderY === null && hipY === null) {
        if (now - lastSeenRef.current > ABSENCE_GRACE_MS) {
          setTracking(false);
          setDucking(false);
          detectorRef.current.reset();
          poseRef.current = { landmarks: null, offset: 0, baselineY: null };
        }
        return;
      }

      // Torso length is the yardstick everything is measured in. Remember the
      // last good one so a partly-visible body keeps a stable scale.
      if (rawShoulderY !== null && hipY !== null) {
        const t = Math.abs(hipY - rawShoulderY);
        if (t >= MIN_TORSO) torsoRef.current = t;
      }
      const torso = torsoRef.current;
      if (torso === null) return; // Never had a full body to calibrate against.

      // Track ONE quantity — shoulder height. When the shoulders leave the frame
      // mid-jump, infer them from the hips rather than switching what we measure
      // (a mid-flight change of reference would read as a phantom leap).
      const shoulderY = rawShoulderY ?? (hipY as number) - torso;

      lastSeenRef.current = now;
      setTracking(true);

      const decision = detectorRef.current.update(now, shoulderY, torso);
      if (decision.jump) onJumpRef.current();
      setDucking(decision.ducking);

      const baselineY = detectorRef.current.baselineY();
      poseRef.current = {
        landmarks,
        offset: baselineY === null ? 0 : (baselineY - shoulderY) / torso,
        baselineY,
      };
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setTracking(false);
      setDucking(false);
    };
  }, [enabled, ready, videoRef]);

  return { ready, tracking, ducking, poseRef };
}
