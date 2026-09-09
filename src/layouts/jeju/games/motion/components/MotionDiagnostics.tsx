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
 *   STARTS > 1      the camera is being reopened in a retry loop, which resets
 *                   FRAMES each time — a loop that looks stuck at 1 is usually
 *                   this, not a loop that stopped.
 *   NET loading     the model never became available — the loop is running but
 *                   has nothing to run. Looks identical to an empty room in
 *                   every other field; this is the one that says otherwise.
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
  /** True while the tracker is getting somewhere. Delays the first appearance. */
  healthy: boolean;
}

export function MotionDiagnostics({ diagnostics, healthy }: Props): JSX.Element | null {
  const [show, setShow] = useState(false);
  const [, setTick] = useState(0);

  /**
   * ── Once shown, it STAYS shown ────────────────────────────────────────
   *
   * The first version hid itself the moment anyone was detected, which made it
   * almost useless: it could only ever appear while detection was failing, so
   * it always printed POSE 0 — including when the operator was standing right
   * in front of it, because by then it had already hidden.
   *
   * The whole point is to answer "what happens when I step in", and that needs
   * the numbers to keep updating while someone does exactly that. So `healthy`
   * now only delays the FIRST appearance; after that it latches on for the rest
   * of the calibration screen, and the operator can walk in and out and watch
   * POSE / Q / SIZE move.
   */
  useEffect(() => {
    if (show || healthy) return;
    const id = setTimeout(() => setShow(true), SHOW_AFTER_MS);
    return () => clearTimeout(id);
  }, [healthy, show]);

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
  // A stalled stream looks exactly like an empty room to the model, and is the
  // one fault that is invisible from the picture: the preview shows a frozen
  // frame, which a passer-by reads as a still image rather than a dead feed.
  const stalled = d.stalled;
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
        {d.settled ? '' : ' (probing)'} · NET {d.model}
      </p>
      <p className={styles.diagRow}>
        POSE {d.poses} · Q {d.quality.toFixed(2)} · SIZE {d.size.toFixed(2)}
      </p>
      {/* The best pose seen in the last few seconds. A detection that flickers
          for two frames is invisible in the live row above but is the single
          most useful thing to know — it means the model CAN see the person and
          the problem is stability, not blindness. */}
      <p className={styles.diagRow}>
        PEAK Q {d.peakQuality.toFixed(2)} · FRAMES {d.frames} · STARTS {d.starts}
        {d.stalled ? ' · STREAM STALLED' : ''}
      </p>
      {d.lastError !== '' && <p className={styles.diagRow}>ERR {d.lastError.slice(0, 40)}</p>}
      {d.model !== 'ready' && (
        <p className={styles.diagHint}>
          {d.model === 'failed' ? '⚠ Pose model failed to load' : '⚠ Pose model still loading'}
        </p>
      )}
      {stalled && <p className={styles.diagHint}>⚠ Camera stream not advancing</p>}
      {suspectRotation && !stalled && (
        <p className={styles.diagHint}>⚠ Check the Elgato&apos;s rotation in Windows</p>
      )}
    </div>
  );
}
