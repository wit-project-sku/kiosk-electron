/**
 * The one camera pipeline the 제주 motion games share.
 *
 * Camera → pose → locked player → smoothed, mirrored, upright numbers. Games
 * read the result from a ref and never touch anything above it.
 *
 * ══ WHY THIS MAY OPEN THE CAMERA AT ALL ═══════════════════════════════
 * This runs in the CUSTOMER DISPLAY window — the one that already owns the
 * camera for the AR capture and the 손동작 게이트 — because that is the screen
 * the camera faces and the screen a visitor playing with their body is looking
 * at. The touch window never opens a camera for these games; it only asks main
 * to start one (see MotionRemote).
 *
 * The camera on a 제주 machine is contended, and main already arbitrates it —
 * see FootfallService, which yields the device whenever the photo flow or the
 * customer display wants it, because on Windows the SECOND opener of a device
 * inherits the first one's negotiated format (a counting loop at 320px would
 * silently produce 320px photos).
 *
 * Three claimants have to be quiet for this to be safe, and all three are:
 *
 *   · 유동인구 — blocked while a motion game runs. MotionGameService raises the
 *     'display-camera' blocker for exactly this, and 'photo-session' is already
 *     raised anyway for the whole AR flow these games are played during.
 *   · this window's own `useKioskCamera` — CustomerDisplay's `cameraEnabled` is
 *     explicitly `&& motion.game === null`, so the display cannot open the
 *     device underneath a game that is using it.
 *   · the ZED height sidecar — a different device entirely, and its window
 *     (`isCameraLive`) has closed by 'generating'.
 *
 * The stream is released the moment the game component unmounts, which is the
 * moment main says no game is running.
 *
 * ── Privacy ───────────────────────────────────────────────────────────
 * Frames live in a <video> element and in MediaPipe's buffer for the duration of
 * one inference pass. Nothing is captured to a canvas, encoded, persisted or
 * sent anywhere. On unmount the tracks are stopped, the element is detached and
 * the tracking state is dropped.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  DEPTH_CAMERA_PATTERN,
  PREFERRED_CAMERA_PATTERN,
  looksLikeStereoPair,
} from '@shared/config/cameras';
import { getCameraRotation } from '@shared/config/kioskLocations';
import type { KioskId } from '@shared/types/kiosk';
import { useKioskStore } from '@renderer/store/kioskStore';
import { PoseTracker } from './PoseTracker';
import { emptyTrackingState, type PlayerTrackingState, type TrackingStatus } from './poseTypes';
import {
  apparentSize,
  expandRange,
  isInPlayArea,
  poseQuality,
  smoothToward,
  toBodyLandmarks,
  torsoCenter,
  type CameraRotation,
} from './poseMath';

/**
 * Inference rate. The brief's own architecture: infer at a controlled rate,
 * render at 60.
 *
 * 20/s is comfortably above what a body can actually do — a person cannot
 * change direction meaningfully inside 50 ms — and the smoothing below fills
 * the gaps, so the controller feels continuous. Running at the camera's frame
 * rate would triple the cost for motion nobody can produce.
 */
const INFERENCE_INTERVAL_MS = 50;

/**
 * How long a player may vanish before the game says so.
 *
 * The brief asks for 0.3–0.5s and it is exactly right: pose detection drops
 * single frames constantly (an arm crossing the torso, a hand over the face),
 * and reacting to each one would put "step back into view" on screen several
 * times a minute while someone is standing perfectly still in front of it. The
 * last known position is held for this long, so a dropout is invisible.
 */
const LOSS_GRACE_MS = 420;

/**
 * How far a candidate may be from the locked player and still BE the locked
 * player, in normalized x.
 *
 * This is the whole multi-person story. Each frame the tracker may report two
 * people in either order — MediaPipe makes no promise about which is which
 * between frames — so identity is re-established by proximity to where the lock
 * was last seen. Anyone further than this is a bystander, and a bystander never
 * takes the controls mid-game however prominent they are.
 */
