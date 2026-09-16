/**
 * 제주 달리기 — the bridge between a raised hand and the runner.
 *
 * The engine ({@link createRunEngine}) owns the game entirely: its own canvas,
 * its own fixed-step loop, its own score. This hook does two things and nothing
 * else — it drives the shared MotionPhase lifecycle, and it turns the tracked
 * controller into JUMP and DUCK.
 *
 * ══ HOW A JUMP IS RECOGNISED ══════════════════════════════════════════
 * From the CONTROLLER'S HEIGHT, and relative to a baseline measured on this
 * specific visitor a moment earlier.
 *
 * An absolute threshold cannot work here: where someone's hand rests in the
 * frame depends on their height, their reach and how far back they stood, so a
 * line that catches a child's raise is one an adult crosses by standing still.
 * The countdown is the calibration — three seconds of somebody holding still,
 * which is exactly what the baseline needs — and everything after is measured
 * as a fraction of the frame away from where THEY were.
 *
 * ══ THE TWO CONTROLLERS ARE NOT THE SAME SIZE ═════════════════════════
 * This is the one game where `source` is load-bearing. Raising a HAND moves the
 * tracked point by a quarter of the frame or more; JUMPING moves the shoulder
 * line by about a twentieth. A single threshold cannot serve both — tuned for
 * the hand nobody could ever jump high enough, tuned for the body the game
 * would fire on a hand that merely drifted.
 *
 * So the thresholds are a pair, picked per frame from whichever input the
 * tracker says is steering. See {@link THRESHOLDS}.
 *
 * ── Why the hand and not the shoulders any more ───────────────────────
 * Because 제주공항 is a concourse and the previous version asked visitors to
 * jump up and down in it. The full argument is on HandTracker. The body path
 * below is unchanged and still runs for anyone whose hands are full — it is a
 * fallback now rather than the only way in.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../../gameSound';
import type { MotionPhase, PlayerTrackingState } from '../poseTypes';
import { createRunEngine, type RunEngineHandle } from './runEngine';

/**
 * How far the controller must travel from the baseline to fire, as a fraction
 * of frame height, per input.
 *
 * Both pairs are asymmetric on purpose: going up is a deliberate, fast movement
 * and coming back down is a slow one, so the duck needs more travel to be sure
 * it is not the tail of a jump.
 *
 *   hand — a raise clears this several times over. The margin is sized against
 *          the drift of an arm the player is holding still, which is real: an
 *          unsupported arm sags a few percent of the frame over a 30-second
 *          run, and a threshold tight enough to catch a small raise would be
 *          crossed by that sag alone.
 *   body — unchanged from when this was the only input. A jump moves the
 *          shoulder line far more than 0.055; the margin exists so that
 *          shifting weight, breathing, or the tracker's own jitter never fires.
 */
const THRESHOLDS = {
  hand: { rise: 0.11, drop: 0.13 },
  body: { rise: 0.055, drop: 0.085 },
} as const;

/**
 * Once a jump fires, ignore the controller's height for this long.
 *
 * A raised hand — or an airborne body — keeps satisfying the jump condition for
 * as long as it is up, so without this one gesture would fire on every frame it
 * lasted. The engine ignores a jump while the pony is airborne anyway; this
 * stops the sound and the intent being spammed alongside it.
 *
 * It also sets the game's rhythm for a hand: raise, let it drop, raise again.
 */
const JUMP_LOCKOUT_MS = 550;

/** Frames of holding still used to fix the baseline before a run. */
const BASELINE_SAMPLES = 20;

/**
 * The practice run that opens every game, one move at a time.
 *
 * ══ WHY THE GAME TEACHES BY DOING ═════════════════════════════════════
 * Visitors could not work out how to play. A line of text saying "hand up to
 * jump" was on screen, and it did not help, because the controls are not
 * guessable from a sentence: UP relative to WHAT, and how far? Nobody at an
 * airport kiosk has used a raised hand as a game controller before.
 *
 * So the run opens on an empty track and asks for each move in turn, and only
 * moves on once the visitor has actually DONE it and watched her respond:
 *
 *   jump     "raise your hand"   → waits for a real jump
 *   jump-ok  "잘했어요!"          → a beat of praise
 *   duck     "lower your hand"   → waits for a real duck, held briefly
 *   duck-ok  "잘했어요!"
 *   go       "이제 시작!"          → obstacles start
 *   done     the real run
 *
 * Nothing here can trap anyone. Each ask gives up after {@link STEP_TIMEOUT_MS}
 * and moves on anyway — the lesson from the calibration gate, where a gate that
 * refused to open was the worst bug these games have had.
 */
export type RunTutorial = 'jump' | 'jump-ok' | 'duck' | 'duck-ok' | 'go' | 'done';

