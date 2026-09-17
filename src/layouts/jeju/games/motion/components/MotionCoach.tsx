/**
 * The one-line coaching banner shown DURING a motion game.
 *
 * One short line per problem, and nothing else — a visitor with a hand in the
 * air is not going to read a paragraph. A pulsing amber dot marks it as
 * something to fix rather than a caption.
 *
 * ── Renders nothing while tracking is fine ────────────────────────────
 * That is the important behaviour. A banner that is always present becomes
 * furniture and stops being read; one that appears only when something is wrong
 * is information. `null` for 'tracking' and 'starting' is deliberate.
 */
import { pick, useLang } from '@renderer/lib/i18n';
import { MOTION } from '../motionText';
import type { TrackingStatus } from '../poseTypes';
import styles from './motionUi.module.css';

interface Props {
  status: TrackingStatus;
  /**
   * What is steering, so the one line that differs between them can.
   *
   * "Raise your hand again" is the right prompt for a player whose hand left
   * the frame and exactly the wrong one for a player who is steering with their
   * body BECAUSE their hands are full — see the fallback in useMotionTracking.
   */
  source: 'hand' | 'body' | null;
}

export function MotionCoach({ status, source }: Props): JSX.Element | null {
  const lang = useLang();

  // 'starting' is silent on purpose: it only occurs before the gate has opened,
  // where the calibration screen is already saying the same thing better.
  if (status === 'tracking' || status === 'starting' || status === 'unavailable') return null;

  const line =
    status === 'no-player'
      ? pick(source === 'body' ? MOTION.stepInFront : MOTION.backIntoView, lang)
      : status === 'too-close'
        ? pick(MOTION.stepBack, lang)
        : status === 'too-far'
          ? pick(MOTION.stepCloser, lang)
          : status === 'out-of-area'
            ? pick(MOTION.moveIntoArea, lang)
            : pick(MOTION.onePlayer, lang);

  return (
    // Keyed on the status so a change of problem replays the entrance rather
    // than silently swapping the words under the visitor's eye.
    <div key={status} className={styles.coach}>
      <span className={styles.coachDot} aria-hidden />
      {line}
    </div>
  );
}
