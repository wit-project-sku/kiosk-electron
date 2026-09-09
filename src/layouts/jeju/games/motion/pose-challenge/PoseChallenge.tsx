/**
 * 제주 포즈 챌린지 — the screen.
 *
 * The target figure, the live match meter and the round grade. All scoring is
 * in {@link usePoseChallenge}; the only thing this file does that is not
 * markup is drive the meter, and it does that imperatively — see below.
 */
import { useEffect, useRef } from 'react';
import { pick, useLang } from '@renderer/lib/i18n';
import type { MotionGameProps } from '../../gameTypes';
import { GameHud } from '../../components/GameHud';
import { GameResult } from '../../components/GameResult';
import { MOTION } from '../motionText';
import { useMotionTracking } from '../useMotionTracking';
import { MotionStage } from '../components/MotionStage';
import { POSES, poseFigure, type JejuPose } from './poses';
import { usePoseChallenge } from './usePoseChallenge';
import styles from './PoseChallenge.module.css';

/**
 * The target, drawn from the pose's own limb angles.
 *
 * Mirrored to match the camera preview: the visitor compares themselves to this
 * figure, and a figure drawn from the camera's point of view would have them
 * raising the wrong arm.
 */
function PoseFigure({ pose, still }: { pose: JejuPose; still: boolean }): JSX.Element {
  const f = poseFigure(pose);
  const stroke = '#6a4fa3';
  return (
    <svg
      className={`${styles.targetFigure} ${still ? '' : styles.targetBreathing}`}
      viewBox="0 0 200 230"
      fill="none"
      aria-hidden
    >
      {/* Head */}
      <circle cx="100" cy="48" r="27" stroke={stroke} strokeWidth="9" />
      {/* Torso */}
      <path
        d={`M${f.shoulderL.x} ${f.shoulderL.y} L${f.shoulderR.x} ${f.shoulderR.y}
            M100 ${f.shoulderL.y} L100 168
            M86 168 L74 214 M114 168 L126 214`}
        stroke={stroke}
        strokeWidth="9"
        strokeLinecap="round"
      />
      {/* Arms — the part the score actually measures. Drawn heavier so the
          visitor's eye goes to the thing that matters. */}
      <path
        d={`M${f.shoulderL.x} ${f.shoulderL.y} L${f.elbowL.x} ${f.elbowL.y} L${f.wristL.x} ${f.wristL.y}`}
        stroke="#ff7f0f"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`M${f.shoulderR.x} ${f.shoulderR.y} L${f.elbowR.x} ${f.elbowR.y} L${f.wristR.x} ${f.wristR.y}`}
        stroke="#ff7f0f"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Hands, so the end of each arm is unambiguous. */}
      <circle cx={f.wristL.x} cy={f.wristL.y} r="11" fill="#ff7f0f" />
      <circle cx={f.wristR.x} cy={f.wristR.y} r="11" fill="#ff7f0f" />
    </svg>
  );
}

