/**
 * 조랑말 달리기 — the screen.
 *
 * The runner ported from the `test` branch, wearing this repo's motion chrome:
 * the same calibration gate, countdown, coaching banner and camera handling as
 * 몸으로 감귤 받기, so the two camera games behave identically from the visitor's
 * side even though their engines have nothing in common.
 *
 * The engine draws its own full-board canvas, so this file has no field art of
 * its own — see runEngine.
 */
import { useEffect, useState } from 'react';
import { pick, useLang } from '@renderer/lib/i18n';
import type { MotionGameProps } from '../../gameTypes';
import { GameHud } from '../../components/GameHud';
import { GameResult } from '../../components/GameResult';
import { MOTION } from '../motionText';
import { useMotionTracking } from '../useMotionTracking';
import { MotionStage } from '../components/MotionStage';
import { GAME_H, GAME_W } from './runEngine';
import { useJejuRun } from './useJejuRun';
import styles from './JejuRun.module.css';

/** How long the "jump and crouch" reminder stays up once play begins. */
const HINT_MS = 7000;

export function JejuRun(_props: MotionGameProps): JSX.Element {
  const lang = useLang();
  const tracking = useMotionTracking({ enabled: true });
  const game = useJejuRun(tracking.player);

  const [showHint, setShowHint] = useState(true);
  useEffect(() => {
    if (game.phase !== 'playing') return;
    setShowHint(true);
    const id = setTimeout(() => setShowHint(false), HINT_MS);
    return () => clearTimeout(id);
  }, [game.phase]);

  return (
    <MotionStage
      title={pick(MOTION.runName, lang)}
      subtitle={pick(MOTION.runDesc, lang)}
      tracking={tracking}
      phase={game.phase}
      score={game.score}
      finalScore={game.finalScore}
      onReady={game.ready}
      onCountdownDone={game.begin}
      countdownHint={pick(MOTION.runHowTo, lang)}
      hud={
        <GameHud
          top={430}
          score={game.score}
          middle={
            <>
              <span style={{ fontSize: 40, fontWeight: 700, color: '#a49dae' }}>BEST</span>
              <span style={{ fontSize: 86, fontWeight: 800, color: '#fff' }}>{game.best}</span>
            </>
          }
        />
      }
      result={
        game.phase === 'result' ? (
          <GameResult
            hideActions
            emoji="🐴"
            title={pick(MOTION.runResult, lang)}
            score={game.score}
            note={`${pick(MOTION.runBest, lang)} ${game.best}`}
            celebrate={game.score >= 300}
          />
        ) : null
      }
    >
      <div className={styles.field}>
        {/* The engine owns this canvas outright — it sets the backing store to
            its own GAME_W/GAME_H and draws every pixel, sky included. */}
        <canvas ref={game.canvasRef} className={styles.canvas} width={GAME_W} height={GAME_H} />

        {game.phase === 'playing' && showHint && !game.stalled && (
          <div className={styles.hint}>
            <span>⬆️ {pick(MOTION.runJump, lang)}</span>
            <span>⬇️ {pick(MOTION.runDuck, lang)}</span>
          </div>
        )}
      </div>
    </MotionStage>
  );
}
