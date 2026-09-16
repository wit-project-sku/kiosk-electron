/**
 * 제주 달리기 — the screen.
 *
 * The runner ported from the `test` branch, wearing this repo's motion chrome:
 * the same calibration gate, countdown, coaching banner and camera handling as
 * 손으로 감귤 받기, so the two camera games behave identically from the visitor's
 * side even though their engines have nothing in common.
 *
 * The engine draws its own full-board canvas, so this file has no field art of
 * its own — see runEngine.
 *
 * ══ HOW THE GAME EXPLAINS ITSELF ══════════════════════════════════════
 * Visitors could not work out how to play. There was a line of text — "hand up
 * to jump, hand down to duck" — and it did not help, because the controls are
 * RELATIVE and a sentence cannot say "up from where" or "how far". So the
 * explanation is now three things that work together:
 *
 *   1. The COUNTDOWN asks them to hold their hand still in front of them. That
 *      is when the baseline everything is measured from is taken, so it is the
 *      one instruction that has to land before anything else.
 *   2. A PRACTICE RUN on an empty track asks for each move in turn, demonstrates
 *      it with an animated hand, and waits until they have actually done it and
 *      watched her respond (RunTutorialCard, driven by useJejuRun).
 *   3. A HAND METER shows their hand against the jump and duck lines for the
 *      whole game, which answers "how far?" in a way no sentence can
 *      (ControlMeter).
 */
import { pick, useLang } from '@renderer/lib/i18n';
import type { MotionGameProps } from '../../gameTypes';
import { GameHud } from '../../components/GameHud';
import { GameResult } from '../../components/GameResult';
import { MOTION } from '../motionText';
import { useMotionTracking } from '../useMotionTracking';
import { MotionStage } from '../components/MotionStage';
import { ControlMeter } from './ControlMeter';
import { RunTutorialCard } from './RunTutorialCard';
import { GAME_H, GAME_W } from './runEngine';
import { useJejuRun } from './useJejuRun';
import styles from './JejuRun.module.css';

export function JejuRun(_props: MotionGameProps): JSX.Element {
  const lang = useLang();
  const tracking = useMotionTracking({ enabled: true });
  const game = useJejuRun(tracking.player);

  const practising = game.phase === 'playing' && game.tutorial !== 'done';
  const emphasis = game.tutorial === 'jump' ? 'jump' : game.tutorial === 'duck' ? 'duck' : null;

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
      countdownHint={`✋ ${pick(MOTION.runHoldStill, lang)}`}
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
            emoji="🏃‍♀️"
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

        {/* For the whole game, not only the practice: a visitor who stops
            jumping high enough three obstacles in needs it as much as a
            beginner does. */}
        {game.phase === 'playing' && (
          <ControlMeter control={game.control} emphasis={practising ? emphasis : null} />
        )}

        {/* Hidden while the hand is out of view: the coaching banner is already
            asking for it back, and two instructions at once is none. */}
        {practising && !game.stalled && <RunTutorialCard step={game.tutorial} />}
      </div>
    </MotionStage>
  );
}