export function PoseChallenge(_props: MotionGameProps): JSX.Element {
  const lang = useLang();

  const tracking = useMotionTracking({ enabled: true });
  const game = usePoseChallenge(tracking.player);

  const fillRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLParagraphElement>(null);

  /**
   * The meter is written straight to the DOM, not rendered.
   *
   * It follows the visitor's body at 60fps; putting that number in React state
   * would re-render this whole screen — target figure, dots and all — sixty
   * times a second for one bar's width. Two style writes per frame instead.
   */
  useEffect(() => {
    if (game.stage !== 'hold' || game.phase !== 'playing') return;
    let raf = 0;
    let stopped = false;
    const tick = (): void => {
      if (stopped) return;
      const pct = Math.round(game.liveScore.current * 100);
      if (fillRef.current) fillRef.current.style.width = `${pct}%`;
      if (valueRef.current) valueRef.current.textContent = `${pct}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [game.stage, game.phase, game.liveScore]);

  const gradeKey =
    game.lastGrade === 'perfect'
      ? MOTION.perfect
      : game.lastGrade === 'great'
        ? MOTION.great
        : game.lastGrade === 'good'
          ? MOTION.good
          : MOTION.almost;
  const gradeClass =
    game.lastGrade === 'perfect'
      ? styles.gradePerfect
      : game.lastGrade === 'great'
        ? styles.gradeGreat
        : game.lastGrade === 'good'
          ? styles.gradeGood
          : styles.gradeAlmost;

  const avgPct = Math.round(game.average * 100);

  return (
    <MotionStage
      title={pick(MOTION.poseName, lang)}
      subtitle={pick(MOTION.copyThePose, lang)}
      tracking={tracking}
      phase={game.phase}
      // The live 'score' for this game is the running average match, which is
      // the only number that means anything to someone watching the remote.
      score={Math.round(game.average * 100)}
      finalScore={game.finalScore}
      onReady={game.ready}
      onCountdownDone={game.begin}
      countdownHint={pick(MOTION.copyThePose, lang)}
      hud={
        <GameHud
          top={430}
          score={Math.round(game.average * 100)}
          middle={
            <>
              <span style={{ fontSize: 40, fontWeight: 700, color: '#a49dae' }}>ROUND</span>
              <span style={{ fontSize: 86, fontWeight: 800, color: '#fff' }}>
                {Math.min(game.round + 1, POSES.length)} / {POSES.length}
              </span>
            </>
          }
        />
      }
      result={
        game.phase === 'result' ? (
          <GameResult
            hideActions
            emoji="🕺"
            title={pick(MOTION.poseMaster, lang)}
            score={avgPct}
            note={`% ${pick(MOTION.averageMatch, lang)}`}
            extra={
              <div className={styles.rounds}>
                {game.history.map((s, i) => (
                  <span key={i} className={`${styles.dot} ${styles.dotDone}`}>
                    {Math.round(s * 100)}
                  </span>
                ))}
              </div>
            }
            celebrate={avgPct >= 80}
          />
        ) : null
      }
    >
      <div className={styles.field}>
        {game.phase === 'playing' && (
          <>
            {/* Keyed on the round so a new pose replays its entrance. */}
            <div key={game.round} className={`${styles.target} ${styles.targetIn}`}>
              <PoseFigure pose={game.pose} still={game.stage === 'hold'} />
              <p className={styles.targetName}>
                <span aria-hidden>{game.pose.glyph}</span>
                {pick(MOTION[game.pose.nameKey], lang)}
              </p>
            </div>

            {game.stage === 'countdown' && game.count > 0 && (
              // Over the target, not instead of it: these three seconds are
              // when the visitor is getting INTO the pose, so the pose has to
              // stay on screen.
              <p key={game.count} className={styles.count}>
                {game.count}
              </p>
            )}

            {game.stage === 'hold' && (
              <div className={styles.meter}>
                <p className={styles.meterLabel}>{pick(MOTION.poseMatch, lang)}</p>
                <div className={styles.meterTrack}>
                  <div ref={fillRef} className={styles.meterFill} />
                </div>
                <p ref={valueRef} className={styles.meterValue}>
                  0%
                </p>
              </div>
            )}

            {game.stage === 'hold' && game.lowCoverage && (
              <p className={styles.coverage}>👤 {pick(MOTION.backIntoView, lang)}</p>
            )}

            {game.stage === 'feedback' && (
              // Keyed on the round so each grade animates in fresh.
              <p key={`g${game.round}`} className={`${styles.grade} ${gradeClass}`}>
                {pick(gradeKey, lang)}
                <br />
                {Math.round(game.lastScore * 100)}%
              </p>
            )}

            <div className={styles.rounds}>
              {POSES.map((_, i) => {
                const done = game.history[i];
                return (
                  <span
                    key={i}
                    className={`${styles.dot} ${
                      done !== undefined ? styles.dotDone : i === game.round ? styles.dotNow : ''
                    }`}
                  >
                    {done !== undefined ? Math.round(done * 100) : i + 1}
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>
    </MotionStage>
  );
}
