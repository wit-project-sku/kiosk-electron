/**
 * The no-touch gate every motion game opens on.
 *
 * ══ THIS IS THE COMPONENT THAT MAKES THE GAMES TOUCHLESS ══════════════
 * The brief's rule is that a visitor never has to touch the screen to play. The
 * only way to honour that is for the game to start when a PERSON APPEARS rather
 * than when a button is pressed — so this gate holds until the tracker actually
 * locks somebody, then hands off to the countdown on its own.
 *
 * ── Why a player must be held, not merely seen ────────────────────────
 * 제주공항 is a concourse. People walk past this kiosk constantly, and a gate
 * that fired on the first locked frame would start a game for someone who is
 * already gone — the countdown would run into an empty room and the visitor who
 * finally did step up would arrive mid-game. {@link HOLD_MS} is the difference
 * between "somebody crossed the frame" and "somebody is standing here".
 *
 * ── It does not draw the camera ───────────────────────────────────────
 * The preview is a single persistent element owned by MotionStage — see the
 * note on `.previewGate`. This gate is the scrim and the words around the hole
 * it leaves, which is why the layout is absolute rather than a centred column.
 *
 * ── There is no way out ON THIS SCREEN, and that is correct ───────────
 * This renders on Monitor 2, which has no touchscreen. A visitor who changes
 * their mind — or a camera that never opens — is handled by the 그만하기 button
 * on Monitor 1's remote, which is within reach and always live. A dead camera
 * says so here and the remote offers the way out; drawing a button on the big
 * screen would only invite someone to walk up and press the glass.
 */
import { useEffect, useRef, useState } from 'react';
import { pick, useLang } from '@renderer/lib/i18n';
import { MOTION } from '../motionText';
import type { TrackingStatus } from '../poseTypes';
import styles from './motionUi.module.css';

/**
 * How long a player must stay locked before the game starts.
 *
 * Long enough to exclude someone walking past, short enough that a visitor who
 * has deliberately stepped up does not wonder whether it is broken.
 */
const HOLD_MS = 1200;

interface Props {
  status: TrackingStatus;
  /** Fired once, after a player has been held for {@link HOLD_MS}. */
  onReady: () => void;
}

export function MotionCalibration({ status, onReady }: Props): JSX.Element {
  const lang = useLang();
  const firedRef = useRef(false);

  // A locked player is any status where somebody IS there — including
  // 'out-of-area' and 'crowded'. Those are coaching problems, not reasons to
  // refuse to start: a visitor standing slightly too far left should be told so
  // DURING the game, not left staring at a gate that will not open.
  const present = status === 'tracking' || status === 'out-of-area' || status === 'crowded';
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!present) {
      setHeld(false);
      return;
    }
    if (firedRef.current) return;
    const id = setTimeout(() => {
      // The ref guard, not just the timer: `present` can flicker across the
      // hold and re-arm this effect, and onReady must fire exactly once.
      if (firedRef.current) return;
      firedRef.current = true;
      setHeld(true);
      onReady();
    }, HOLD_MS);
    return () => clearTimeout(id);
  }, [present, onReady]);

  if (status === 'unavailable') {
    return (
      <div className={styles.dead}>
        <span className={styles.deadGlyph} aria-hidden>
          📷
        </span>
        <p className={styles.gateLine}>{pick(MOTION.cameraOff, lang)}</p>
        {/* Points at the OTHER screen, because that is where the way out is. */}
        <p className={styles.gateSub}>👇 {pick(MOTION.useTouchScreen, lang)}</p>
      </div>
    );
  }

  return (
    <div className={styles.gate}>
      <div className={styles.gateBody}>
        {status === 'starting' ? (
          <p className={styles.gateSub}>{pick(MOTION.starting, lang)}</p>
        ) : present ? (
          <p className={`${styles.gateLine} ${styles.gateReady}`}>✓ {pick(MOTION.ready, lang)}</p>
        ) : (
          <>
            <span className={styles.gateGlyph} aria-hidden>
              👋
            </span>
            <p className={styles.gateLine}>{pick(MOTION.stepInFront, lang)}</p>
          </>
        )}

        {/* The whole instruction, as a picture. A visitor who reads none of the
            text above still learns what the game wants from these two arrows. */}
        {!held && (
          <div className={styles.howTo}>
            <span className={styles.howToArrow} aria-hidden>
              ←
            </span>
            <span aria-hidden>🧍</span>
            <span className={`${styles.howToArrow} ${styles.howToArrowRight}`} aria-hidden>
              →
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
