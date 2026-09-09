/**
 * SCORE · (middle slot) · TIME LEFT — the row every timed game puts above its
 * play field.
 *
 * The score animates on change. That is done with a `key` on the value span,
 * not a CSS class toggle: re-mounting restarts the keyframe, whereas a toggled
 * class does not replay an animation that is already applied — the second catch
 * in a row would be silent. Cheap, because the span has no children.
 */
import type { ReactNode } from 'react';
import { pick, useLang } from '@renderer/lib/i18n';
import { TEXT } from '../gameText';
import styles from './gameUi.module.css';

interface Props {
  score: number;
  /** Omit for games with no clock (the cup game is round-based). */
  secondsLeft?: number;
  /** Below this the clock turns red and pulses. */
  urgentAt?: number;
  /** Centre slot — the cup game's "ROUND 2 / 4", the hunt's progress. */
  middle?: ReactNode;
  /** Artboard y of the row's top edge. */
  top: number;
}

export function GameHud({ score, secondsLeft, urgentAt = 10, middle, top }: Props): JSX.Element {
  const lang = useLang();
  const urgent = secondsLeft !== undefined && secondsLeft <= urgentAt;

  return (
    <div className={styles.hud} style={{ top: `${top}px` }}>
      <div className={styles.hudCell}>
        <span className={styles.hudLabel}>{pick(TEXT.score, lang)}</span>
        {/* keyed on the value — see the note above */}
        <span
          key={score}
          className={`${styles.hudValue} ${styles.hudValueAccent} ${styles.hudBump}`}
        >
          {score}
        </span>
      </div>

      <div className={`${styles.hudCell} ${styles.hudCellMid}`}>{middle}</div>

      <div className={`${styles.hudCell} ${styles.hudCellRight}`}>
        {secondsLeft !== undefined && (
          <>
            <span className={styles.hudLabel}>{pick(TEXT.timeLeft, lang)}</span>
            <span className={`${styles.hudValue} ${urgent ? styles.hudUrgent : ''}`}>
              {secondsLeft}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
