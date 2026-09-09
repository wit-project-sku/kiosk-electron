/**
 * 모션 게임 리모컨 — what Monitor 1 shows while Monitor 2 plays.
 *
 * ══ THIS SCREEN IS A REMOTE, NOT A GAME ══════════════════════════════
 * The visitor is standing two metres back facing the customer display, moving
 * their body. They are not looking at this screen and should not have to. So it
 * does three things and nothing else:
 *
 *   1. Says the game is happening on the OTHER screen — the animated ↑ is the
 *      part that actually registers from the corner of an eye.
 *   2. Mirrors the score and the coaching, so a companion standing at the kiosk
 *      can follow along and read a "step back into view" out loud.
 *   3. Keeps 그만하기 within reach. This is the only way out of a motion game:
 *      the big screen has no touch, so if this button is not here, a visitor
 *      who wants to stop has no way to say so.
 *
 * ── Banking the score ─────────────────────────────────────────────────
 * The run's total arrives as `finalScore` on the broadcast, and this is where it
 * becomes JEJU POINTS — Monitor 2 has no points store and no business having
 * one. Banked exactly once per run, keyed on runId; see the effect.
 */
import { useEffect, useRef, useState } from 'react';
import { pick, useLang } from '@renderer/lib/i18n';
import type { MotionGameId, MotionGameState } from '@shared/types/motionGame';
import { usePhotoChrome } from '../../../../photo/photoChrome';
import { TEXT } from '../../gameText';
import { GameButton } from '../../components/GameButton';
import { MOTION } from '../motionText';
import styles from './MotionRemote.module.css';

interface Props {
  state: MotionGameState;
  /** Stop the game and go back to the card menu. */
  onStop: () => void;
  /** Start the same game again — a fresh run on Monitor 2. */
  onPlayAgain: () => void;
  /** Hand the screen to the finished photo. Only offered once it exists. */
  onSeePhoto: () => void;
  aiReady: boolean;
  /** Bank the run's total into JEJU POINTS. Called at most once per run. */
  onAward: (game: MotionGameId, points: number) => void;
}

const GLYPH: Record<MotionGameId, string> = {
  'body-catch': '🙆',
  'jeju-run': '🐴',
};

