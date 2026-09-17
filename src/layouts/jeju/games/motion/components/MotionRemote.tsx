/**
 * 모션 게임 리모컨 — what Monitor 1 shows while Monitor 2 plays.
 *
 * ══ THIS SCREEN IS A REMOTE, NOT A GAME ══════════════════════════════
 * The visitor is standing back facing the customer display. They are not
 * looking at this screen and should not have to. So it does three things and
 * nothing else:
 *
 *   1. Says the game is happening on the OTHER screen.
 *   2. Mirrors the score, the tracking status and the controls, so a companion
 *      standing at the kiosk can follow along and read a "raise your hand
 *      again" out loud.
 *   3. Keeps 그만하기 within reach. This is the only way out of a motion game:
 *      the big screen has no touch, so if this button is not here, a visitor
 *      who wants to stop has no way to say so.
 *
 * ── One panel ─────────────────────────────────────────────────────────
 * Status, score and controls sit in a single panel separated by hairlines,
 * rather than as a card, a dark pill and a row of chips that each looked like a
 * different component. No shadows; the panel is an opaque surface on the page.
 *
 * ── Banking the score ─────────────────────────────────────────────────
 * The run's total arrives as `finalScore` on the broadcast, and this is where it
 * becomes JEJU POINTS — Monitor 2 has no points store and no business having
 * one. Banked exactly once per run, keyed on runId; see the effect.
 */
import { useEffect, useRef } from 'react';
import { pick, useLang } from '@renderer/lib/i18n';
import type { MotionGameId, MotionGameState } from '@shared/types/motionGame';
import { usePhotoChrome } from '../../../../photo/photoChrome';
import { TEXT } from '../../gameText';
import { GameButton } from '../../components/GameButton';
import { ScreenUpIcon } from '../../components/GameIcons';
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
  const scoring = state.phase === 'playing' || finished;

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

  /**
   * Repeat whatever the big screen is coaching, as one status line.
   *
   * Not redundancy: the player is facing away from this screen, and the person
   * who can read it is whoever is standing at the kiosk with them.
   */
  const coach =
    state.tracking === 'no-player'
      ? pick(scoring ? MOTION.backIntoView : MOTION.raiseHand, lang)
      : state.tracking === 'too-close'
        ? pick(MOTION.stepBack, lang)
        : state.tracking === 'too-far'
          ? pick(MOTION.stepCloser, lang)
          : state.tracking === 'out-of-area'
            ? pick(MOTION.moveIntoArea, lang)
            : state.tracking === 'crowded'
              ? pick(MOTION.onePlayer, lang)
              : state.tracking === 'unavailable'
                ? pick(MOTION.cameraOff, lang)
                : state.tracking === 'starting'
                  ? pick(MOTION.starting, lang)
                  : null;
  const tone = finished ? 'done' : coach === null ? 'ok' : 'warn';
  const statusLine = finished
    ? pick(MOTION.runResult, lang)
    : (coach ?? pick(MOTION.handTracked, lang));

  return (
    <div className={styles.root}>
      {pageBg && <img className={styles.bg} src={pageBg} alt="" draggable={false} />}

      <div className={styles.column}>
        <header className={styles.top}>
          {!finished && (
            <p className={styles.eyebrow}>
              <ScreenUpIcon size={52} />
              {pick(MOTION.lookAtBigScreen, lang)}
            </p>
          )}
          <h1 className={styles.title}>{pick(MOTION.runName, lang)}</h1>
        </header>

        <section className={styles.panel}>
          <p className={styles.status} data-tone={tone}>
            <span className={styles.statusDot} aria-hidden />
            {/* Keyed so a change of problem replays the fade rather than silently
              swapping the words. */}
            <span key={statusLine} className={styles.statusText}>
              {statusLine}
            </span>
          </p>

          <div className={styles.scoreBlock}>
            <span className={styles.label}>{pick(TEXT.score, lang)}</span>
            {/* Before a run starts there is no score, and a big 0 reads as "you are
              doing badly" rather than "we are waiting for you". */}
            <span className={`${styles.scoreValue} ${scoring ? '' : styles.scoreIdle}`}>
              {scoring ? (state.finalScore ?? state.score) : '—'}
            </span>
          </div>

          {game === 'jeju-run' && !finished && (
            <div className={styles.controls}>
              <span className={styles.label}>{pick(MOTION.controls, lang)}</span>
              <div className={styles.controlRows}>
                <span className={styles.control}>
                  <span className={styles.controlHand} aria-hidden>
                    ✌️
                  </span>
                  {pick(MOTION.meterJump, lang)}
                </span>
                <span className={styles.control}>
                  <span className={styles.controlHand} aria-hidden>
                    ✊
                  </span>
                  {pick(MOTION.meterDuck, lang)}
                </span>
              </div>
            </div>
          )}
        </section>

        <div className={styles.actions}>
          {finished ? (
            <>
              {aiReady && (
                <GameButton variant="primary" onClick={onSeePhoto} className={styles.actionWide}>
                  {pick(TEXT.seePhoto, lang)}
                </GameButton>
              )}
              <GameButton
                variant={aiReady ? 'ghost' : 'primary'}
                onClick={onPlayAgain}
                className={styles.actionHalf}
              >
                {pick(TEXT.playAgain, lang)}
              </GameButton>
              <GameButton variant="ghost" onClick={onStop} className={styles.actionHalf}>
                {pick(TEXT.backToGames, lang)}
              </GameButton>
            </>
          ) : (
            // While a game runs: 그만하기, plus 사진 보기 once the photo exists. The
            // "your photo is ready" question itself is asked by the host's sheet
            // (PhotoReadyPrompt) and mirrored on the big screen; this is where
            // the answer stays available after "keep playing".
            <>
              <GameButton
                variant="ghost"
                onClick={onStop}
                className={aiReady ? styles.actionHalf : styles.actionWide}
              >
                {pick(MOTION.stopGame, lang)}
              </GameButton>
              {aiReady && (
                <GameButton variant="primary" onClick={onSeePhoto} className={styles.actionHalf}>
                  {pick(TEXT.seePhoto, lang)}
                </GameButton>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