const LOCK_RADIUS = 0.28;

/**
 * Shoulder span, as a fraction of frame width, outside which the visitor is
 * standing at a distance the camera cannot work with.
 *
 * This is the number that answers the real complaint from the floor — "it says
 * stand in front and I AM standing there". Usually they were too close: at
 * arm's length from a portrait camera the frame is all torso, the shoulders
 * fall outside it, and a pose either fails or comes back as an unusable
 * fragment. Saying "step back" is the entire fix, and it needs a measurement to
 * say it from.
 *
 * Deliberately wide. These drive a coaching line, not a refusal — the game
 * still starts and still tracks in the grey zone either side.
 */
/**
 * Apparent size (see `apparentSize`) outside which the visitor is coached to
 * move. Measured against the frame's SHORTER edge, so these hold whatever
 * shape the camera delivers.
 *
 * Deliberately very wide. These now drive ONLY a coaching line — nothing here
 * can stop a game starting, because the previous version could, and a wrong
 * estimate then trapped a visitor being told to step closer while standing
 * right in front of the camera.
 */
const SIZE_TOO_CLOSE = 0.8;
const SIZE_TOO_FAR = 0.07;

/**
 * Pose quality good enough to settle the orientation on. Below this the frame
 * is probably not the right way up — see `poseQuality`.
 */
const GOOD_POSE = 0.55;

/**
 * How long to accept seeing nobody before suspecting the frame is the wrong way
 * up, and trying the next quarter turn.
 *
 * ══ WHY THE GAMES SECOND-GUESS THEIR OWN CONFIG ═══════════════════════
 * `cameraRotation` says how far the RAW frame must be turned to stand upright,
 * and on 제주 it is 0 — the Elgato is physically mounted 90° left, but the
 * rotation is applied by the Windows driver, so the frame already arrives
 * upright. Exactly one of the two may rotate; the operator chose the driver.
 * See the field's doc comment in kioskLocations.
 *
 * The problem is that half of that agreement is NOT in the build. A driver
 * update, an OS reimage or a swapped camera drops the Windows setting silently,
 * and then the frame arrives sideways while the config still says 0. For the AR
 * photo that produces a sideways picture — visible, obvious, someone reports it.
 * For these games it produces NOTHING: a pose model handed a person lying down
 * finds no person, so the calibration gate simply never opens and there is
 * nothing on screen to suggest a camera setting is to blame.
 *
 * So rather than trust one number that can silently go stale, the tracker
 * checks. If frames are flowing and no pose has been found for this long, it
 * tries the next quarter turn. Four probes covers every orientation in under
 * ten seconds, and the moment a pose appears the rotation is locked for the
 * rest of the session.
 *
 * This costs nothing when the config is right — the first orientation tried IS
 * the configured one, and a visitor who steps up is found immediately.
 */
const ORIENTATION_PROBE_MS = 2200;

/** Backoff for a camera that will not open. Mirrors useFootfallCounter's. */
const RETRY_DELAYS_MS = [1_500, 3_000, 8_000];

interface Options {
  /** Detection runs only while true. The model stays loaded either way. */
  enabled: boolean;
}

/**
 * What the tracker can tell an OPERATOR about why it is not seeing anyone.
 *
 * ══ WHY THIS IS ON SCREEN AND NOT IN A LOG ════════════════════════════
 * When these games fail they fail silently: the gate simply never opens. From
 * in front of the kiosk that looks identical whether the camera is the wrong
 * one, delivering the wrong shape, mounted the wrong way up, or working
 * perfectly with nobody in the room. Nobody can report a useful bug from
 * "it says stand in front and I am standing in front", and the person who can
 * read a log is not the person standing at the kiosk.
 *
 * So after a long enough failure the calibration screen shows this. It is the
 * difference between "the games are broken" and "the camera is 1920×1080, so
 * Windows lost its rotation".
 */
