/**
 * The practice run's instructions: one move at a time, then "go".
 *
 * Big, central and short, because it is read by somebody who is looking at the
 * runner and has one hand in the air. Each ask is a glyph that DEMONSTRATES the
 * move — a hand that rises, a hand that drops — above one line saying it and
 * one line saying what it does. The glyph alone is the instruction; the text is
 * for the visitor who wants to be sure.
 *
 * It pairs with {@link ControlMeter}, which pulses the zone this card is asking
 * for. The card says WHAT to do; the meter shows HOW FAR.
 */
import { pick, useLang } from '@renderer/lib/i18n';
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
    <div key={step} className={`${styles.tut} ${praise ? styles.tutPraise : ''}`}>
      {step === 'jump' && (
        <>
          <span className={styles.tutDemo} aria-hidden>
            <span className={`${styles.tutHand} ${styles.tutHandUp}`}>✋</span>
          </span>
          <p className={styles.tutLine}>{pick(MOTION.tutJump, lang)}</p>
          <p className={styles.tutSub}>⬆️ {pick(MOTION.tutJumpSub, lang)}</p>
        </>
      )}

      {step === 'duck' && (
        <>
          {/* The demonstration is the shape changing, in place: an open hand
              closing into a fist and opening again. Two glyphs cross-fading
              rather than one moving, because the move is a SHAPE, not a
              direction — a hand travelling down here would re-teach the old
              control this one replaced. */}
          <span className={styles.tutDemo} aria-hidden>
            <span className={`${styles.tutHand} ${styles.tutShapeOpen}`}>✋</span>
            <span className={`${styles.tutHand} ${styles.tutShapeFist}`}>✊</span>
          </span>
          <p className={styles.tutLine}>{pick(MOTION.tutDuck, lang)}</p>
          <p className={styles.tutSub}>✊ {pick(MOTION.tutDuckSub, lang)}</p>
        </>
      )}

      {praise && (
        <>
          <span className={styles.tutGlyph} aria-hidden>
            👍
          </span>
          <p className={styles.tutLine}>{pick(MOTION.tutGood, lang)}</p>
          {/* After the first duck the fist is still closed and she is still
              down. Say how to get up, or they wait there for the game. */}
          {step === 'duck-ok' && (
            <p className={styles.tutSub}>✋ {pick(MOTION.tutDuckRelease, lang)}</p>
          )}
        </>
      )}

      {step === 'go' && (
        <>
          <span className={styles.tutGlyph} aria-hidden>
            🏃‍♀️
          </span>
          <p className={styles.tutLine}>{pick(MOTION.tutGo, lang)}</p>
          <p className={styles.tutSub}>{pick(MOTION.tutGoSub, lang)}</p>
        </>
      )}
    </div>
  );
}