/** How long one ask waits before moving on regardless. */
const STEP_TIMEOUT_MS = 9000;
/** How long the praise stays up. Long enough to see her land. */
const PRAISE_MS = 1100;
/** "Go!" before the first obstacle is allowed. */
const GO_MS = 1300;
/**
 * A duck only counts once held this long, so a hand passing downward on its
 * way somewhere else does not tick the lesson off before the visitor has seen
 * her crouch.
 */
const DUCK_HOLD_MS = 300;

/**
 * Where the controller is, for the on-screen meter — see ControlMeter.
 *
 * A REF, rewritten twenty times a second and read by an animation frame, for
 * the same reason the tracker's own state is: nothing in React displays these
 * numbers, a DOM transform does.
 */
export interface RunControl {
  /**
   * The hand's height against this visitor's baseline, in THRESHOLD units:
   * -1 is exactly the jump line, +1 exactly the duck line, 0 is where they held
   * still during the countdown. Null while there is no baseline or no hand.
   */
  level: number | null;
  /** True while the baseline is still being measured. */
  calibrating: boolean;
}

export interface JejuRunApi {
  phase: MotionPhase;
  score: number;
  best: number;
  /** True while the player is out of view and the world is frozen. */
  stalled: boolean;
  finalScore: number | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Which step of the practice run is showing. 'done' once the real run starts. */
  tutorial: RunTutorial;
  /** Live controller level for the meter. */
  control: React.RefObject<RunControl>;
  ready: () => void;
  begin: () => void;
  restart: () => void;
}