export interface MotionDiagnostics {
  /** The device that was actually opened. Empty until permission is granted. */
  label: string;
  /** Frame as the CAMERA delivers it. Landscape on 제주 means a lost setting. */
  cameraW: number;
  cameraH: number;
  /** Frame as the MODEL sees it, after rotation and downscaling. */
  modelW: number;
  modelH: number;
  /** Rotation actually applied — may differ from config if the probe moved it. */
  rotation: CameraRotation;
  /** Whether the probe has settled. */
  settled: boolean;
  /** People the model returned this frame. */
  poses: number;
  /** Best pose quality this frame, 0..1. Low means "not a person, upright". */
  quality: number;
  /** Apparent size, 0..1 of the frame's short edge. Drives the distance hints. */
  size: number;
}

export interface MotionTracking {
  /**
   * The rotation actually being applied to the frame right now.
   *
   * Normally the venue's configured `cameraRotation`, but the orientation probe
   * can change it — see {@link ORIENTATION_PROBE_MS}. The preview reads this
   * rather than the config so what the visitor sees matches what the model is
   * being shown.
   */
  rotation: CameraRotation;
  /** Attach to the (hidden or previewed) <video> the stream feeds. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /**
   * The live player state.
   *
   * A REF, not state, and that is load-bearing: this is rewritten 20 times a
   * second and every consumer is a render loop that reads it once per frame.
   * Putting it in state would re-render three game screens 20 times a second to
   * deliver a number nothing in the React tree displays.
   */
  player: RefObject<PlayerTrackingState>;
  /** Coarse status — this IS state, because the coaching overlay renders it. */
  status: TrackingStatus;
  /** Reset the lock and the smoothing. Called when a game (re)starts. */
  recalibrate: () => void;
  /**
   * Live diagnostics. A REF — it is rewritten 20 times a second and only ever
   * read by a component that polls it while it is on screen.
   */
  diagnostics: RefObject<MotionDiagnostics>;
}

/** Pick the venue camera, never the ZED. Same two-way exclusion as elsewhere. */
async function pickCamera(rejected: Set<string>): Promise<string | null> {
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === 'videoinput',
  );
  const usable = devices.filter(
    (d) => !DEPTH_CAMERA_PATTERN.test(d.label) && !rejected.has(d.deviceId),
  );
  const preferred = usable.find((d) => PREFERRED_CAMERA_PATTERN.test(d.label));
  return (preferred ?? usable[0])?.deviceId ?? null;
}

