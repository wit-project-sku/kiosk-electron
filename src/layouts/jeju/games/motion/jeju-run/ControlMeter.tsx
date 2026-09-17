/**
 * The control meter: what the camera thinks the visitor's hand is doing.
 *
 * ══ HAND MODE: THREE SHAPES, ONE LIT ══════════════════════════════════
 * A hand plays by shape — ✌️ jump, ✋ run, ✊ duck (see runControl) — so the
 * meter is those three badges stacked, with the one the camera is currently
 * reading lit. That is the whole explanation a visitor needs: they make a V,
 * the ✌️ badge lights and she jumps. A visitor whose sloppy V is not being read
 * sees ✋ stay lit and knows to spread two fingers more clearly, instead of
 * concluding the game is broken.
 *
 * There used to be a vertical track with a moving ✋ marker and a jump line,
 * because jumping was "move your hand up by this much". Height means nothing
 * for a hand any more, and a track would re-teach the control that was
 * replaced.
 *
 * The badges are labelled with what SHE does, next to the shape that does it.
 *
 * ── Body mode keeps the track ─────────────────────────────────────────
 * With no hand in view the game falls back to the body, which still jumps and
 * crouches by height, so its meter still shows the lines.
 *
 * ── Drawn from a ref, not from state ──────────────────────────────────
 * The reading changes twenty times a second. Rendering React at that rate for
 * a few class toggles would be waste, so an animation frame writes them
 * straight onto the DOM.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { pick, useLang } from '@renderer/lib/i18n';
import { MOTION } from '../motionText';
import type { RunControl } from './useJejuRun';
import styles from './JejuRun.module.css';

/**
 * BODY track: how many threshold units the meter shows either side of the
 * baseline. The lines sit at ±1, leaving room for the marker to visibly go PAST
 * one.
 */
const RANGE = 1.8;

/** Where a level sits on the track, 0% top to 100% bottom. */
function toPercent(level: number): number {
  const clamped = Math.max(-RANGE, Math.min(RANGE, level));
  return 50 + (clamped / RANGE) * 50;
}

const JUMP_LINE = toPercent(-1);
const DUCK_LINE = toPercent(1);

interface Props {
  control: RefObject<RunControl>;
  /** Pulse one move — the practice run points at the move it is asking for. */
  emphasis?: 'jump' | 'duck' | null;
}

export function ControlMeter({ control, emphasis = null }: Props): JSX.Element {
  const lang = useLang();
  const rootRef = useRef<HTMLDivElement>(null);
  // Body track
  const trackRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const jumpZoneRef = useRef<HTMLDivElement>(null);
  const duckZoneRef = useRef<HTMLDivElement>(null);
  // Hand badges
  const jumpBadgeRef = useRef<HTMLDivElement>(null);
  const runBadgeRef = useRef<HTMLDivElement>(null);
  const duckBadgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const paint = (): void => {
      raf = requestAnimationFrame(paint);
      const reading = control.current;
      if (!reading) return;

      rootRef.current?.classList.toggle(styles.meterHandMode!, reading.byHand);

      if (reading.byHand) {
        // Ducking is the DETECTOR's answer (a fist can be held through a
        // dropout); the V badge follows the shape so it lights the instant the
        // camera reads it, which is the feedback that teaches the sign.
        const duck = reading.ducking;
        const jump = !duck && reading.shape === 'victory';
        const run = !duck && !jump && reading.shape !== null;
        jumpBadgeRef.current?.classList.toggle(styles.meterZoneOn!, jump);
        duckBadgeRef.current?.classList.toggle(styles.meterZoneOn!, duck);
        runBadgeRef.current?.classList.toggle(styles.meterZoneOn!, run);
        return;
      }

      const seen = reading.level !== null;
      if (markerRef.current) markerRef.current.style.top = `${seen ? toPercent(reading.level!) : 50}%`;
      trackRef.current?.classList.toggle(styles.meterLost!, !seen);
      jumpZoneRef.current?.classList.toggle(styles.meterZoneOn!, seen && reading.level! <= -1);
      duckZoneRef.current?.classList.toggle(styles.meterZoneOn!, reading.ducking);
    };
    paint();
    return () => cancelAnimationFrame(raf);
  }, [control]);

  return (
    <div ref={rootRef} className={`${styles.meter} ${styles.meterHandMode}`} aria-hidden>
      {/* ── Hand: the three shapes ── */}
      <div className={styles.meterShapes}>
        <div
          ref={jumpBadgeRef}
          className={`${styles.meterBadge} ${styles.meterBadgeJump} ${emphasis === 'jump' ? styles.meterPulse : ''}`}
        >
          <span className={styles.meterBadgeGlyph}>✌️</span>
          <span className={styles.meterBadgeLabel}>{pick(MOTION.meterJump, lang)}</span>
        </div>
        <div ref={runBadgeRef} className={`${styles.meterBadge} ${styles.meterBadgeRun}`}>
          <span className={styles.meterBadgeGlyph}>✋</span>
          <span className={styles.meterBadgeLabel}>{pick(MOTION.meterRun, lang)}</span>
        </div>
        <div
          ref={duckBadgeRef}
          className={`${styles.meterBadge} ${styles.meterBadgeDuck} ${emphasis === 'duck' ? styles.meterPulse : ''}`}
        >
          <span className={styles.meterBadgeGlyph}>✊</span>
          <span className={styles.meterBadgeLabel}>{pick(MOTION.meterDuck, lang)}</span>
        </div>
      </div>

      {/* ── Body fallback: the height track ── */}
      <div ref={trackRef} className={styles.meterTrack}>
        <div
          ref={jumpZoneRef}
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
          ref={duckZoneRef}
          className={`${styles.meterZone} ${styles.meterDuck} ${emphasis === 'duck' ? styles.meterPulse : ''}`}
          style={{ top: `${DUCK_LINE}%`, bottom: 0 }}
        >
          <span className={styles.meterLabel}>⬇️ {pick(MOTION.meterDuck, lang)}</span>
        </div>
        <div ref={markerRef} className={styles.meterMarker} style={{ top: '50%' }}>
          <span className={styles.meterHand}>🧍</span>
        </div>
      </div>

      <p className={styles.meterCaption}>{pick(MOTION.meterHand, lang)}</p>
    </div>
  );
}
