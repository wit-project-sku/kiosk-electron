/**
 * The readout that turns "the games are broken" into an actionable fact.
 *
 * ══ WHY THIS IS ON THE SCREEN ═════════════════════════════════════════
 * When the motion games fail, they fail SILENTLY: the calibration gate simply
 * never opens. From in front of the kiosk that looks identical whether
 *
 *   · the wrong camera was opened (the ZED rather than the Elgato),
 *   · the frame arrives in a shape nobody expected,
 *   · the Windows rotation was lost so the model sees a person lying down,
 *   · or the camera is perfect and the room is empty.
 *
 * Nobody can report a useful bug from that. "It says stand in front and I am
 * standing in front" is the complaint it produces, and it names none of the
 * four causes. Meanwhile the person who could read a log file is not the person
 * standing at the kiosk in an airport.
 *
 * So after {@link SHOW_AFTER_MS} of getting nowhere, the numbers go on screen.
 *
 * ── Reading it ────────────────────────────────────────────────────────
 *   CAM 1080×1920   portrait — correct on 제주, the driver is rotating.
 *   CAM 1920×1080   LANDSCAPE — Windows has lost the Elgato's rotation. This
 *                   is the one to check first; see the cameraRotation doc in
 *                   kioskLocations.
 *   CAM 2560×720    the ZED was opened. Should be impossible (excluded by
 *                   label and by aspect) — if it happens, that guard failed.
 *   POSE 0          nobody found at all.
 *   POSE 1 Q 0.2    somebody found, but a poor pose — usually a sideways frame.
 *   SIZE            apparent size; drives the step-closer / step-back hints.
 *
 * ── Why it is not hidden behind a debug flag ──────────────────────────
 * Because the moment it would be useful is a moment nobody can reach a build
 * flag: a kiosk in an airport, an operator on the phone. It costs a visitor
 * nothing — by the time it appears the screen has already failed them, and a
 * visitor who is playing successfully never sees it.
 */
import { useEffect, useState, type RefObject } from 'react';
import type { MotionDiagnostics as Diagnostics } from '../useMotionTracking';
import styles from './motionUi.module.css';

/**
 * How long the gate may get nowhere before showing its working.
 *
 * Long enough that a visitor merely walking up, or the orientation probe doing
 * its rounds (four turns, under seven seconds), never triggers it.
 */
const SHOW_AFTER_MS = 12_000;

/** How often the readout re-reads the ref. Slow — a human is reading it. */
const POLL_MS = 400;

interface Props {
  diagnostics: RefObject<Diagnostics>;
  /** Reset the delay whenever the tracker starts getting somewhere. */
  healthy: boolean;
}

export function MotionDiagnostics({ diagnostics, healthy }: Props): JSX.Element | null {
  const [show, setShow] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (healthy) {
      setShow(false);
      return;
    }
    const id = setTimeout(() => setShow(true), SHOW_AFTER_MS);
    return () => clearTimeout(id);
  }, [healthy]);

  // Poll rather than subscribe: the source is a ref written 20×/s, and a human
  // reading numbers off a wall does not need them at that rate.
  useEffect(() => {
    if (!show) return;
    const id = setInterval(() => setTick((n) => n + 1), POLL_MS);
    return () => clearInterval(id);
  }, [show]);

  if (!show) return null;
  const d = diagnostics.current;
  if (!d) return null;

  const landscape = d.cameraW > d.cameraH;
  // The single most likely fault on this fleet, called out by name rather than
  // left for someone to infer from two numbers.
  const suspectRotation = landscape && d.poses === 0;

  return (
    <div className={styles.diag}>
      <p className={styles.diagRow}>
        CAM {d.cameraW}×{d.cameraH}
        {landscape ? ' (LANDSCAPE)' : ''} · {d.label.slice(0, 28) || 'no label'}
      </p>
      <p className={styles.diagRow}>
        MODEL {d.modelW}×{d.modelH} · ROT {d.rotation}
        {d.settled ? '' : ' (probing)'}
      </p>
      <p className={styles.diagRow}>
        POSE {d.poses} · Q {d.quality.toFixed(2)} · SIZE {d.size.toFixed(2)}
      </p>
      {suspectRotation && (
        <p className={styles.diagHint}>⚠ Check the Elgato&apos;s rotation in Windows</p>
      )}
    </div>
  );
}