export function useMotionTracking({ enabled }: Options): MotionTracking {
  const kioskId = useKioskStore((s) => s.config.kioskId);
  const rotation = getCameraRotation(kioskId as KioskId) as CameraRotation;

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<PlayerTrackingState>(emptyTrackingState());
  const [status, setStatus] = useState<TrackingStatus>('starting');
  /** The orientation in force. Starts at the venue's config; the probe may move it. */
  const [effectiveRotation, setEffectiveRotation] = useState<CameraRotation>(rotation);

  /** Where the lock was last seen, for the proximity test. Null = unlocked. */
  const lockXRef = useRef<number | null>(null);
  /** Smoothed values, kept out of the state object so a dropped frame coasts. */
  const smoothXRef = useRef(0.5);
  const smoothYRef = useRef(0.5);
  /** The orientation the frame is actually turned by. See the probe below. */
  const rotationRef = useRef<CameraRotation>(rotation);
  /** performance.now() of the last frame that contained ANY pose. */
  const lastPoseAtRef = useRef(0);
  /** Latched once the orientation is settled — the probe stops for good. */
  const orientationLockedRef = useRef(false);
  /** Best (rotation, quality) seen so far while probing. */
  const bestSeenRef = useRef<{ rotation: CameraRotation; quality: number }>({
    rotation,
    quality: 0,
  });
  /** How many orientations the probe has tried this session. */
  const triedRef = useRef(0);
  /** Latest apparent size, for the diagnostic readout. */
  const sizeRef = useRef(0);
  const diagnosticsRef = useRef<MotionDiagnostics>({
    label: '',
    cameraW: 0,
    cameraH: 0,
    modelW: 0,
    modelH: 0,
    rotation,
    settled: false,
    poses: 0,
    quality: 0,
    size: 0,
  });

  const recalibrate = useCallback((): void => {
    lockXRef.current = null;
    smoothXRef.current = 0.5;
    smoothYRef.current = 0.5;
    playerRef.current = emptyTrackingState();
    // The orientation is NOT reset. Once the probe has found the one that works
    // on this machine it is right for every game that follows, and re-probing
    // per run would spend the first seconds of each one cycling through
    // orientations the tracker already knows are wrong.
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus('starting');
      return;
    }

    let cancelled = false;
    rotationRef.current = rotation;
    orientationLockedRef.current = false;
    lastPoseAtRef.current = 0;
    triedRef.current = 0;
    bestSeenRef.current = { rotation, quality: 0 };
    // Captured now rather than read in cleanup: by then the ref may point at a
    // different element, and clearing the wrong one leaves this stream attached
    // to nothing that can release it. Same reasoning as useFootfallCounter.
    const videoElement = videoRef.current;
    let stream: MediaStream | null = null;
    let loopTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryIndex = 0;
    let lastAt = 0;

    const tracker = new PoseTracker();

    const tick = (): void => {
      if (cancelled || !videoElement) return;
      const started = performance.now();
      const dt = lastAt > 0 ? (started - lastAt) / 1000 : 0;
      lastAt = started;

      try {
        const poses = tracker.detect(videoElement, rotationRef.current);
        const prev = playerRef.current;

        // ── Orientation probe ──
        //
        // Scores each orientation rather than accepting the first that returns
        // anything. MediaPipe hands back a pose for a person lying sideways
        // too — a bad one — and the earlier version locked onto exactly that,
        // then spent the rest of the session reading nonsense out of it.
        //
        // Runs only while the orientation is unsettled, and only while the
        // camera is genuinely delivering frames: a stalled stream is not a
        // wrong-way-up stream, and cycling rotations because a cable fell out
        // would hide the real fault.
        const framesFlowing = videoElement.readyState >= 2 && videoElement.videoWidth > 0;
        const bestQuality = poses.reduce(
          (acc, pose) => Math.max(acc, poseQuality(toBodyLandmarks(pose.landmarks, 0))),
          0,
        );

        if (!orientationLockedRef.current && framesFlowing) {
          if (lastPoseAtRef.current === 0) lastPoseAtRef.current = started;

          if (bestQuality >= GOOD_POSE) {
            // Unmistakably a person, the right way up. Settle here.
            orientationLockedRef.current = true;
            bestSeenRef.current = { rotation: rotationRef.current, quality: bestQuality };
          } else {
            if (bestQuality > bestSeenRef.current.quality) {
              bestSeenRef.current = { rotation: rotationRef.current, quality: bestQuality };
            }
            if (started - lastPoseAtRef.current > ORIENTATION_PROBE_MS) {
              lastPoseAtRef.current = started;
              triedRef.current += 1;
              if (triedRef.current >= 4) {
                // All four seen and none was convincing — a room with nobody in
                // it looks exactly like this. Settle on whichever scored best
                // (the configured one, if nothing ever scored) and stop
                // cycling, so a visitor who walks up later is not met with a
                // preview spinning through orientations.
                orientationLockedRef.current = true;
                rotationRef.current = bestSeenRef.current.rotation;
                setEffectiveRotation(bestSeenRef.current.rotation);
              } else {
                const next = ((rotationRef.current + 90) % 360) as CameraRotation;
                rotationRef.current = next;
                setEffectiveRotation(next);
              }
            }
          }
        } else if (bestQuality > 0) {
          lastPoseAtRef.current = started;
        }

        // ── Pick the locked player out of what we can see ──
        let best: {
          x: number;
          y: number;
          width: number;
          height: number;
          confidence: number;
          landmarks: ReturnType<typeof toBodyLandmarks>;
        } | null = null;
        let bestDistance = Infinity;

        for (const pose of poses) {
          // 0, NOT the venue rotation: PoseTracker already turned the frame
          // upright before inference, so these landmarks are the right way up
          // and only the mirror is left to apply. Turning them again here is
          // the bug this comment exists to prevent.
          const landmarks = toBodyLandmarks(pose.landmarks, 0);
          const centre = torsoCenter(landmarks);
          if (!centre) continue;

          const locked = lockXRef.current;
          if (locked === null) {
            // Unlocked: take the LARGEST torso, which at a kiosk means the
            // person standing closest — the one who walked up to play.
            if (!best || centre.width > best.width) {
              best = { ...centre, landmarks };
              bestDistance = 0;
            }
          } else {
            // Locked: identity is continuity, not prominence.
            const d = Math.abs(centre.x - locked);
            if (d < bestDistance && d <= LOCK_RADIUS) {
              best = { ...centre, landmarks };
              bestDistance = d;
            }
          }
        }

        if (best) {
          lockXRef.current = best.x;
          // Expand first, then smooth: smoothing the raw value and expanding
          // afterwards would multiply the residual jitter by the same factor as
          // the signal, undoing the filter at the screen edges.
          const targetX = expandRange(best.x);
          smoothXRef.current = smoothToward(smoothXRef.current, targetX, dt);
          smoothYRef.current = smoothToward(smoothYRef.current, best.y, dt);

          playerRef.current = {
            detected: true,
            centerX: smoothXRef.current,
            centerY: smoothYRef.current,
            width: best.width,
            height: best.height,
            confidence: best.confidence,
            landmarks: best.landmarks,
            people: poses.length,
            lastSeenAt: started,
          };
        } else {
          // Nobody matched. Inside the grace window this is a dropped frame and
          // the last position stands; past it, the player has genuinely gone.
          const gone = started - prev.lastSeenAt > LOSS_GRACE_MS;
          if (gone) {
            lockXRef.current = null;
            playerRef.current = { ...emptyTrackingState(), people: poses.length };
          } else {
            playerRef.current = { ...prev, people: poses.length };
          }
        }

        // ── Status, for the coaching overlay ──
        // Ordered by what the visitor should fix first. None of these can stop
        // a game starting any more — see the note in MotionCalibration.
        const now = playerRef.current;
        const size = now.landmarks
          ? apparentSize(now.landmarks, tracker.frameW, tracker.frameH)
          : 0;
        sizeRef.current = size;
        diagnosticsRef.current = {
          ...diagnosticsRef.current,
          cameraW: videoElement.videoWidth,
          cameraH: videoElement.videoHeight,
          modelW: tracker.frameW,
          modelH: tracker.frameH,
          rotation: rotationRef.current,
          settled: orientationLockedRef.current,
          poses: poses.length,
          quality: bestQuality,
          size,
        };

        setStatus(
          !now.detected
            ? 'no-player'
            : size > SIZE_TOO_CLOSE
              ? 'too-close'
              : size > 0 && size < SIZE_TOO_FAR
                ? 'too-far'
                : now.people > 1
                  ? 'crowded'
                  : isInPlayArea(now)
                    ? 'tracking'
                    : 'out-of-area',
        );
      } catch {
        // One bad frame (a stream that died between the readyState check and the
        // detect call) must not kill the loop.
      }

      const elapsed = performance.now() - started;
      loopTimer = setTimeout(tick, Math.max(0, INFERENCE_INTERVAL_MS - elapsed));
    };

    const start = async (): Promise<void> => {
      setStatus('starting');
      const rejected = new Set<string>();
      try {
        let opened: MediaStream | null = null;
        for (let attempt = 0; attempt < 3 && !opened; attempt += 1) {
          const deviceId = await pickCamera(rejected);
          if (!deviceId) break;
          let candidate: MediaStream;
          try {
            // 640×480 is plenty: the model letterboxes to 256 internally, and a
            // small stream is what keeps this cheap beside everything else on
            // screen. 30 fps because we sample it at 20 — asking for 15 would
            // mean every other inference saw a repeated frame.
            // ── DEVICE ONLY. No size, no aspect, no orientation. ──
            //
            // This asked for 640×480 and that was a real bug on the 제주 floor.
            // The Elgato there is configured PORTRAIT in Windows (1080×1920),
            // so a landscape request makes Chromium scale and CROP to
            // approximate the shape it was told to want: the visitor arrives
            // zoomed in, their shoulders fall outside the frame, and pose
            // detection finds nobody. The symptom is not "the camera is wrong",
            // it is a calibration gate that never opens however long someone
            // stands there.
            //
            // `useKioskCamera` learned this exact lesson for the AR photo — see
            // the note there. The camera's native mode is the only correct
            // request; PoseTracker scales the frame down on its own canvas, so
            // asking for a small one buys nothing anyway.
            candidate = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: deviceId } },
              audio: false,
            });
          } catch {
            rejected.add(deviceId);
            continue;
          }
          // The label-free backstop: a stereo pair's aspect is nothing like a
          // webcam's, so if this is one we opened the ZED blind.
          const { width = 0, height = 0 } = candidate.getVideoTracks()[0]?.getSettings() ?? {};
          if (looksLikeStereoPair(width, height)) {
            candidate.getTracks().forEach((t) => t.stop());
            rejected.add(deviceId);
            continue;
          }
          opened = candidate;
        }

        if (!opened) throw new Error('No usable camera');
        if (cancelled) {
          opened.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = opened;
        diagnosticsRef.current = {
          ...diagnosticsRef.current,
          // Empty until camera permission has been granted at least once —
          // itself a useful thing to see on the readout.
          label: opened.getVideoTracks()[0]?.label ?? '',
        };

        if (!videoElement) throw new Error('No video element');
        videoElement.srcObject = stream;
        await videoElement.play();

        await tracker.load();
        if (cancelled) return;
        tracker.resetClock();

        retryIndex = 0;
        lastAt = 0;
        setStatus('no-player');
        tick();
      } catch {
        // The camera may well have opened and the MODEL have been what failed.
        // Letting that stream live would mean the retry opens a second one — and
        // on Windows the second open of a busy device is the one that fails.
        stream?.getTracks().forEach((t) => t.stop());
        stream = null;
        if (videoElement) videoElement.srcObject = null;
        if (cancelled) return;

        const delay = RETRY_DELAYS_MS[retryIndex];
        if (delay === undefined) {
          // Out of retries. The games fall back to a touch-playable message
          // rather than trapping the visitor on a dead camera screen.
          setStatus('unavailable');
          return;
        }
        retryIndex += 1;
        setStatus('starting');
        retryTimer = setTimeout(() => void start(), delay);
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (loopTimer) clearTimeout(loopTimer);
      if (retryTimer) clearTimeout(retryTimer);
      // Releasing the device is the contract with everything else that wants
      // it, and it has to happen here, synchronously, not on some later frame.
      stream?.getTracks().forEach((t) => t.stop());
      if (videoElement) videoElement.srcObject = null;
      // Drop every trace of the person who was just in front of the camera —
      // including the frame buffer the model was reading.
      tracker.dispose();
      playerRef.current = emptyTrackingState();
      lockXRef.current = null;
    };
  }, [enabled, rotation]);

  return {
    videoRef,
    player: playerRef,
    status,
    rotation: effectiveRotation,
    recalibrate,
    diagnostics: diagnosticsRef,
  };
}
