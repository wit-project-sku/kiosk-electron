/**
 * The hand meter: where the visitor's hand is, against the two lines that
 * matter.
 *
 * ══ WHY THIS EXISTS ═══════════════════════════════════════════════════
 * The controls are RELATIVE — "up" means above wherever the visitor held their
 * hand during the countdown, by a set distance — and relative controls cannot
 * be explained in words. "Raise your hand" does not say how far; a visitor who
 * lifts it a little, sees nothing happen, and concludes the game is broken has
 * done exactly what the sentence said.
 *
 * A meter says it instead. Their hand is the ✋ marker, moving as they move;
 * crossing the upper line lights JUMP and she jumps, crossing the lower one
 * lights DUCK and she ducks. Within a few seconds of watching it the visitor
 * has worked out "how far" for themselves, and nothing else on screen could
 * have told them.
 *
 * The zones are labelled with what SHE does, not with what the hand does.
 *
 * ── Drawn from a ref, not from state ──────────────────────────────────
 * The reading changes twenty times a second. Rendering React at that rate for
 * one moving marker would be waste, so an animation frame writes the marker's
 * position and the two zones' lit state straight onto the DOM.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { pick, useLang } from '@renderer/lib/i18n';
import { MOTION } from '../motionText';
import type { RunControl } from './useJejuRun';
import styles from './JejuRun.module.css';

/**
 * How many threshold units the meter shows either side of the baseline.
 *
 * The lines sit at ±1, so a range of 1.8 puts them a little under a quarter of
 * the way in from each end — enough room above and below for the marker to
 * visibly go PAST a line, which is what makes crossing it feel like an action
 * rather than a coincidence.
 */
const RANGE = 1.8;

/** Where a level sits on the track, 0% top to 100% bottom. */
function toPercent(level: number): number {
  const clamped = Math.max(-RANGE, Math.min(RANGE, level));
  return 50 + (clamped / RANGE) * 50;
}

/** The jump line's and duck line's own positions, for the markup. */
const JUMP_LINE = toPercent(-1);
const DUCK_LINE = toPercent(1);

interface Props {
  control: RefObject<RunControl>;
  /** Pulse one zone — the practice run points at the move it is asking for. */
  emphasis?: 'jump' | 'duck' | null;
}

export function ControlMeter({ control, emphasis = null }: Props): JSX.Element {
  const lang = useLang();
  const markerRef = useRef<HTMLDivElement>(null);
  const jumpRef = useRef<HTMLDivElement>(null);
  const duckRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const paint = (): void => {
      raf = requestAnimationFrame(paint);
      const reading = control.current;
      const marker = markerRef.current;
      if (!marker || !reading) return;

      const seen = reading.level !== null;
      marker.style.top = `${seen ? toPercent(reading.level!) : 50}%`;
      trackRef.current?.classList.toggle(styles.meterLost!, !seen);
      jumpRef.current?.classList.toggle(styles.meterZoneOn!, seen && reading.level! <= -1);
      duckRef.current?.classList.toggle(styles.meterZoneOn!, seen && reading.level! >= 1);
    };
    paint();
    return () => cancelAnimationFrame(raf);
  }, [control]);

  return (
    <div className={styles.meter} aria-hidden>
      <div ref={trackRef} className={styles.meterTrack}>
        <div
          ref={jumpRef}
          className={`${styles.meterZone} ${styles.meterJump} ${emphasis === 'jump' ? styles.meterPulse : ''}`}
          style={{ top: 0, height: `${JUMP_LINE}%` }}
        >
          <span className={styles.meterLabel}>⬆️ {pick(MOTION.meterJump, lang)}</span>
        </div>
        <div
          className={`${styles.meterZone} ${styles.meterRun}`}
          style={{ top: `${JUMP_LINE}%`, height: `${DUCK_LINE - JUMP_LINE}%` }}
        >
          <span className={styles.meterLabel}>{pick(MOTION.meterRun, lang)}</span>
        </div>
        <div
          ref={duckRef}
          className={`${styles.meterZone} ${styles.meterDuck} ${emphasis === 'duck' ? styles.meterPulse : ''}`}
          style={{ top: `${DUCK_LINE}%`, bottom: 0 }}
        >
          <span className={styles.meterLabel}>⬇️ {pick(MOTION.meterDuck, lang)}</span>
        </div>

        <div ref={markerRef} className={styles.meterMarker} style={{ top: '50%' }}>
          <span className={styles.meterHand}>✋</span>
        </div>
      </div>
      <p className={styles.meterCaption}>✋ = {pick(MOTION.meterHand, lang)}</p>
    </div>
  );
}
