/**
 * The practice run's instructions: one move at a time, then "go".
 *
 * Big, central and short, because it is read by somebody who is looking at the
 * runner and has one hand in the air. Each ask is a glyph that DEMONSTRATES the
 * move — an open hand turning into ✌️ or ✊ — above one line saying it and
 * one line saying what it does. The glyph alone is the instruction; the text is
 * for the visitor who wants to be sure.
 *
 * It pairs with {@link ControlMeter}, which pulses the badge this card is asking
 * for. The card says WHAT to do; the meter shows whether the camera sees it.
 */
import { pick, useLang } from '@renderer/lib/i18n';
import { RunIcon } from '../../components/GameIcons';
import { MOTION } from '../motionText';
import type { RunTutorial } from './useJejuRun';
import styles from './JejuRun.module.css';

interface Props {
  step: RunTutorial;
}

export function RunTutorialCard({ step }: Props): JSX.Element | null {
  const lang = useLang();
  if (step === 'done') return null;

  const praise = step === 'jump-ok' || step === 'duck-ok';

  return (
    // Keyed on the step so every change replays the entrance: a new ask should
    // look like a new ask, not like the old words quietly swapping.
    <div key={step} className={styles.tut}>
      {/* Both demonstrations are the shape changing, in place: an open hand
          turning into the sign and back. Two glyphs cross-fading rather than one
          moving, because each move is a SHAPE, not a direction — a hand
          travelling up or down here would re-teach the old controls. */}
      {step === 'jump' && (
        <>
          <span className={styles.tutDemo} aria-hidden>
            <span className={`${styles.tutHand} ${styles.tutShapeOpen}`}>✋</span>
            <span className={`${styles.tutHand} ${styles.tutShapeTo}`}>✌️</span>
          </span>
          <p className={styles.tutLine}>{pick(MOTION.tutJump, lang)}</p>
          <p className={styles.tutSub}>{pick(MOTION.tutJumpSub, lang)}</p>
        </>
      )}

      {step === 'duck' && (
        <>
          <span className={styles.tutDemo} aria-hidden>
            <span className={`${styles.tutHand} ${styles.tutShapeOpen}`}>✋</span>
            <span className={`${styles.tutHand} ${styles.tutShapeTo}`}>✊</span>
          </span>
          <p className={styles.tutLine}>{pick(MOTION.tutDuck, lang)}</p>
          <p className={styles.tutSub}>{pick(MOTION.tutDuckSub, lang)}</p>
        </>
      )}

      {praise && (
        <>
          <span className={styles.tutCheck} aria-hidden>
            <svg
              width="110"
              height="110"
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 25l9 9 19-20" />
            </svg>
          </span>
          <p className={styles.tutLine}>{pick(MOTION.tutGood, lang)}</p>
          {/* After the first duck the fist is still closed and she is still
              down. Say how to get up, or they wait there for the game. */}
          {step === 'duck-ok' && (
            <p className={styles.tutSub}>{pick(MOTION.tutDuckRelease, lang)}</p>
          )}
        </>
      )}

      {step === 'go' && (
        <>
          <span className={styles.tutGo}>
            <RunIcon size={200} />
          </span>
          <p className={styles.tutLine}>{pick(MOTION.tutGo, lang)}</p>
          <p className={styles.tutSub}>{pick(MOTION.tutGoSub, lang)}</p>
        </>
      )}
    </div>
  );
}