export function MotionRemote({
  state,
  onStop,
  onPlayAgain,
  onSeePhoto,
  aiReady,
  onAward,
}: Props): JSX.Element {
  const lang = useLang();
  const { icon } = usePhotoChrome();
  const pageBg = icon('bg-page') || icon('bg');

  const game = state.game;
  const finished = state.phase === 'result';

  /**
   * The photo landed WHILE they were playing.
   *
   * ── Why this is an offer and not an action ────────────────────────────
   * The AI result used to take the screen the moment it arrived, killing a run
   * mid-play. That is the worst possible timing: the visitor is two metres back
   * with their arms up, and the thing they were doing vanishes without them
   * having touched anything.
   *
   * The photo is not going anywhere — the workflow holds it until this screen
   * hands over — so the right move is to TELL them and let them choose. Dismiss
   * it and the run finishes normally; the result card then offers the photo
   * again, by which point they are done and it is the obvious next thing.
   */
  const [dismissed, setDismissed] = useState(false);
  const offerPhoto = aiReady && !finished && !dismissed && state.phase === 'playing';

  /**
   * Bank the total once per run.
   *
   * Keyed on runId rather than on a boolean: `finalScore` stays set for the
   * whole result phase and arrives on several broadcasts, and a visitor
   * replaying the same game would otherwise either double-bank the first run or
   * never bank the second.
   */
  const bankedRunRef = useRef<number | null>(null);
  useEffect(() => {
    if (!game || state.finalScore === null) return;
    if (bankedRunRef.current === state.runId) return;
    bankedRunRef.current = state.runId;
    onAward(game, state.finalScore);
  }, [game, state.finalScore, state.runId, onAward]);

  const name = game === 'jeju-run' ? pick(MOTION.runName, lang) : pick(MOTION.catchName, lang);

  /**
   * Repeat whatever the big screen is coaching.
   *
   * Not redundancy: the player is facing away from this screen, and the person
   * who can read it is whoever is standing at the kiosk with them. "Step back a
   * bit" said out loud by a friend fixes the problem faster than any amount of
   * text on a screen the player is not looking at.
   */
  const coach =
    state.tracking === 'no-player'
      ? `👤 ${pick(MOTION.backIntoView, lang)}`
      : state.tracking === 'too-close'
        ? `🔙 ${pick(MOTION.stepBack, lang)}`
        : state.tracking === 'too-far'
          ? `🔜 ${pick(MOTION.stepCloser, lang)}`
          : state.tracking === 'out-of-area'
            ? `↔️ ${pick(MOTION.moveIntoArea, lang)}`
            : state.tracking === 'crowded'
              ? `🧍 ${pick(MOTION.onePlayer, lang)}`
              : state.tracking === 'unavailable'
                ? `📷 ${pick(MOTION.cameraOff, lang)}`
                : null;

  return (
    <div className={styles.root}>
      {pageBg && <img className={styles.bg} src={pageBg} alt="" draggable={false} />}

      {!finished && (
        <div className={styles.lookUp}>
          <span className={styles.lookArrow} aria-hidden>
            ⬆️
          </span>
          <p className={styles.lookLine}>{pick(MOTION.lookAtBigScreen, lang)}</p>
          <span className={styles.lookRule} aria-hidden />
        </div>
      )}

      {finished ? (
        <div className={styles.finalCard}>
          <span className={styles.gameGlyph} aria-hidden>
            {game ? GLYPH[game] : '🎉'}
          </span>
          <p className={styles.finalTitle}>{name}</p>
          <p className={styles.scoreLabel}>{pick(TEXT.score, lang)}</p>
          <span className={styles.scoreValue}>{state.finalScore ?? state.score}</span>
        </div>
      ) : (
        <div className={styles.gameCard}>
          <span className={styles.gameGlyph} aria-hidden>
            {game ? GLYPH[game] : '🎮'}
          </span>
          <p className={styles.gameName}>{name}</p>
          {/* Before a run starts there is no score to show, and a big fat 0 on
              the remote reads as "you are doing badly" rather than "we are
              waiting for you". */}
          {state.phase === 'playing' || state.phase === 'result' ? (
            <>
              <p className={styles.scoreLabel}>{pick(TEXT.score, lang)}</p>
              <span className={styles.scoreValue}>{state.score}</span>
            </>
          ) : (
            <p className={styles.waiting}>
              <span className={styles.waitingDot} aria-hidden />
              {pick(MOTION.stepInFront, lang)}
            </p>
          )}
        </div>
      )}

      {offerPhoto && (
        <div className={styles.photoOffer}>
          <p className={styles.photoOfferTitle}>📸 {pick(TEXT.photoReady, lang)}</p>
          <p className={styles.photoOfferSub}>{pick(MOTION.photoWaiting, lang)}</p>
          <div className={styles.photoOfferActions}>
            <GameButton variant="primary" onClick={onSeePhoto}>
              {pick(TEXT.seePhoto, lang)}
            </GameButton>
            <GameButton variant="ghost" onClick={() => setDismissed(true)}>
              {pick(MOTION.keepPlaying, lang)}
            </GameButton>
          </div>
        </div>
      )}

      {/* Keyed so a change of problem replays the entrance rather than silently
          swapping the words. */}
      {!finished && !offerPhoto && coach && (
        <div key={state.tracking} className={styles.coach}>
          {coach}
        </div>
      )}

      <div className={styles.actions}>
        {finished ? (
          <>
            {aiReady && (
              <GameButton variant="primary" onClick={onSeePhoto}>
                📸 {pick(TEXT.seePhoto, lang)}
              </GameButton>
            )}
            <GameButton variant={aiReady ? 'ghost' : 'primary'} onClick={onPlayAgain}>
              {pick(TEXT.playAgain, lang)}
            </GameButton>
            <GameButton variant="ghost" onClick={onStop}>
              {pick(TEXT.backToGames, lang)}
            </GameButton>
          </>
        ) : (
          // Exactly one button while a game is running. Anything else on this
          // screen is a thing for the player to worry about instead of playing.
          <GameButton variant="ghost" onClick={onStop}>
            ✕ {pick(MOTION.stopGame, lang)}
          </GameButton>
        )}
      </div>
    </div>
  );
}
