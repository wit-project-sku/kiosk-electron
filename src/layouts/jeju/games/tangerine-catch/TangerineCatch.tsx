/**
 * 감귤 받기 — the screen. All gameplay lives in {@link useTangerineCatch};
 * this file is the frame around it, and deliberately holds no game state.
 */
import { useCallback, useRef, useState } from 'react';
import { pick, useLang } from '@renderer/lib/i18n';
import type { HostedGameProps } from '../gameTypes';
import { TEXT } from '../gameText';
import { GameShell } from '../components/GameShell';
import { GameHud } from '../components/GameHud';
import { GameCountdown } from '../components/GameCountdown';
import { GameResult } from '../components/GameResult';
import { FIELD_H, FIELD_W } from './catchRender';
import { useTangerineCatch } from './useTangerineCatch';
import styles from './TangerineCatch.module.css';

export function TangerineCatch({
  onExit,
  onAward,
  aiReady,
  onSeePhoto,
}: HostedGameProps): JSX.Element {
  const lang = useLang();
  /** Drops the "drag the basket" nudge the moment the visitor has understood. */
  const [touched, setTouched] = useState(false);

  // The engine calls this exactly once per run; the host's `onAward` keeps only
  // the visitor's BEST run, so replaying cannot inflate the session total.
  // Wrapped in a ref-free useCallback because the engine holds it in a dep list.
  const handleDone = useCallback((score: number) => onAward(score), [onAward]);

  const game = useTangerineCatch(handleDone);
  const fieldRef = useRef<HTMLDivElement>(null);

  const handlePointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!touched) setTouched(true);
      game.onPointer(event);
    },
    [game, touched],
  );

  return (
    <GameShell
      headerTitle="AR 한복체험"
      title={pick(TEXT.catchName, lang)}
      subtitle={pick(TEXT.catchHowTo, lang)}
      onHome={onExit}
      chrome={<GameHud top={920} score={game.score} secondsLeft={game.secondsLeft} />}
      overlay={
        <>
          {game.phase === 'countdown' && (
            <GameCountdown onDone={game.begin} hint={pick(TEXT.catchHowTo, lang)} />
          )}
          {game.phase === 'result' && (
            <GameResult
              emoji="🍊"
              title={pick(TEXT.catchResultTitle, lang)}
              score={game.score}
              note={`${game.caught}${pick(TEXT.catchCount, lang)}`}
              onPlayAgain={game.restart}
              onBackToGames={onExit}
              onSeePhoto={onSeePhoto}
              aiReady={aiReady}
              // A golden run deserves the confetti; a quiet one gets a calm card
              // rather than a celebration it did not earn.
              celebrate={game.score >= 150}
            />
          )}
        </>
      }
    >
      <div
        ref={fieldRef}
        className={styles.field}
        // Down AND move: a tap anywhere jumps the basket there, which is how
        // children and older visitors actually play this — dragging is the
        // refinement, not the requirement.
        onPointerDown={handlePointer}
        onPointerMove={handlePointer}
        // Without capture, sliding a finger off the field mid-drag delivers the
        // remaining moves to whatever is under it and the basket sticks.
        onPointerDownCapture={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className={styles.sky} />
        <div className={styles.hills} />
        <div className={styles.hillsFront} />
        <div className={styles.wall} />

        {/* Backing store in artboard px: the artboard's CSS transform then
            scales it DOWN on the real panel, so the canvas is never upscaled
            and the tangerines stay crisp at any kiosk resolution. */}
        <canvas ref={game.canvasRef} className={styles.canvas} width={FIELD_W} height={FIELD_H} />

        {game.phase === 'playing' && !touched && (
          <p className={styles.dragHint}>👆 {pick(TEXT.catchHowTo, lang)}</p>
        )}
      </div>
    </GameShell>
  );
}
