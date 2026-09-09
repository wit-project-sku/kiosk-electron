/**
 * 조랑말 달리기 — the bridge between a body and the runner.
 *
 * The engine ({@link createRunEngine}) owns the game entirely: its own canvas,
 * its own fixed-step loop, its own score. This hook does two things and nothing
 * else — it drives the shared MotionPhase lifecycle, and it turns the tracked
 * body into JUMP and DUCK.
 *
 * ══ HOW A JUMP IS RECOGNISED ══════════════════════════════════════════
 * From the SHOULDER LINE, and relative to a baseline measured on this specific
 * visitor a moment earlier.
 *
 * An absolute threshold cannot work here: where someone's shoulders sit in the
 * frame depends on their height and how far back they stood, so a line that
 * catches a child's jump is one an adult crosses by standing still. The
 * countdown is the calibration — three seconds of somebody standing normally,
 * which is exactly what the baseline needs — and everything after is measured
 * as a fraction of the frame away from where THEY were.
 *
 * ── Why shoulders and not hips or feet ────────────────────────────────
 * The camera crops a standing visitor at roughly the hip (see poseTypes), so
 * feet are not available at all and hips are the first thing to leave frame
 * when someone crouches. Shoulders survive both a jump and a crouch, which are
 * precisely the two moves this game needs to tell apart.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../../gameSound';
import { LM, type MotionPhase, type PlayerTrackingState } from '../poseTypes';
import { createRunEngine, type RunEngineHandle } from './runEngine';

/**
 * How far the shoulders must rise above the baseline to count as a jump, as a
 * fraction of frame height.
 *
 * A real jump moves them far more than this; the margin exists so that shifting
 * weight, breathing, or the tracker's own jitter never fires one. Asymmetric
 * with the crouch below on purpose — going up is a deliberate, fast movement
 * and going down is a slow one, so the crouch needs more travel to be sure.
 */
const JUMP_RISE = 0.055;
const DUCK_DROP = 0.085;

/**
 * Once a jump fires, ignore the shoulders for this long.
 *
 * The airborne body keeps satisfying the jump condition all the way up, so
 * without this a single hop would fire on every frame of the ascent. The engine
 * ignores a jump while airborne anyway; this stops the sound and the intent
 * being spammed alongside it.
 */
const JUMP_LOCKOUT_MS = 550;

/** Frames of standing used to fix the baseline before a run. */
const BASELINE_SAMPLES = 20;

export interface JejuRunApi {
  phase: MotionPhase;
  score: number;
  best: number;
  /** True while the player is out of view and the world is frozen. */
  stalled: boolean;
  finalScore: number | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RunEngineHandle | null>(null);
  /** Shoulder height this visitor stands at, 0..1 of frame. */
  const baselineRef = useRef<number | null>(null);
  const samplesRef = useRef<number[]>([]);
  const jumpUntilRef = useRef(0);
  const duckingRef = useRef(false);
  const stalledRef = useRef(false);
  const doneRef = useRef(false);

  /** Shoulder-line height right now, or null when it cannot be seen. */
  const shoulderY = useCallback((): number | null => {
    const marks = player.current?.landmarks;
    if (!marks) return null;
    const l = marks[LM.LEFT_SHOULDER];
    const r = marks[LM.RIGHT_SHOULDER];
    if (!l || !r || l.visibility < 0.45 || r.visibility < 0.45) return null;
    return (l.y + r.y) / 2;
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
    samplesRef.current = [];
    doneRef.current = false;
    setFinalScore(null);
    setScore(0);
    setPhase('countdown');
  }, []);

  const begin = useCallback(() => {
    engineRef.current?.start();
    setPhase('playing');
  }, []);

  const restart = useCallback(() => {
    baselineRef.current = null;
    samplesRef.current = [];
    doneRef.current = false;
    setFinalScore(null);
    setScore(0);
    setPhase('calibrating');
  }, []);

  // ── Body → controls ───────────────────────────────────────────────────
  // A plain interval rather than an animation frame: the tracker only produces
  // a new pose 20 times a second, so reading it at 60fps would be two thirds
  // wasted work sampling a value that has not changed.
  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'playing') return;
    const engine = engineRef.current;
    if (!engine) return;

    const id = setInterval(() => {
      const y = shoulderY();

      // Out of view: freeze rather than kill. Walking away must never be scored
      // as a crash — the engine keeps the run alive and the world stops.
      const lost = y === null || !player.current?.detected;
      if (lost !== stalledRef.current) {
        stalledRef.current = lost;
        setStalled(lost);
        engine.setPaused(lost);
      }
      if (lost || y === null) return;

      // The countdown doubles as calibration: somebody standing still, which is
      // exactly the measurement the baseline needs.
      if (baselineRef.current === null) {
        const samples = samplesRef.current;
        samples.push(y);
        if (samples.length >= BASELINE_SAMPLES) {
          // Median, not mean — one frame of a mis-fitted pose would drag a mean
          // far enough to make every jump register or none of them.
          const sorted = [...samples].sort((a, b) => a - b);
          baselineRef.current = sorted[Math.floor(sorted.length / 2)] ?? y;
        }
        return;
      }

      if (phase !== 'playing') return;
      const base = baselineRef.current;
      const now = performance.now();

      // Screen y grows downward, so a JUMP makes the value SMALLER.
      if (y < base - JUMP_RISE && now > jumpUntilRef.current) {
        jumpUntilRef.current = now + JUMP_LOCKOUT_MS;
        engine.jump();
        sfx.tap();
      }

      const ducking = y > base + DUCK_DROP;
      if (ducking !== duckingRef.current) {
        duckingRef.current = ducking;
        engine.setDucking(ducking);
      }
    }, 50);

    return () => clearInterval(id);
  }, [phase, shoulderY, player]);

  // Stop the world the moment the run is over, so a finished game is not still
  // burning frames behind its own result card.
  useEffect(() => {
    if (phase !== 'result' || doneRef.current) return;
    doneRef.current = true;
    engineRef.current?.setPaused(true);
  }, [phase]);

  return { phase, score, best, stalled, finalScore, canvasRef, ready, begin, restart };
}
