/**
 * The 3 · 2 · 1 · 시작! that precedes a timed game.
 *
 * ── Why a game does not start on the tap that opened it ───────────────
 * The tap that chose the card is on a game CARD, somewhere in the middle of the
 * screen; the first thing 감귤 받기 wants is a hand on the basket at the bottom.
 * Starting the clock immediately spends the visitor's first two seconds on
 * moving their arm, which is exactly the time the game is easiest and the
 * impression is formed. Three seconds is enough to look at the field and get
 * into position.
 *
 * The component owns its own interval and clears it on unmount, so a visitor
 * who backs out mid-countdown leaves nothing running — see the kiosk-lifetime
 * note in JejuWaitingGames.
 */
import { useEffect, useState } from 'react';
import { pick, useLang } from '@renderer/lib/i18n';
import { sfx } from '../gameSound';
import { TEXT } from '../gameText';
import styles from './gameUi.module.css';

interface Props {
  /** Fired once, after the "시작!" beat. */
  onDone: () => void;
  /** One line under the number — usually the game's how-to. */
  hint?: string;
  /** Ticks before "시작!". */
  from?: number;
}

/** How long "시작!" holds before the game takes over. */
const GO_MS = 550;

export function GameCountdown({ onDone, hint, from = 3 }: Props): JSX.Element {
  /** Counts down to 0; 0 IS the "시작!" beat, not a tick. */
  const [n, setN] = useState(from);

  useEffect(() => {
    if (n <= 0) {
      sfx.countdown(true);
      const id = setTimeout(onDone, GO_MS);
      return () => clearTimeout(id);
    }
    sfx.countdown(false);
    const id = setTimeout(() => setN((v) => v - 1), 900);
    return () => clearTimeout(id);
    // `onDone` is stable (useCallback in every caller); listing it would restart
    // the tick on any parent re-render and stretch the countdown indefinitely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const lang = useLang();

  return (
    <div className={styles.countdown}>
      {n > 0 ? (
        // Keyed so each number replays the pop rather than cross-fading.
        <span key={n} className={styles.countdownNum}>
          {n}
        </span>
      ) : (
        <span className={styles.countdownGo}>{pick(TEXT.go, lang)}</span>
      )}
      {hint && <p className={styles.countdownHint}>{hint}</p>}
    </div>
  );
}
