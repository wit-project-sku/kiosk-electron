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
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { MotionDiagnostics as Diagnostics } from '../useMotionTracking';
import { pick, useLang } from '@renderer/lib/i18n';
import { MOTION } from '../motionText';
import type { TrackingStatus } from '../poseTypes';
import { MotionDiagnostics } from './MotionDiagnostics';
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
  /** Live tracker numbers, for the operator readout when this screen sticks. */
  diagnostics: RefObject<Diagnostics>;
  /** Fired once, after a player has been held for {@link HOLD_MS}. */
  onReady: () => void;
}

export function MotionCalibration({ status, diagnostics, onReady }: Props): JSX.Element {
  const lang = useLang();
  const firedRef = useRef(false);

  // A locked player is any status where somebody IS there — including
  // 'out-of-area' and 'crowded'. Those are coaching problems, not reasons to
  // refuse to start: a visitor standing slightly too far left should be told so
  // DURING the game, not left staring at a gate that will not open.
  // Anyone the camera can SEE counts as present — including someone standing
  // too close or too far. Those are coaching problems with a specific fix, and
  // refusing to open the gate for them is exactly the dead end reported from
  // the floor: a visitor standing right there, being told to stand there.
  const seen =
    status === 'tracking' ||
    status === 'out-of-area' ||
    status === 'crowded' ||
    status === 'too-close' ||
    status === 'too-far';
  /**
   * Seeing someone is ENOUGH to start. Distance never blocks.
   *
   * It used to, and that was the bug reported from the floor: "it keeps saying
   * come closer and I am already close". A distance estimate can be wrong for
   * reasons the visitor cannot do anything about — a mis-detected pose, an
   * unexpected frame aspect — and when a wrong estimate GATES the game, the
   * visitor is stuck being told to fix something that is not broken, with no
   * way past it. The game never starts, so the play field never appears, which
   * is also why the basket was "missing": it was behind this screen the whole
   * time.
   *
   * So distance is coaching and only coaching. Someone slightly too close still
   * plays — a little worse, and with a line on screen telling them how to make
   * it better.
   */
  const present = seen;
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
      <span className={styles.gateGlow} aria-hidden />
      <div className={styles.gateBody}>
        {status === 'starting' ? (
          <p className={styles.gateSub}>{pick(MOTION.starting, lang)}</p>
        ) : status === 'too-close' ? (
          <>
            <span className={styles.gateGlyph} aria-hidden>
              🔙
            </span>
            <p className={styles.gateLine}>{pick(MOTION.stepBack, lang)}</p>
          </>
        ) : status === 'too-far' ? (
          <>
            <span className={styles.gateGlyph} aria-hidden>
              🔜
            </span>
            <p className={styles.gateLine}>{pick(MOTION.stepCloser, lang)}</p>
          </>
        ) : present ? (
          <p className={`${styles.gateLine} ${styles.gateReady}`}>✓ {pick(MOTION.ready, lang)}</p>
        ) : (
          <>
            <span className={styles.gateGlyph} aria-hidden>
              👋
            </span>
            <p className={styles.gateLine}>{pick(MOTION.stepInFront, lang)}</p>
            {/* The other half of the floor complaint: visitors assumed they had
                to fit their whole body in and kept backing away. */}
            <p className={styles.gateSub}>{pick(MOTION.standHere, lang)}</p>
          </>
        )}

        {/* The wait made visible. Keyed on `present` so stepping out and back
            restarts the bar rather than leaving a stale half-full one. */}
        {present && !held && (
          <div className={styles.holdTrack}>
            <span key={String(present)} className={styles.holdFill} />
          </div>
        )}

        {/* The whole instruction, as a picture. A visitor who reads none of the
            text above still learns what the game wants from these two arrows. */}
        {!seen && (
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

      {/* Shows only after this screen has failed for long enough that the
          visitor is not being served anyway — see the component. */}
      <MotionDiagnostics diagnostics={diagnostics} healthy={seen} />
    </div>
  );
}
