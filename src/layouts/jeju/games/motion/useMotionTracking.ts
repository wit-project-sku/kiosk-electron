/**
 * The one camera pipeline the 제주 motion games share.
 *
 * Camera → frame → locked controller → smoothed, mirrored, upright numbers.
 * Games read the result from a ref and never touch anything above it.
 *
 * ══ A HAND STEERS; A BODY IS THE FALLBACK ═════════════════════════════
 * Both games are played with ONE RAISED HAND. The reasoning is on HandTracker
 * and it is about the venue, not the technology: 제주공항 is a concourse, and a
 * game that asks a visitor to jump up and down in front of a queue is a game
 * most of them decline.
 *
 * So each pass looks for a hand first. While one is visible the pose model is
 * not run at all — the cost of two models is not paid, only alternated between.
 * When no hand has been seen for {@link POSE_FALLBACK_MS} the body takes over
 * exactly as it used to, which keeps the games playable for a visitor with
 * both hands full and keeps the coaching honest ("step in front of the screen"
 * needs to know somebody is THERE and not merely that no hand is up).
 *
 * The switch is invisible to a game: `centerX`/`centerY` mean "the controller"
 * whichever is driving, and `source` says which so a game with a movement
 * THRESHOLD can size it correctly. See PlayerTrackingState.
 *
 * ══ WHY THIS MAY OPEN THE CAMERA AT ALL ═══════════════════════════════
 * This runs in the CUSTOMER DISPLAY window — the one that already owns the
 * camera for the AR capture and the 손동작 게이트 — because that is the screen
 * the camera faces and the screen a visitor with a hand up is looking at. The
 * touch window never opens a camera for these games; it only asks main to start
 * one (see MotionRemote).
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
import { classifyHand, type HandGesture } from '@renderer/lib/handGesture';
import { FrameSource } from './FrameSource';
import { HandTracker } from './HandTracker';
import { PoseTracker } from './PoseTracker';
import { emptyTrackingState, type PlayerTrackingState, type TrackingStatus } from './poseTypes';
import { handApparentSize, handCentre, handQuality, toGameHand } from './handMath';
import {
  apparentSize,
  expandRange,
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
 * How far a candidate may be from the locked controller and still BE it, in
 * normalized frame units.
 *
 * This is the whole multi-candidate story, and it matters more for hands than
 * it ever did for bodies. Each frame the model may report two hands in either
 * order — MediaPipe makes no promise about which is which between frames — so
 * identity is re-established by proximity to where the lock was last seen.
 * Without it the controls would jump between the player's raised hand and the
 * one hanging at their side several times a second.
 *
 * Anything further than this is a bystander (or the other hand), and it never
 * takes the controls mid-game however prominent it is.
 */
const LOCK_RADIUS = 0.28;

/**
 * How long a hand may be gone before the body takes the controls back.
 *
 * Generous, because the cost of being wrong is asymmetric. Switching to the
 * body a moment late costs nothing — the hand's last position is held through
 * the loss grace anyway. Switching EARLY hands the controls from a hand the
 * player is actively waving to their own torso, which does not move, and the
 * game appears to freeze while they wave harder.
 *
 * It also has to outlast a hand rotating through a pose the model dislikes:
 * a palm turned fully edge-on drops out for a good half second.
 */
const POSE_FALLBACK_MS = 1400;

/**
 * Apparent palm size (see `handApparentSize`) outside which the visitor is
 * coached to move their hand.
 *
 * The hand-shaped twins of {@link SIZE_TOO_CLOSE}/{@link SIZE_TOO_FAR}, and
 * deliberately very wide for the same reason: these drive ONE LINE OF COACHING
 * and nothing else. A distance estimate that GATES a game is how a visitor ends
 * up being told to fix something that is not broken, with no way past it — see
 * the note in MotionCalibration.
 *
 * The floor is the one that does work: below it the landmarks belong to someone
 * else's hand further down the concourse, and following it would mean the
 * basket is steered by a stranger walking past.
 */
const HAND_TOO_CLOSE = 0.55;
const HAND_TOO_FAR = 0.03;

