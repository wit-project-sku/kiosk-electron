/**
 * The shell every 제주 motion game sits in — on the CUSTOMER DISPLAY.
 *
 * ══ THIS IS A MONITOR 2 COMPONENT ═════════════════════════════════════
 * Motion games are played on the big screen, and this shell is built for a
 * surface with NO TOUCH: no header, no 홈/뒤로, no banner, no buttons anywhere.
 * The visitor is standing two metres back with their hands in the air — every
 * control lives on Monitor 1's remote (see MotionRemote), and anything
 * pressable drawn here would be a control nobody can reach.
 *
 * It deliberately does NOT wrap `GameShell`, which is the touch games' chrome.
 *
 * ══ WHY THE PREVIEW LIVES HERE AND NOWHERE ELSE ═══════════════════════
 * There is exactly ONE <video> element on a motion-game screen and it is
 * rendered here, once, for the whole life of the screen.
 *
 * That is not tidiness, it is correctness. The MediaStream is attached to a
 * specific element by `useMotionTracking`, and MediaPipe reads frames from that
 * same element every 50 ms. If the preview were rendered inside the calibration
 * gate and again inside the play field — the obvious way to write this — React
 * would unmount one and mount the other at the phase change, `videoRef.current`
 * would swap to a fresh element with no `srcObject`, and the tracker would
 * spend the rest of the game reading a detached element that produces no
 * frames. The game would open perfectly, then freeze the instant it started.
 *
 * So the preview never changes parents. It only changes CSS coordinates, which
 * is also why the shrink from centre-stage to corner is a smooth transition
 * rather than a cut: the visitor watches the thing that verified them become
 * the thing that confirms it still sees them.
 *
 * ── Reporting ─────────────────────────────────────────────────────────
 * Every phase, score and tracking change is pushed to main from here rather
 * than from each game, so all three report identically and none of them has to
 * know that a second screen exists.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { GameCountdown } from '../../components/GameCountdown';
import type { MotionPhase } from '../poseTypes';
import type { MotionTracking } from '../useMotionTracking';
import { CameraPreview } from './CameraPreview';
import { MotionCalibration } from './MotionCalibration';
import { MotionCoach } from './MotionCoach';
import styles from './motionUi.module.css';
// The shared primitives' own module, for the one class that recolours them all
// for a dark screen — see `.onDark` there.
import shared from '../../components/gameUi.module.css';

interface Props {
  title: string;
  subtitle: string;
  tracking: MotionTracking;
  phase: MotionPhase;
  /** Live score, pushed up to Monitor 1's remote. */
  score: number;
  /** Set once, on the transition into `result`. Banked as JEJU POINTS by M1. */
  finalScore?: number | null;
  /** The gate locked a player. */
  onReady: () => void;
  /** The 3·2·1 finished. */
  onCountdownDone: () => void;
  /** One short line under the countdown number. */
  countdownHint: string;
  /** HUD row, positioned on the artboard by the game. */
  hud?: ReactNode;
  /** The play field. */
  children: ReactNode;
  /** The score card, or null while playing. */
  result?: ReactNode;
}

export function MotionStage({
  title,
  subtitle,
  tracking,
  phase,
  score,
  finalScore = null,
  onReady,
  onCountdownDone,
  countdownHint,
  hud,
  children,
  result,
}: Props): JSX.Element {
  // The preview shows `tracking.rotation`, not the venue config: the tracker's
  // orientation probe can overrule the config (see useMotionTracking), and a
  // probed-into-place camera must not leave the visitor watching themselves
  // sideways while the game tracks them correctly.
  const calibrating = phase === 'calibrating';

  /**
   * Push progress to main, which broadcasts it to Monitor 1's remote.
   *
   * Keyed on the values themselves rather than run per frame: the remote shows
   * a score and a phase, both of which change a handful of times a second at
   * most. An IPC message per animation frame would be sixty a second to move a
   * number that has not changed.
   */
  const lastRef = useRef('');
  useEffect(() => {
    const signature = `${phase}|${score}|${tracking.status}|${finalScore ?? ''}`;
    if (signature === lastRef.current) return;
    lastRef.current = signature;
    void window.api.motion.report({ phase, score, tracking: tracking.status, finalScore });
  }, [phase, score, tracking.status, finalScore]);

  return (
    <div className={`${styles.displayRoot} ${shared.onDark}`}>
      <h1 className={styles.displayTitle}>{title}</h1>
      <p className={styles.displaySubtitle}>{subtitle}</p>
      <span className={styles.displayRule} aria-hidden />

      {hud}

      <div className={styles.displayField}>{children}</div>

      {calibrating && <MotionCalibration status={tracking.status} onReady={onReady} />}

      {/* Rendered on EVERY phase, always the same element — see the header;
          this is the single most important line in the file. It is only VISIBLE
          during calibration, where the visitor needs to see themselves to line
          up. Once the game starts it shrinks to a transparent pixel that keeps
          decoding (see `.previewHidden`), because unmounting it would detach
          the stream the tracker is reading. */}
      <CameraPreview
        videoRef={tracking.videoRef}
        rotation={tracking.rotation}
        silhouette={calibrating}
        locked={
          tracking.status === 'tracking' ||
          tracking.status === 'out-of-area' ||
          tracking.status === 'crowded'
        }
        className={calibrating ? styles.previewGate : styles.previewHidden}
      />

      {phase === 'countdown' && <GameCountdown onDone={onCountdownDone} hint={countdownHint} />}

      {phase === 'playing' && <MotionCoach status={tracking.status} />}

      {result}
    </div>
  );
}
