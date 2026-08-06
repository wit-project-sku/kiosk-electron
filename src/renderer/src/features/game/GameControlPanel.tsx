import { useEffect, useState } from 'react';
import type { GameState } from '@shared/types/photo';
import { generatedUrl } from '@renderer/lib/media';
import { useLang } from '@renderer/lib/i18n';
import { gameText, type GameTextKey } from './gameTexts';
import styles from './GameControlPanel.module.css';

/**
 * Wait-time mini game — Monitor 1 (touch kiosk) control panel.
 *
 * Monitor 2 renders the game itself; this screen is the only thing the visitor
 * touches. It starts a run, and once they crash it offers the finished photo or
 * another round. It deliberately has NO jump/duck controls: the game is played
 * with the body, and giving it buttons would defeat the point.
 *
 * The photo is held back by the main process while a run is live (see
 * PhotoWorkflowService.waitForResultRelease), so "see my photo" is a real
 * choice rather than something that fires from under the player.
 */

/** If the pose model hasn't loaded by now, stop promising a game. */
const POSE_GIVE_UP_MS = 12_000;

/** Advertised generation time — drives the progress bar only. */
const GEN_WAIT_SECS = 60;

interface GameControlPanelProps {
  game: GameState;
}

export function GameControlPanel({ game }: GameControlPanelProps): JSX.Element {
  const lang = useLang();
  const t = (key: GameTextKey): string => gameText(key, lang);

  // Body control may simply never come up (no camera, model failed). Give it a
  // fair window, then be honest rather than showing a PLAY that can't work.
  const [poseGaveUp, setPoseGaveUp] = useState(false);
  useEffect(() => {
    if (game.poseReady) {
      setPoseGaveUp(false);
      return;
    }
    const id = setTimeout(() => setPoseGaveUp(true), POSE_GIVE_UP_MS);
    return () => clearTimeout(id);
  }, [game.poseReady]);

  const canPlay = game.poseReady && game.bodyTracked;
  const preview = game.resultPreviewFileName;

  return (
    <div className={styles.panel}>
      <p className={styles.kicker}>{t('generating')}</p>

      {/* Generation progress — a CSS animation, so it costs no re-renders. */}
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ animationDuration: `${GEN_WAIT_SECS}s` }} />
      </div>

      {/* ── Waiting for PLAY ────────────────────────────────────────────── */}
      {game.phase === 'ready' && (
        <>
          <h1 className={styles.title}>{t('inviteTitle')}</h1>

          {game.poseReady || !poseGaveUp ? (
            <>
              <ul className={styles.tips}>
                <li className={styles.tip}>
                  <span className={styles.tipIcon} aria-hidden>
                    🦘
                  </span>
                  {t('jumpTip')}
                </li>
                <li className={styles.tip}>
                  <span className={styles.tipIcon} aria-hidden>
                    🧎
                  </span>
                  {t('duckTip')}
                </li>
              </ul>

              <button
                type="button"
                className={styles.playBtn}
                disabled={!canPlay}
                onClick={() => void window.api.game.start()}
              >
                {t('play')}
              </button>
              <p className={styles.hint}>
                {!game.poseReady
                  ? t('poseLoading')
                  : game.bodyTracked
                    ? t('lookAtBigScreen')
                    : t('stepIntoView')}
              </p>
            </>
          ) : (
            <p className={styles.notice}>{t('motionUnavailable')}</p>
          )}
        </>
      )}

      {/* ── Run in progress ─────────────────────────────────────────────── */}
      {(game.phase === 'starting' || game.phase === 'playing') && (
        <>
          <h1 className={styles.title}>
            {game.phase === 'starting' ? t('getReady') : t('playingNow')}
          </h1>
          <p className={styles.big}>{t('lookAtBigScreen')}</p>
          <ul className={styles.tips}>
            <li className={styles.tip}>
              <span className={styles.tipIcon} aria-hidden>
                🦘
              </span>
              {t('jumpTip')}
            </li>
            <li className={styles.tip}>
              <span className={styles.tipIcon} aria-hidden>
                🧎
              </span>
              {t('duckTip')}
            </li>
          </ul>
        </>
      )}

      {/* ── Crashed — the visitor chooses what happens next ──────────────── */}
      {game.phase === 'over' && (
        <>
          <h1 className={styles.title}>{t('crashed')}</h1>
          <div className={styles.scoreRow}>
            <span className={styles.scoreLabel}>{t('score')}</span>
            <span className={styles.scoreValue}>{game.lastScore}</span>
            <span className={styles.scoreBest}>
              {t('best')} {game.bestScore}
            </span>
          </div>

          {game.resultReady && preview && (
            <div className={styles.previewWrap}>
              <img className={styles.preview} src={generatedUrl(preview)} alt="" draggable={false} />
              <span className={styles.previewBadge}>{t('photoReady')}</span>
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.resultBtn}
              disabled={!game.resultReady}
              onClick={() => void window.api.game.showResult()}
            >
              {game.resultReady ? t('showResult') : t('waitingForAi')}
            </button>
            <button
              type="button"
              className={styles.replayBtn}
              onClick={() => void window.api.game.replay()}
            >
              {t('playAgain')}
            </button>
          </div>
        </>
      )}

      <p className={styles.footer}>{t('autoContinue')}</p>
    </div>
  );
}