/**
 * Apparent palm size below which a hand is not the player's at all.
 *
 * Deliberately BELOW {@link HAND_TOO_FAR}, and the gap is the entire point:
 * between the two, a hand is tracked, the gate opens, the game plays, and the
 * screen says "hold your hand a little closer". If this floor sat at or above
 * the coaching threshold there would be no such band — a visitor slightly too
 * far would simply not exist, and would be told to raise the hand they are
 * already holding up, with nothing they could do about it. That exact shape of
 * dead end is why the body version stopped gating on distance; repeating it
 * here in new units would be a poor trade.
 *
 * Below this band the landmarks belong to somebody further down the concourse,
 * and following them would mean the basket is steered by a stranger.
 */
const HAND_MIN_SIZE = 0.02;

/**
 * Below this a hand is not hand-SHAPED enough to steer with — see
 * `handQuality`, which scores shape and deliberately not distance.
 *
 * Refuses garbage only. A fist and a splayed palm both score full marks,
 * because both are poses a player will hold for a whole run. How far away the
 * hand is, is {@link HAND_MIN_SIZE}'s question.
 */
const GOOD_HAND = 0.45;

/**
 * Smoothing time constant for a hand, in seconds.
 *
 * Shorter than the body's 0.09 because a hand is a quicker instrument and the
 * player can SEE it: lag that reads as weight in a torso controller reads as
 * unresponsiveness when the thing lagging is at the end of their own arm.
 */
const HAND_TAU = 0.06;

/**
 * How long a hand may steer, while the orientation is unsettled, before the
 * orientation is declared settled anyway.
 *
 * ══ THIS IS WHAT KEEPS TWO MODELS COSTING ONE ═════════════════════════
 * The pose pass runs while the orientation is unconfirmed, and confirming it
 * needs a good POSE — which a visitor standing close with a hand up may never
 * produce, because their shoulders are outside a portrait frame at that
 * distance. Without this the probe would stay open for the whole run and every
 * single frame would pay for both models on a machine with no discrete GPU.
 *
 * Settling on a hand is not a guess. It does not claim the frame is upright; it
 * observes that the CURRENT orientation is producing a working controller,
 * which is the only question the probe was ever asking. Turning the frame from
 * under a player who is actively steering would be the wrong answer even if the
 * rotation were wrong.
 *
 * Long enough that a hand crossing the frame does not settle it; short enough
 * that the double cost lasts a moment rather than a run.
 */
const HAND_SETTLE_MS = 1500;

/**
 * How near the edge of the CAMERA's view the controller may get before the
 * visitor is told it is about to leave.
 *
 * Measured on the raw position, NOT the expanded one — see the note where it is
 * used. A hand reaching the edge of the play FIELD is a player doing exactly
 * what the game wants; a hand reaching the edge of the FRAME is a player about
 * to lose their controller, and only the second is worth a word about.
 */
