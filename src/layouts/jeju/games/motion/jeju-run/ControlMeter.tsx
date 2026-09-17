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
 * ── A hand ducks with a FIST, so its meter has no duck zone ───────────
 * While a hand is steering, down means nothing (see runControl), and a zone
 * below the line labelled DUCK would re-teach exactly the gesture that was
 * replaced. So in hand mode that zone is gone, "run" fills the rest of the
 * track, and a ✊ badge under it lights while the fist is held — with the
 * marker itself turning into a fist, so the visitor sees their own hand close.
 * The body fallback still ducks by crouching, and keeps the zone.
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
  const rootRef = useRef<HTMLDivElement>(null);
  const fistRef = useRef<HTMLDivElement>(null);
  const glyphRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const paint = (): void => {
      raf = requestAnimationFrame(paint);
      const reading = control.current;
      const marker = markerRef.current;
      if (!marker || !reading) return;

      const seen = reading.level !== null;
      marker.style.top = `${seen ? toPercent(reading.level!) : 50}%`;
      rootRef.current?.classList.toggle(styles.meterHandMode!, reading.byHand);
      trackRef.current?.classList.toggle(styles.meterLost!, !seen);
      jumpRef.current?.classList.toggle(styles.meterZoneOn!, seen && reading.level! <= -1);
      // Lit by the DETECTOR's answer, not by the marker's position: what
      // matters is whether she is ducking, and for a hand that is the fist.
      duckRef.current?.classList.toggle(styles.meterZoneOn!, reading.ducking);
      fistRef.current?.classList.toggle(styles.meterZoneOn!, reading.ducking);
      const glyph = reading.byHand && reading.ducking ? '✊' : '✋';
      if (glyphRef.current && glyphRef.current.textContent !== glyph) {
        glyphRef.current.textContent = glyph;
      }
    };
    paint();
    return () => cancelAnimationFrame(raf);
  }, [control]);

  return (
    <div ref={rootRef} className={`${styles.meter} ${styles.meterHandMode}`} aria-hidden>
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
          <span ref={glyphRef} className={styles.meterHand}>
            ✋
          </span>
        </div>
      </div>
      <div
        ref={fistRef}
        className={`${styles.meterFist} ${emphasis === 'duck' ? styles.meterPulse : ''}`}
      >
        <span className={styles.meterFistGlyph}>✊</span>
        <span className={styles.meterFistLabel}>{pick(MOTION.meterDuck, lang)}</span>
      </div>
      <p className={styles.meterCaption}>✋ = {pick(MOTION.meterHand, lang)}</p>
    </div>
  );
}
