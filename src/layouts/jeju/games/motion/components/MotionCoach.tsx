/**
 * The one-line coaching banner shown DURING a motion game.
 *
 * Three problems, three lines, and nothing else — a visitor with their arms in
 * the air is not going to read a paragraph. Each is paired with a glyph that
 * carries the meaning on its own, because at two metres the glyph is what
 * actually gets seen.
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
}

export function MotionCoach({ status }: Props): JSX.Element | null {
  const lang = useLang();

  // 'starting' is silent on purpose: it only occurs before the gate has opened,
  // where the calibration screen is already saying the same thing better.
  if (status === 'tracking' || status === 'starting' || status === 'unavailable') return null;

  const { glyph, line } =
    status === 'no-player'
      ? { glyph: '👤', line: pick(MOTION.backIntoView, lang) }
      : status === 'too-close'
        ? { glyph: '🔙', line: pick(MOTION.stepBack, lang) }
        : status === 'too-far'
          ? { glyph: '🔜', line: pick(MOTION.stepCloser, lang) }
          : status === 'out-of-area'
            ? { glyph: '↔️', line: pick(MOTION.moveIntoArea, lang) }
            : { glyph: '🧍', line: pick(MOTION.onePlayer, lang) };

  return (
    // Keyed on the status so a change of problem replays the entrance rather
    // than silently swapping the words under the visitor's eye.
    <div key={status} className={styles.coach}>
      <span className={styles.coachGlyph} aria-hidden>
        {glyph}
      </span>
      {line}
    </div>
  );
}