const EDGE_MARGIN = 0.05;

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
  /** People the pose model returned this frame. Zero while a hand is steering. */
  poses: number;
  /** Best pose quality this frame, 0..1. Low means "not a person, upright". */
  quality: number;
  /** Apparent size, 0..1 of the frame's short edge. Drives the distance hints. */
  size: number;
  /**
   * Hands the model returned this frame.
   *
   * The first row to read now the games are hand-steered. HANDS 0 with a live
   * stream and a ready model is a visitor who has not raised one — which is a
   * copy problem, not a camera problem, and the two look identical from the
   * floor without this number.
   */
  hands: number;
  /** Best hand quality this frame, 0..1 — see `handQuality`. */
  handQuality: number;
  /** Apparent palm size, 0..1 of the frame's short edge. */
  handSize: number;
  /** Whether the hand model is actually available. See {@link model}. */
  handModel: 'loading' | 'ready' | 'failed';
  /** What is steering right now. `null` is nobody at all, not "body". */
  source: 'hand' | 'body' | null;
  /**
   * Best pose quality in the last few seconds.
   *
   * A detection that flickers for two frames never shows in `quality`, but it
   * is the most useful fact there is: it means the model CAN see the person and
   * the problem is stability, not blindness.
   */
  peakQuality: number;
  /** Inference passes run since the camera opened. */
  frames: number;
  /**
   * How many times the camera has been (re)opened.
   *
   * Should be 1. Anything higher means `start()` is failing and retrying, which
   * resets the frame counter each time and produces the very confusing reading
   * of a loop that has "only ever run once" — see FRAMES.
   */
  starts: number;
  /** Why the last start failed, if one did. Empty when nothing has gone wrong. */
  lastError: string;
  /**
   * Whether the pose model is actually available.
   *
   * `loading` for more than a few seconds means the frame loop is running but
   * has nothing to run — which looks exactly like an empty room in every other
   * field, and was the real fault on 제주.
   */
  model: 'loading' | 'ready' | 'failed';
  /**
   * The camera has stopped delivering NEW frames.
   *
   * `videoWidth` stays set on a stalled stream, so a dead feed and an empty
   * room produce identical numbers everywhere else — this is the one field that
   * tells them apart. A paused or stalled <video> hands MediaPipe the same
   * frame forever, and if that frame is the black one the device opened on, the
   * model correctly reports nobody, for ever.
   */
  stalled: boolean;
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
  /**
   * What is currently steering — also state, and for the same reason.
   *
   * The gate and the coaching banner both ask the visitor for something, and
   * what they should ask for depends on this: "raise your hand" is right for
   * everyone except the visitor already playing with their body because their
   * hands are full. It changes at most a couple of times a run, so unlike the
   * position it costs nothing to render from.
   */
  source: 'hand' | 'body' | null;
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
  /** Which input is steering. See the field's note on MotionTracking. */
  const [source, setSource] = useState<'hand' | 'body' | null>(null);
  /** The orientation in force. Starts at the venue's config; the probe may move it. */
  const [effectiveRotation, setEffectiveRotation] = useState<CameraRotation>(rotation);

  /**
   * Where the lock was last seen, for the proximity test. Null = unlocked.
   *
   * Two-dimensional now, and it has to be: two BODIES in a portrait frame are
   * reliably told apart by x alone, but a player's two HANDS are often at the
   * same x and a foot apart vertically — one raised, one at their side.
   */
  const lockRef = useRef<{ x: number; y: number } | null>(null);
  /** Which input the lock belongs to. A hand lock is never matched to a torso. */
  const lockSourceRef = useRef<'hand' | 'body' | null>(null);
  /** performance.now() of the last frame that contained a usable hand. */
  const lastHandAtRef = useRef(0);
  /** When the current unbroken run of hand frames began. 0 = no hand. */
  const handHeldSinceRef = useRef(0);
  /**
   * The controller's RAW horizontal position, before range expansion.
   *
   * Kept beside the smoothed one because the two answer different questions:
   * the expanded value is where the basket goes, this is where the hand
   * actually is in the camera's view. Only this one can say "you are about to
   * leave the frame".
   */
  const rawXRef = useRef(0.5);
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
  const diagnosticsRef = useRef<MotionDiagnostics>({
    label: '',
    cameraW: 0,
    cameraH: 0,
    modelW: 0,
    modelH: 0,
    rotation,
    settled: false,
    starts: 0,
    lastError: '',
    model: 'loading',
    poses: 0,
    quality: 0,
    size: 0,
    hands: 0,
    handQuality: 0,
    handSize: 0,
    handModel: 'loading',
    source: null,
    peakQuality: 0,
    frames: 0,
    stalled: false,
  });
  /** Throttle for the blind-tracking log — see the note where it is emitted. */
  const loggedAtRef = useRef(0);
  /** Rolling peak, decayed so it reflects the last few seconds, not the session. */
  const peakRef = useRef({ value: 0, at: 0 });
  /** Frame-liveness: the video's own clock, and when it last moved. */
  const videoTimeRef = useRef({ time: -1, changedAt: 0, frames: 0 });

  const recalibrate = useCallback((): void => {
    lockRef.current = null;
    lockSourceRef.current = null;
    handHeldSinceRef.current = 0;
    rawXRef.current = 0.5;
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
      setSource(null);
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

    lastHandAtRef.current = 0;
    handHeldSinceRef.current = 0;
    rawXRef.current = 0.5;
    lockRef.current = null;
    lockSourceRef.current = null;

    // One prepared frame per pass, shared by both models — see FrameSource.
    const frame = new FrameSource();
    const hands = new HandTracker();
    const tracker = new PoseTracker();

    const tick = (): void => {
      if (cancelled || !videoElement) return;
      const started = performance.now();
      const dt = lastAt > 0 ? (started - lastAt) / 1000 : 0;
      lastAt = started;

      try {
        // ── One frame, prepared once ──
        //
        // Both models read THIS canvas, upright and scaled. Doing it here
        // rather than inside each tracker is what keeps a two-model pipeline
        // costing one rotate-and-scale pass over a 1080×1920 frame.
        const source = frame.draw(videoElement, rotationRef.current);
        const framesFlowing = source !== null;
        const prev = playerRef.current;

        // ── The hand: the controller ──
        //
        // Run first and run always. Everything below is conditional on there
        // being no hand, which is what keeps the normal case at one inference
        // per pass rather than two.
        const rawHands = framesFlowing && source ? hands.detect(source) : [];
        interface Candidate {
          x: number;
          y: number;
          span: number;
          quality: number;
          gesture: HandGesture | null;
        }
        const handCandidates: Candidate[] = [];
        let bestHandQuality = 0;
        for (const raw of rawHands) {
          // 0, NOT the venue rotation: FrameSource already turned the frame
          // upright before inference, so these landmarks are the right way up
          // and only the mirror is left to apply. Turning them again here is
          // the bug this comment exists to prevent.
          const marks = toGameHand(raw.landmarks, 0);
          const centre = handCentre(marks);
          if (!centre) continue;
          const quality = handQuality(marks, centre.span);
          bestHandQuality = Math.max(bestHandQuality, quality);
          if (quality < GOOD_HAND) continue;
          // The distance floor, not a quality one — see HAND_MIN_SIZE.
          if (handApparentSize(centre.span, frame.width, frame.height) < HAND_MIN_SIZE) continue;
          handCandidates.push({
            x: centre.x,
            y: centre.y,
            span: centre.span,
            quality,
            // Classified from the MIRRORED landmarks, which is harmless: every
            // test in `classifyHand` is a distance, and a mirror preserves
            // distances. Reaching for the raw ones would only be a second copy.
            gesture: classifyHand(marks),
          });
        }

        // Pick the steering hand. Locked: identity is continuity, not
        // prominence — see LOCK_RADIUS. Unlocked: the BIGGEST palm, which at a
        // kiosk means the hand nearest the camera, which means the hand
        // somebody has deliberately raised rather than the one at their side.
        let hand: Candidate | null = null;
        if (lockSourceRef.current === 'hand' && lockRef.current) {
          const locked = lockRef.current;
          let bestDistance = Infinity;
          for (const candidate of handCandidates) {
            const d = Math.hypot(candidate.x - locked.x, candidate.y - locked.y);
            if (d < bestDistance && d <= LOCK_RADIUS) {
              hand = candidate;
              bestDistance = d;
            }
          }
        }
        if (!hand) {
          for (const candidate of handCandidates) {
            if (!hand || candidate.span > hand.span) hand = candidate;
          }
        }
        if (hand) {
          lastHandAtRef.current = started;
          if (handHeldSinceRef.current === 0) handHeldSinceRef.current = started;
        } else {
          handHeldSinceRef.current = 0;
        }

        // ── The body: the fallback, and the orientation witness ──
        //
        // Skipped entirely while a hand is steering. That is the whole cost
        // argument for running two models on a machine with no discrete GPU:
        // they are alternated, never stacked. It runs when no hand has been
        // seen for POSE_FALLBACK_MS, and while the orientation is unsettled —
        // because a hand is found just as readily in a sideways frame, which
        // makes it useless for noticing that the frame IS sideways.
        const handIsFresh = started - lastHandAtRef.current <= POSE_FALLBACK_MS;
        const needPose = !orientationLockedRef.current || !handIsFresh;
        const poses = needPose && framesFlowing && source ? tracker.detect(source) : [];

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
            // ── A visible hand SETTLES the probe, it does not advance it ──
            //
            // The probe exists to escape "we can see nothing". Seeing a hand is
            // not that. Turning the frame under a player who is actively
            // steering with one would swing the controls through ninety degrees
            // mid-gesture, which is worse than an unconfirmed orientation — and
            // the venue's configured rotation, which is what stands meanwhile,
            // is right on every machine where nothing has gone wrong.
            //
            // Held long enough, the hand ends the probe outright: see
            // HAND_SETTLE_MS, and note that this is also the only thing
            // stopping the pose pass from running beside the hand pass for a
            // whole game.
            if (
              hand &&
              handHeldSinceRef.current > 0 &&
              started - handHeldSinceRef.current > HAND_SETTLE_MS
            ) {
              orientationLockedRef.current = true;
            } else if (!hand && started - lastPoseAtRef.current > ORIENTATION_PROBE_MS) {
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
            } else if (hand) {
              // Hold the timer open so the probe does not fire the instant the
              // hand leaves, having accumulated the whole time it was there.
              lastPoseAtRef.current = started;
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

        // Only when no hand is steering. A body found during the orientation
        // probe must not fight the hand for the controls.
        if (!hand) {
          for (const pose of poses) {
            // 0, NOT the venue rotation — same reason as the hands above.
            const landmarks = toBodyLandmarks(pose.landmarks, 0);
            const centre = torsoCenter(landmarks);
            if (!centre) continue;

            const locked = lockSourceRef.current === 'body' ? lockRef.current : null;
            if (locked === null) {
              // Unlocked: take the LARGEST torso, which at a kiosk means the
              // person standing closest — the one who walked up to play.
              if (!best || centre.width > best.width) {
                best = { ...centre, landmarks };
                bestDistance = 0;
              }
            } else {
              // Locked: identity is continuity, not prominence.
              const d = Math.abs(centre.x - locked.x);
              if (d < bestDistance && d <= LOCK_RADIUS) {
                best = { ...centre, landmarks };
                bestDistance = d;
              }
            }
          }
        }

        // ── Smooth whichever one won, into the same two numbers ──
        if (hand) {
          lockRef.current = { x: hand.x, y: hand.y };
          lockSourceRef.current = 'hand';
          rawXRef.current = hand.x;
          // Expand first, then smooth: smoothing the raw value and expanding
          // afterwards would multiply the residual jitter by the same factor as
          // the signal, undoing the filter at the screen edges.
          smoothXRef.current = smoothToward(
            smoothXRef.current,
            expandRange(hand.x),
            dt,
            HAND_TAU,
          );
          // NOT expanded. The vertical channel is read against a baseline
          // measured on this visitor (see useJejuRun), so stretching it would
          // only rescale both sides of a comparison that is already relative.
          smoothYRef.current = smoothToward(smoothYRef.current, hand.y, dt, HAND_TAU);

          playerRef.current = {
            detected: true,
            source: 'hand',
            centerX: smoothXRef.current,
            centerY: smoothYRef.current,
            width: handApparentSize(hand.span, frame.width, frame.height),
            height: 0,
            confidence: hand.quality,
            gesture: hand.gesture,
            landmarks: null,
            people: handCandidates.length,
            lastSeenAt: started,
          };
        } else if (best) {
          lockRef.current = { x: best.x, y: best.y };
          lockSourceRef.current = 'body';
          rawXRef.current = best.x;
          smoothXRef.current = smoothToward(smoothXRef.current, expandRange(best.x), dt);
          smoothYRef.current = smoothToward(smoothYRef.current, best.y, dt);

          playerRef.current = {
            detected: true,
            source: 'body',
            centerX: smoothXRef.current,
            centerY: smoothYRef.current,
            width: apparentSize(best.landmarks, frame.width, frame.height),
            height: best.height,
            confidence: best.confidence,
            gesture: null,
            landmarks: best.landmarks,
            people: poses.length,
            lastSeenAt: started,
          };
        } else {
          // Nobody matched. Inside the grace window this is a dropped frame and
          // the last position stands; past it, the player has genuinely gone.
          const gone = started - prev.lastSeenAt > LOSS_GRACE_MS;
          const seen = handCandidates.length + poses.length;
          if (gone) {
            lockRef.current = null;
            lockSourceRef.current = null;
            playerRef.current = { ...emptyTrackingState(), people: seen };
          } else {
            playerRef.current = { ...prev, people: seen };
          }
        }

        // ── Status, for the coaching overlay ──
        // Ordered by what the visitor should fix first. None of these can stop
        // a game starting any more — see the note in MotionCalibration.
        const now = playerRef.current;
        const size = now.width;
        const steeringByHand = now.source === 'hand';
        const tooClose = steeringByHand ? HAND_TOO_CLOSE : SIZE_TOO_CLOSE;
        const tooFar = steeringByHand ? HAND_TOO_FAR : SIZE_TOO_FAR;

        // ── Liveness ──
        // `currentTime` advances only while the element is actually decoding.
        // A stream that opened and then died keeps its dimensions, so this is
        // the only thing that separates "nobody there" from "nothing arriving".
        const vt = videoElement.currentTime;
        const live = videoTimeRef.current;
        live.frames += 1;
        if (vt !== live.time) {
          live.time = vt;
          live.changedAt = started;
        }
        const stalled = live.changedAt > 0 && started - live.changedAt > 1500;

        // Rolling peak over ~4s, so a brief detection is still visible to
        // whoever is reading the panel a moment later. Takes whichever model
        // ran — the panel's question is "can this machine see anybody at all".
        const peakCandidate = Math.max(bestQuality, bestHandQuality);
        if (peakCandidate > peakRef.current.value || started - peakRef.current.at > 4000) {
          peakRef.current = { value: peakCandidate, at: started };
        }

        diagnosticsRef.current = {
          ...diagnosticsRef.current,
          peakQuality: peakRef.current.value,
          frames: live.frames,
          stalled,
          cameraW: videoElement.videoWidth,
          cameraH: videoElement.videoHeight,
          modelW: frame.width,
          modelH: frame.height,
          model: tracker.modelState,
          handModel: hands.modelState,
          rotation: rotationRef.current,
          settled: orientationLockedRef.current,
          poses: poses.length,
          quality: bestQuality,
          size: now.source === 'body' ? size : 0,
          hands: rawHands.length,
          handQuality: bestHandQuality,
          handSize: steeringByHand ? size : 0,
          source: now.source,
        };

        // ── The same numbers, in the log ──────────────────────────────
        //
        // The on-screen panel needs somebody standing at the kiosk to read it.
        // This is for the case nobody is: a 제주 machine in an airport whose
        // motion games have quietly stopped detecting anyone, with a support
        // call days later and no way to reconstruct why.
        //
        // Self-limiting on purpose. It says nothing at all while tracking is
        // working, and at most once a second while it is not — so a healthy
        // kiosk logs zero lines from here, and a broken one logs exactly enough
        // to diagnose without drowning the file it shares with everything else.
        // `spyRendererConsole` routes it into the same log as the main process
        // (see main/core/logger.ts).
        if (!now.detected && started - loggedAtRef.current > 1000) {
          loggedAtRef.current = started;
          // eslint-disable-next-line no-console
          console.info(
            `[motion] no player · cam ${videoElement.videoWidth}x${videoElement.videoHeight}` +
              ` · model ${frame.width}x${frame.height} rot ${rotationRef.current}` +
              `${orientationLockedRef.current ? '' : ' (probing)'}` +
              ` · hands ${rawHands.length} hq ${bestHandQuality.toFixed(2)} [${hands.modelState}]` +
              ` · poses ${poses.length} q ${bestQuality.toFixed(2)} peak ${peakRef.current.value.toFixed(2)}` +
              ` · frames ${live.frames}${stalled ? ' STALLED' : ''}`,
          );
        }

        setSource(now.source);
        setStatus(
          !now.detected
            ? 'no-player'
            : size > tooClose
              ? 'too-close'
              : size > 0 && size < tooFar
                ? 'too-far'
                : // Two hands are one person's, not a crowd — nagging a player
                  // about their own resting arm would be constant. Only a
                  // second BODY is a second visitor.
                  now.source === 'body' && now.people > 1
                  ? 'crowded'
                  : // ── Measured on the RAW position, not the expanded one ──
                    //
                    // `centerX` has been stretched so a comfortable sweep
                    // reaches the edge of the play field (see `expandRange`),
                    // and it CLAMPS at 0 and 1. Testing it would therefore put
                    // "move back to the middle" on screen every time a player
                    // steered the basket to the edge — which is the game being
                    // played correctly, coached as a mistake. Fine for a torso,
                    // which rarely reached the clamp; constant for a hand,
                    // which reaches it whenever the player goes for a fruit in
                    // the corner.
                    //
                    // The frame's own edge is the thing actually worth warning
                    // about, because past it the controller disappears.
                    rawXRef.current > EDGE_MARGIN && rawXRef.current < 1 - EDGE_MARGIN
                    ? 'tracking'
                    : 'out-of-area',
        );
      } catch (error) {
        // One bad frame (a stream that died between the liveness check and the
        // detect call) must not kill the loop.
        //
        // ── But it must not be invisible either ──
        //
        // This was a bare `catch {}`, and that is how a non-monotonic MediaPipe
        // timestamp (see nextFrameStamp) hid for as long as it did: EVERY frame
        // of every game after the first threw here, silently, and the only
        // symptom anywhere was a camera that saw nobody. Recording it costs one
        // assignment on a path that is not supposed to run, and it puts the
        // reason on the diagnostic panel instead of nowhere.
        diagnosticsRef.current = {
          ...diagnosticsRef.current,
          lastError: error instanceof Error ? error.message : String(error),
        };
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
            // request; FrameSource scales the frame down on its own canvas, so
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
          starts: diagnosticsRef.current.starts + 1,
        };
        peakRef.current = { value: 0, at: 0 };
        videoTimeRef.current = { time: -1, changedAt: 0, frames: 0 };
        diagnosticsRef.current = {
          ...diagnosticsRef.current,
          // Empty until camera permission has been granted at least once —
          // itself a useful thing to see on the readout.
          label: opened.getVideoTracks()[0]?.label ?? '',
        };

        if (!videoElement) throw new Error('No video element');
        videoElement.srcObject = stream;
        await videoElement.play();

        retryIndex = 0;
        lastAt = 0;
        setStatus('no-player');

        // ── Start the loop NOW, before the model is ready ──────────────
        //
        // This used to `await tracker.load()` first, and that was the fault
        // behind "the games never detect anyone": when the load hung, the loop
        // never ran a single iteration. The camera was open and the preview was
        // live — the stream is attached above — so the only visible symptom was
        // that nobody was ever found, and the diagnostic panel read CAM 0×0 /
        // FRAMES 0 because the code that fills those had never executed.
        //
        // `detect()` returns [] while the landmarker is null, so ticking early
        // is harmless: the loop spins, reports liveness, and starts finding
        // people the moment the model arrives. It also means a model that never
        // loads degrades to "sees nobody" WITH a diagnostic saying why, instead
        // of a silent freeze.
        tick();

        // Both models, in parallel, neither awaited. The hand model is the one
        // a visitor is waiting on — until it arrives `detect()` returns [] and
        // the gate shows "raise your hand" to somebody already raising one — so
        // it is requested first, but a slow pose load must not hold it up and
        // vice versa.
        void hands.load().catch(() => {
          // Already reported through `modelState`; the loop keeps running and
          // the panel says the model failed rather than showing an empty room.
        });
        void tracker.load().catch(() => {
          // Same. A missing pose model costs the body fallback and the
          // orientation probe, not the games.
        });
      } catch (error) {
        diagnosticsRef.current = {
          ...diagnosticsRef.current,
          lastError: error instanceof Error ? error.message : String(error),
        };
        // The camera may well have opened and the MODEL have been what failed.
        // Letting that stream live would mean the retry opens a second one — and
        // on Windows the second open of a busy device is the one that fails.
        stream?.getTracks().forEach((t) => t.stop());
        stream = null;
        if (videoElement) videoElement.srcObject = null;
        if (cancelled) return;

        // ── Keep trying, but say so ──
        //
        // This used to stop after three attempts, and on a kiosk that is the
        // wrong shape of give-up: the commonest reason this path runs at all is
        // a device Windows has not finished releasing from the run the visitor
        // JUST played, and the ladder can easily expire while the driver is
        // still letting go. A screen that has decided the camera is dead, on a
        // machine where it came back four seconds later, is a game nobody can
        // start until someone restarts the app.
        //
        // So the ladder still governs how fast we ask, and its last rung
        // repeats for as long as the screen is up. Exhausting it flips the
        // status to 'unavailable' — which is what puts the way out on Monitor
        // 1's remote and the "try a touch game" line on the big screen — and a
        // later success flips it straight back, because `start()` sets
        // 'no-player' on its way through.
        const delay = RETRY_DELAYS_MS[Math.min(retryIndex, RETRY_DELAYS_MS.length - 1)] ?? 8_000;
        if (retryIndex >= RETRY_DELAYS_MS.length) setStatus('unavailable');
        else setStatus('starting');
        retryIndex += 1;
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
      // including the frame buffer the models were reading. The landmarkers
      // themselves are shared singletons and deliberately survive; this is the
      // only copy of a frame anywhere in the pipeline.
      frame.dispose();
      playerRef.current = emptyTrackingState();
      lockRef.current = null;
      lockSourceRef.current = null;
    };
  }, [enabled, rotation]);

  return {
    videoRef,
    player: playerRef,
    status,
    source,
    rotation: effectiveRotation,
    recalibrate,
    diagnostics: diagnosticsRef,
  };
}
