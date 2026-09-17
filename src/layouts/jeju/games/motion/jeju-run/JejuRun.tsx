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
 * The controls are three hand SHAPES — ✋ run, ✌️ jump, ✊ duck (see
 * runControl). Jumping used to be "raise your hand", which visitors found very
 * hard because a movement has no obvious "how far". Three things teach them:
 *
 *   1. The COUNTDOWN asks for an open hand toward the camera — the resting shape.
 *   2. A PRACTICE RUN on an empty track asks for each shape in turn, demonstrates
 *      it with an animated hand, and waits until they have actually made it and
 *      watched her respond (RunTutorialCard, driven by useJejuRun).
 *   3. A SHAPE METER lights the shape the camera is reading for the whole game,
 *      so a sign that is not being recognised is visible at once (ControlMeter).
 */
import { pick, useLang } from '@renderer/lib/i18n';
import type { MotionGameProps } from '../../gameTypes';
import { GameResult } from '../../components/GameResult';
import { TEXT } from '../../gameText';
import { MOTION } from '../motionText';
import { useMotionTracking } from '../useMotionTracking';
import { MotionStage } from '../components/MotionStage';
import { ControlMeter } from './ControlMeter';
import { RunTutorialCard } from './RunTutorialCard';
import { GAME_H, GAME_W } from './runEngine';
import { useJejuRun } from './useJejuRun';
import styles from './JejuRun.module.css';

export function JejuRun({ photoReady = false }: MotionGameProps): JSX.Element {
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
      best={game.best}
      notice={photoReady ? pick(TEXT.photoReadyOnTouch, lang) : null}
      countdownHint={pick(MOTION.runHoldStill, lang)}
      result={
        game.phase === 'result' ? (
          <GameResult
            hideActions
            title={pick(MOTION.runResult, lang)}
            score={game.score}
            note={`${pick(MOTION.runBest, lang)} ${game.best}`}
            // A new best, not an arbitrary threshold: the tag has to mean
            // something to the visitor reading it.
            celebrate={game.score > 0 && game.score >= game.best}
            celebrateLabel={pick(MOTION.runBest, lang)}
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