export function useJejuRun(player: React.RefObject<PlayerTrackingState>): JejuRunApi {
  const [phase, setPhase] = useState<MotionPhase>('calibrating');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [stalled, setStalled] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [tutorial, setTutorial] = useState<RunTutorial>('jump');
  /** Mirrors `tutorial` for the 20Hz loop, which must not re-subscribe on it. */
  const tutorialRef = useRef<RunTutorial>('jump');
  const duckSinceRef = useRef(0);
  const control = useRef<RunControl>({ level: null, calibrating: true });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RunEngineHandle | null>(null);
  /** Height this visitor's controller rests at, 0..1 of frame. */
  const baselineRef = useRef<number | null>(null);
  const samplesRef = useRef<number[]>([]);
  /** Which input the baseline was measured from. A change invalidates it. */
  const baselineSourceRef = useRef<'hand' | 'body' | null>(null);
  const jumpUntilRef = useRef(0);
  const duckingRef = useRef(false);
  const stalledRef = useRef(false);
  const doneRef = useRef(false);

  /**
   * The controller's height right now, with the input it came from.
   *
   * `centerY` is the palm centre while a hand is steering and the shoulder line
   * while the body is — the tracker publishes both into the same field on
   * purpose (see PlayerTrackingState), so the only thing this has to carry
   * across is WHICH, for the thresholds.
   */
  const controlY = useCallback((): { y: number; source: 'hand' | 'body' } | null => {
    const state = player.current;
    if (!state?.detected || state.source === null) return null;
    return { y: state.centerY, source: state.source };
  }, [player]);

  // ── The engine lives exactly as long as the screen ────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createRunEngine(canvas, {
      onScore: (s, b) => {
        setScore(s);
        setBest(b);
      },
      onGameOver: (s, b) => {
        setScore(s);
        setBest(b);
        sfx.lose();
        setFinalScore(s);
        setPhase('result');
      },
    });
    engineRef.current = engine;
    return () => {
      // The engine holds a rAF callback; this is what releases it. Without it a
      // kiosk that runs for days accumulates one dead loop per game played.
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  const ready = useCallback(() => {
    baselineRef.current = null;
    baselineSourceRef.current = null;
    samplesRef.current = [];
    doneRef.current = false;
    setFinalScore(null);
    setScore(0);
    setPhase('countdown');
  }, []);

  const goTo = useCallback((next: RunTutorial) => {
    tutorialRef.current = next;
    setTutorial(next);
    if (next === 'jump-ok' || next === 'duck-ok') sfx.golden();
    if (next === 'done') engineRef.current?.setPractice(false);
  }, []);

  const begin = useCallback(() => {
    const engine = engineRef.current;
    engine?.start();
    // Every run opens on the practice track — including a replay. A second
    // visitor pressing 다시 하기 for a friend is a visitor who has not had the
    // lesson; one repeat of two moves costs a returning player a few seconds.
    engine?.setPractice(true);
    duckSinceRef.current = 0;
    goTo('jump');
    setPhase('playing');
  }, [goTo]);

  // ── The tutorial's clock: praise holds, and asks that time out ──
  useEffect(() => {
    if (phase !== 'playing' || tutorial === 'done') return;
    const delay =
      tutorial === 'jump' || tutorial === 'duck'
        ? STEP_TIMEOUT_MS
        : tutorial === 'go'
          ? GO_MS
          : PRAISE_MS;
    const next: RunTutorial =
      tutorial === 'jump' || tutorial === 'jump-ok'
        ? 'duck'
        : tutorial === 'duck' || tutorial === 'duck-ok'
          ? 'go'
          : 'done';
    const id = setTimeout(() => goTo(next), delay);
    return () => clearTimeout(id);
    // A stall (hand out of view) deliberately does NOT extend the timeout: the
    // screen is already telling them to bring the hand back, and a lesson that
    // waits forever for an absent visitor holds the kiosk hostage.
  }, [phase, tutorial, goTo]);

  const restart = useCallback(() => {
    baselineRef.current = null;
    baselineSourceRef.current = null;
    samplesRef.current = [];
    doneRef.current = false;
    setFinalScore(null);
    setScore(0);
    setPhase('calibrating');
  }, []);

  // ── Controller → JUMP / DUCK ──────────────────────────────────────────
  // A plain interval rather than an animation frame: the tracker only produces
  // a new reading 20 times a second, so sampling it at 60fps would be two
  // thirds wasted work on a value that has not changed.
  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'playing') return;
    const engine = engineRef.current;
    if (!engine) return;

    const id = setInterval(() => {
      const reading = controlY();

      // Out of view: freeze rather than kill. Lowering your hand — or walking
      // away — must never be scored as a crash; the engine keeps the run alive
      // and the world stops until the controller comes back.
      const lost = reading === null;
      if (lost !== stalledRef.current) {
        stalledRef.current = lost;
        setStalled(lost);
        engine.setPaused(lost);
      }
      if (reading === null) {
        control.current = { level: null, calibrating: baselineRef.current === null };
        return;
      }
      const { y, source } = reading;

      // ── A change of input invalidates the baseline ──
      //
      // A baseline taken from a raised palm is meaningless the moment the
      // tracker falls back to a shoulder line most of a frame lower down: every
      // reading after that clears the duck threshold, and the pony spends the
      // rest of the run crouched with no way for the player to stand it up.
      // Re-measuring costs a second of running in a straight line.
      if (baselineSourceRef.current !== null && baselineSourceRef.current !== source) {
        baselineRef.current = null;
        samplesRef.current = [];
        if (duckingRef.current) {
          duckingRef.current = false;
          engine.setDucking(false);
        }
      }

      // The countdown doubles as calibration: somebody holding still, which is
      // exactly the measurement the baseline needs.
      if (baselineRef.current === null) {
        const samples = samplesRef.current;
        samples.push(y);
        if (samples.length >= BASELINE_SAMPLES) {
          // Median, not mean — one frame of a mis-fitted pose would drag a mean
          // far enough to make every jump register or none of them.
          const sorted = [...samples].sort((a, b) => a - b);
          baselineRef.current = sorted[Math.floor(sorted.length / 2)] ?? y;
          baselineSourceRef.current = source;
        }
        control.current = { level: null, calibrating: true };
        return;
      }

      const base = baselineRef.current;
      const { rise, drop } = THRESHOLDS[source];
      // Signed, in threshold units, so the meter's lines sit at exactly ±1
      // whichever input is steering.
      const delta = y - base;
      control.current = {
        level: delta < 0 ? delta / rise : delta / drop,
        calibrating: false,
      };

      if (phase !== 'playing') return;
      const now = performance.now();

      // Screen y grows downward, so RAISING the controller makes it SMALLER.
      if (y < base - rise && now > jumpUntilRef.current) {
        jumpUntilRef.current = now + JUMP_LOCKOUT_MS;
        engine.jump();
        sfx.tap();
        if (tutorialRef.current === 'jump') goTo('jump-ok');
      }

      const ducking = y > base + drop;
      if (ducking !== duckingRef.current) {
        duckingRef.current = ducking;
        engine.setDucking(ducking);
        duckSinceRef.current = ducking ? now : 0;
      }
      if (
        tutorialRef.current === 'duck' &&
        ducking &&
        duckSinceRef.current > 0 &&
        now - duckSinceRef.current >= DUCK_HOLD_MS
      ) {
        goTo('duck-ok');
      }
    }, 50);

    return () => clearInterval(id);
  }, [phase, controlY, goTo]);

  // Stop the world the moment the run is over, so a finished game is not still
  // burning frames behind its own result card.
  useEffect(() => {
    if (phase !== 'result' || doneRef.current) return;
    doneRef.current = true;
    engineRef.current?.setPaused(true);
  }, [phase]);

  return {
    phase,
    score,
    best,
    stalled,
    finalScore,
    canvasRef,
    tutorial,
    control,
    ready,
    begin,
    restart,
  };
}
