/**
 * 제주 포즈 챌린지 — the engine.
 *
 * Five rounds, each: show the target → 3·2·1 → hold → grade. Roughly seven
 * seconds a round, ~35 for the run, which sits comfortably inside the AI photo
 * wait it is played during.
 *
 * ── The score is the BEST moment, not the last one ────────────────────
 * During the hold window the pose is scored every frame and only the PEAK is
 * kept. That is the difference between a game and an exam: a visitor gets into
 * the shape, holds it for a beat, then relaxes as they glance at the screen to
 * see how they did — and grading the final frame would grade them relaxing.
 * Peak-hold rewards the moment they actually made the pose, which is the moment
 * they were trying to be graded on.
 *
 * ── Coverage gates the score ──────────────────────────────────────────
 * `scorePose` reports how much of the pose it could actually SEE. A visitor
 * standing too far to one side, or with an arm out of frame, produces a
 * confident score computed from two limbs — which would be a lie. Below
 * {@link MIN_COVERAGE} the frame is discarded rather than scored, so a bad
 * camera position shows up as "hold still" rather than as a bad grade.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../../gameSound';
import { useGameLoop } from '../../useGameLoop';
import { scorePose } from '../poseMath';
import type { MotionPhase, PlayerTrackingState } from '../poseTypes';
import { POSES, gradeOf, type JejuPose, type PoseGrade } from './poses';

/** How long the target pose is shown before the countdown starts. */
const SHOW_MS = 2200;
/** The hold window, during which the peak score is taken. */
const HOLD_MS = 2800;
/** How long the grade stays on screen before the next round. */
const FEEDBACK_MS = 2000;

/** Below this fraction of the pose visible, a frame is not scored at all. */
const MIN_COVERAGE = 0.45;

/** JEJU POINTS for a flawless run — matches the other games' ceiling. */
const MAX_POINTS = 500;

/** The inner machine, on top of the shared MotionPhase. */
export type PoseStage = 'show' | 'countdown' | 'hold' | 'feedback';

export interface PoseChallengeApi {
  phase: MotionPhase;
  stage: PoseStage;
  /** 0-based. */
  round: number;
  pose: JejuPose;
  /** Peak score for the round just graded, 0..1. */
  lastScore: number;
  lastGrade: PoseGrade;
  /** Per-round peaks, for the result card. */
  history: number[];
  /** 0..1 average across every round played. */
  average: number;
  /** Live meter — a REF, written every frame, read by the bar imperatively. */
  liveScore: React.RefObject<number>;
  /** True while too little of the pose is visible to score honestly. */
  lowCoverage: boolean;
  /** 3 → 2 → 1 during the per-round countdown; 0 otherwise. */
  count: number;
  /** The run's total, set once when it ends. Banked by Monitor 1. */
  finalScore: number | null;
  ready: () => void;
  begin: () => void;
  restart: () => void;
}

export function usePoseChallenge(player: React.RefObject<PlayerTrackingState>): PoseChallengeApi {
  const [phase, setPhase] = useState<MotionPhase>('calibrating');
  const [stage, setStage] = useState<PoseStage>('show');
  const [round, setRound] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [lastScore, setLastScore] = useState(0);
  const [lowCoverage, setLowCoverage] = useState(false);
  const [count, setCount] = useState(0);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  /** Written ~60×/s by the frame loop; the meter reads it imperatively. */
  const liveScoreRef = useRef(0);
  /** Peak seen so far in the current hold window. */
  const peakRef = useRef(0);
  const doneRef = useRef(false);
  const historyRef = useRef<number[]>([]);

  const pose = POSES[Math.min(round, POSES.length - 1)] as JejuPose;

  const reset = useCallback(() => {
    historyRef.current = [];
    peakRef.current = 0;
    liveScoreRef.current = 0;
    doneRef.current = false;
    setHistory([]);
    setRound(0);
    setStage('show');
    setLastScore(0);
    setLowCoverage(false);
    setFinalScore(null);
  }, []);

  const ready = useCallback(() => {
    reset();
    setPhase('countdown');
  }, [reset]);

  const begin = useCallback(() => {
    setStage('show');
    setPhase('playing');
  }, []);

  const restart = useCallback(() => {
    reset();
    setPhase('calibrating');
  }, [reset]);

  // ── The round machine ─────────────────────────────────────────────────
  // Each stage is one timer, cleared by its own effect. Nothing here can
  // outlive the component, and a visitor who exits mid-round leaves nothing
  // scheduled behind them.
  useEffect(() => {
    if (phase !== 'playing') return;

    if (stage === 'show') {
      const id = setTimeout(() => setStage('countdown'), SHOW_MS);
      return () => clearTimeout(id);
    }

    if (stage === 'countdown') {
      // Three ticks, then the hold. Driven here rather than by GameCountdown
      // because the target pose has to stay on screen throughout — the visitor
      // is getting INTO it while the numbers run.
      let n = 3;
      setCount(n);
      sfx.countdown(false);
      const id = setInterval(() => {
        n -= 1;
        if (n > 0) {
          setCount(n);
          sfx.countdown(false);
          return;
        }
        clearInterval(id);
        setCount(0);
        sfx.countdown(true);
        peakRef.current = 0;
        liveScoreRef.current = 0;
        setStage('hold');
      }, 800);
      return () => clearInterval(id);
    }

    if (stage === 'hold') {
      const id = setTimeout(() => {
        const peak = peakRef.current;
        historyRef.current = [...historyRef.current, peak];
        setHistory(historyRef.current);
        setLastScore(peak);
        if (peak >= 0.85) sfx.win();
        else sfx.tap();
        setStage('feedback');
      }, HOLD_MS);
      return () => clearTimeout(id);
    }

    // feedback
    const id = setTimeout(() => {
      if (round + 1 >= POSES.length) {
        setPhase('result');
        return;
      }
      setRound((r) => r + 1);
      setStage('show');
    }, FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [phase, stage, round]);

  // ── Scoring, every frame of the hold window ───────────────────────────
  useGameLoop(
    useCallback(() => {
      const landmarks = player.current.landmarks;
      if (!landmarks) {
        liveScoreRef.current = 0;
        return;
      }
      const { score, coverage } = scorePose(landmarks, pose.limbs);
      if (coverage < MIN_COVERAGE) {
        // Not enough of the pose in frame to say anything honest about it.
        setLowCoverage(true);
        return;
      }
      setLowCoverage(false);
      liveScoreRef.current = score;
      if (score > peakRef.current) peakRef.current = score;
    }, [player, pose]),
    phase === 'playing' && stage === 'hold',
  );

  // The run's total, published once. Monitor 1 banks it into JEJU POINTS off
  // the broadcast — this screen has no store of its own.
  useEffect(() => {
    if (phase !== 'result' || doneRef.current) return;
    doneRef.current = true;
    const scores = historyRef.current;
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    sfx.finish();
    setFinalScore(Math.round(avg * MAX_POINTS));
  }, [phase]);

  const average = history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0;

  return {
    phase,
    stage,
    round,
    pose,
    lastScore,
    lastGrade: gradeOf(lastScore),
    history,
    average,
    liveScore: liveScoreRef,
    lowCoverage,
    count,
    finalScore,
    ready,
    begin,
    restart,
  };
}
