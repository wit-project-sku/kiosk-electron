/**
 * 몸으로 감귤 받기 — the screen.
 *
 * Everything camera-shaped (the gate, the preview, the countdown, the coaching
 * banner) belongs to {@link MotionStage}; everything game-shaped belongs to
 * {@link useBodyCatch}. What is left here is the field and the score card,
 * which is the whole point of splitting them.
 *
 * The lifecycle is the one all three motion games share:
 *
 *   calibrating → countdown → playing → result
 *
 * and it starts on a PERSON, not a tap.
 */
import { useEffect, useState } from 'react';
import { pick, useLang } from '@renderer/lib/i18n';
import type { MotionGameProps } from '../../gameTypes';
import { GameHud } from '../../components/GameHud';
import { GameResult } from '../../components/GameResult';
import { MOTION } from '../motionText';
import { useMotionTracking } from '../useMotionTracking';
import { MotionStage } from '../components/MotionStage';
// FIELD_* comes from the ENGINE, never from catchRender.
//
// It used to come from catchRender, which is the TOUCH game's field (1900×2060),
// while this game's physics run at 1980×3120. The canvas backing store was
// therefore 1060px shorter than the world drawn into it, so the basket — which
// sits at y=2700 — was clipped off the bottom and simply never appeared, and
// fruit vanished near the bottom edge while still scoring, because collisions
// are computed in world space and do not care how big the canvas is.
import { FIELD_H, FIELD_W, useBodyCatch } from './useBodyCatch';
import styles from './BodyCatch.module.css';

/** How long the "move left and right" reminder stays up once play begins. */
const HINT_MS = 6000;

/** Score at which the run earns the 감귤 마스터 badge and the confetti. */
const MASTER_SCORE = 300;

export function BodyCatch(_props: MotionGameProps): JSX.Element {
  const lang = useLang();

  // The camera runs only while this screen is mounted; leaving stops inference
  // and releases the device (see the cleanup in useMotionTracking).
  const tracking = useMotionTracking({ enabled: true });
  const game = useBodyCatch(tracking.player);

  const [showHint, setShowHint] = useState(true);
  useEffect(() => {
    if (game.phase !== 'playing') return;
    setShowHint(true);
    const id = setTimeout(() => setShowHint(false), HINT_MS);
    return () => clearTimeout(id);
  }, [game.phase]);

  // A fresh run needs a fresh lock: the previous player may have walked off and
  // the smoothing still holds their last position.

  return (
    <MotionStage
      title={pick(MOTION.catchName, lang)}
      subtitle={pick(MOTION.catchDesc, lang)}
      tracking={tracking}
      phase={game.phase}
      score={game.score}
      finalScore={game.finalScore}
      onReady={game.ready}
      onCountdownDone={game.begin}
      countdownHint={pick(MOTION.moveLeftRight, lang)}
      hud={<GameHud top={430} score={game.score} secondsLeft={game.secondsLeft} />}
      result={
        game.phase === 'result' ? (
          <GameResult
            hideActions
            emoji="🍊"
            title={pick(MOTION.catchResult, lang)}
            score={game.score}
            note={`${game.caught}${pick(MOTION.catchCount, lang)}`}
            extra={
              game.score >= MASTER_SCORE ? (
                <p className={styles.badge}>⭐ {pick(MOTION.tangerineMaster, lang)}</p>
              ) : undefined
            }
            celebrate={game.score >= MASTER_SCORE}
          />
        ) : null
      }
    >
      <div className={styles.field}>
        <div className={styles.sky} />
        <div className={styles.hills} />
        <div className={styles.hillsFront} />

        {/* Backing store in artboard px: the artboard's CSS transform scales it
            DOWN on the real panel, so the canvas is never upscaled. */}
        <canvas ref={game.canvasRef} className={styles.canvas} width={FIELD_W} height={FIELD_H} />

        {game.phase === 'playing' && showHint && !game.stalled && (
          <p className={styles.hint}>← {pick(MOTION.moveLeftRight, lang)} →</p>
        )}
      </div>
    </MotionStage>
  );
}
