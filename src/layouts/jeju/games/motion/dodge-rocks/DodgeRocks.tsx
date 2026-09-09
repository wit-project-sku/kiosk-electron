/**
 * 화산석 피하기 — the screen.
 *
 * The only motion game with a fail state, which is why the lives sit over the
 * field rather than up in the HUD: at a glance the player needs them next to
 * the rocks, not beside the score.
 */
import { useEffect, useState } from 'react';
import { pick, useLang } from '@renderer/lib/i18n';
import type { MotionGameProps } from '../../gameTypes';
import { GameHud } from '../../components/GameHud';
import { GameResult } from '../../components/GameResult';
import { MOTION } from '../motionText';
import { useMotionTracking } from '../useMotionTracking';
import { MotionStage } from '../components/MotionStage';
import { FIELD_H, FIELD_W } from './rocksRender';
import { MAX_LIVES, useDodgeRocks } from './useDodgeRocks';
import styles from './DodgeRocks.module.css';

const HINT_MS = 6000;

export function DodgeRocks(_props: MotionGameProps): JSX.Element {
  const lang = useLang();

  const tracking = useMotionTracking({ enabled: true });
  const game = useDodgeRocks(tracking.player);

  const [showHint, setShowHint] = useState(true);
  useEffect(() => {
    if (game.phase !== 'playing') return;
    setShowHint(true);
    const id = setTimeout(() => setShowHint(false), HINT_MS);
    return () => clearTimeout(id);
  }, [game.phase]);

  return (
    <MotionStage
      title={pick(MOTION.dodgeName, lang)}
      subtitle={pick(MOTION.dodgeDesc, lang)}
      tracking={tracking}
      phase={game.phase}
      score={game.score}
      finalScore={game.finalScore}
      onReady={game.ready}
      onCountdownDone={game.begin}
      countdownHint={pick(MOTION.moveLeftRight, lang)}
      hud={
        <GameHud
          top={430}
          score={game.score}
          middle={
            <>
              <span style={{ fontSize: 40, fontWeight: 700, color: '#a49dae' }}>LEVEL</span>
              <span style={{ fontSize: 86, fontWeight: 800, color: '#fff' }}>{game.level}</span>
            </>
          }
        />
      }
      result={
        game.phase === 'result' ? (
          <GameResult
            hideActions
            emoji="🌋"
            title={pick(MOTION.dodgeResult, lang)}
            score={game.score}
            note={`${game.dodged}${pick(MOTION.dodgeCount, lang)}`}
            // A long run is worth celebrating even though the run ENDED in a
            // loss — this game always ends in a loss, so tying the confetti to
            // survival would mean it never fires.
            celebrate={game.dodged >= 25}
          />
        ) : null
      }
    >
      <div className={styles.field}>
        <div className={styles.sky} />
        <span className={styles.haze} />
        <span className={`${styles.haze} ${styles.hazeB}`} />
        <div className={styles.mountain} />
        <div className={styles.foothills} />

        <canvas ref={game.canvasRef} className={styles.canvas} width={FIELD_W} height={FIELD_H} />

        {game.phase === 'playing' && (
          <div className={styles.lives} aria-label={`lives ${game.lives}`}>
            {Array.from({ length: MAX_LIVES }, (_, i) => (
              // Keyed by index AND by whether it is still held, so the heart
              // that was just lost re-mounts and plays its beat.
              <span
                key={`${i}-${i < game.lives}`}
                className={i >= game.lives ? styles.lifeLost : ''}
              >
                {i < game.lives ? '❤️' : '🖤'}
              </span>
            ))}
          </div>
        )}

        {/* Keyed on the remaining lives so a hit replays the vignette. */}
        {game.phase === 'playing' && game.lives < MAX_LIVES && (
          <span key={game.lives} className={styles.impact} />
        )}

        {game.phase === 'playing' && showHint && !game.stalled && (
          <p className={styles.hint}>← {pick(MOTION.moveLeftRight, lang)} →</p>
        )}
      </div>
    </MotionStage>
  );
}
