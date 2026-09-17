/**
 * 제주 달리기 — the bridge between a raised hand and the runner.
 *
 * The engine ({@link createRunEngine}) owns the game entirely: its own canvas,
 * its own fixed-step loop, its own score. This hook drives the shared
 * MotionPhase lifecycle and the practice run, and hands the tracked controller
 * to {@link RunControlDetector}, which turns it into JUMP and DUCK.
 *
 * ── Where the detection rules live ────────────────────────────────────
 * Not here. They were — a fixed pair of lines against a baseline taken from
 * the first second of the countdown — and they lost accuracy in half a dozen
 * ways that only showed up with distance, a tired arm, a hand still settling,
 * or a hand leaving the frame. They now live in `runControl.ts`, which is pure
 * so every rule can be measured against simulated hands; its header lists what
 * each rule fixes. This file only feeds it and acts on what it says.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../../gameSound';
import type { MotionPhase, PlayerTrackingState } from '../poseTypes';
import { RunControl as RunControlDetector } from './runControl';
import { createRunEngine, type RunEngineHandle } from './runEngine';

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
  /** She is ducking — for a hand, the fist is held. Lights the meter's fist badge. */
  ducking: boolean;
  /**
   * A hand is steering (or nothing is). False only for the body fallback, whose
   * duck is still a downward line and whose meter shows it.
   */
  byHand: boolean;
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
  const control = useRef<RunControl>({
    level: null,
    calibrating: true,
    ducking: false,
    byHand: true,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RunEngineHandle | null>(null);
  /** One detector per screen; reset for every countdown. */
  const detectorRef = useRef(new RunControlDetector());
  const duckingRef = useRef(false);
  const stalledRef = useRef(false);
  const doneRef = useRef(false);

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
    // A new countdown is a new calibration: the visitor may have stepped closer,
    // swapped hands, or be somebody else entirely.
    detectorRef.current.reset();
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
    detectorRef.current.reset();
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
    const detector = detectorRef.current;

    const id = setInterval(() => {
      const now = performance.now();
      const state = player.current;
      const sample =
        state?.detected && state.source !== null
          ? {
              // The tracker's own timestamp, not `now`: the detector measures
              // SPEED, and a reading held through a dropped frame must not look
              // like a hand that stopped dead.
              t: state.lastSeenAt,
              y: state.centerY,
              scale: state.scale,
              source: state.source,
              gesture: state.gesture,
            }
          : null;

      const out = detector.update(sample, now, phase === 'playing');
      control.current = {
        level: out.level,
        calibrating: !out.calibrated,
        ducking: out.ducking,
        byHand: state?.source !== 'body',
      };

      // Out of view: freeze rather than kill. Walking away must never be scored
      // as a crash. NOT stalled while the detector is holding a duck for a hand
      // that left through the bottom of the frame — pausing there was the game
      // refusing the very move the visitor had just made.
      if (out.stalled !== stalledRef.current) {
        stalledRef.current = out.stalled;
        setStalled(out.stalled);
        engine.setPaused(out.stalled);
      }

      if (phase !== 'playing') return;

      if (out.jump) {
        engine.jump();
        sfx.tap();
        if (tutorialRef.current === 'jump') goTo('jump-ok');
      }

      if (out.ducking !== duckingRef.current) {
        duckingRef.current = out.ducking;
        engine.setDucking(out.ducking);
        duckSinceRef.current = out.ducking ? now : 0;
      }
      if (
        tutorialRef.current === 'duck' &&
        out.ducking &&
        duckSinceRef.current > 0 &&
        now - duckSinceRef.current >= DUCK_HOLD_MS
      ) {
        goTo('duck-ok');
      }
    }, 50);

    return () => clearInterval(id);
  }, [phase, player, goTo]);

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
