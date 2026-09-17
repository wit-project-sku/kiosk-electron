/**
 * The visitor watching themselves.
 *
 * ── Why every motion game shows this ──────────────────────────────────
 * A camera-controlled game with no preview feels haunted: things happen and the
 * player cannot tell whether the kiosk is responding to THEM, to someone behind
 * them, or to nothing. The preview is the feedback loop that makes the control
 * legible — and it is also the thing that makes the camera's presence honest,
 * which on a public kiosk matters as much as the gameplay.
 *
 * It matters more now the controller is a HAND. A visitor moving their whole
 * body can feel what they are doing; a visitor holding a hand up cannot tell
 * whether it is the hand being tracked, the other one, or nothing at all —
 * seeing it inside the outline is the only answer.
 *
 * The <video> element itself is owned by `useMotionTracking` (it is what the
 * stream attaches to and what MediaPipe reads); this component only decides
 * where it is drawn and how big. That is why the ref is passed IN rather than
 * created here — there is exactly one stream, and one element consuming it.
 */
import type { CSSProperties, RefObject } from 'react';
import styles from './motionUi.module.css';

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Mount rotation of the venue camera, from kioskLocations. */
  rotation: 0 | 90 | 180 | 270;
  /** Draw the hand guide over the picture. Calibration only. */
  silhouette?: boolean;
  /**
   * WHICH guide to draw.
   *
   * 'hand' is what a visitor is asked for and therefore the default; 'body' is
   * drawn only once the tracker has actually fallen back to it, because a guide
   * is an instruction and drawing both would be two.
   */
  guide?: 'hand' | 'body';
  /** True once a player is locked — turns the frame green. */
  locked?: boolean;
  /** 0..1 marker showing where the game thinks the player is. */
  trackerX?: number | null;
  className?: string;
  style?: CSSProperties;
}

export function CameraPreview({
  videoRef,
  rotation,
  silhouette = false,
  guide = 'hand',
  locked = false,
  trackerX = null,
  className,
  style,
}: Props): JSX.Element {
  const quarter = rotation === 90 || rotation === 270;

  return (
    <div
      className={`${styles.preview} ${quarter ? styles.previewQuarter : ''} ${className ?? ''}`}
      style={style}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        // `autoPlay` is deliberately absent: the stream is attached and played
        // imperatively by the tracking hook, and letting the element also try
        // races the two.
        aria-hidden="true"
        className={styles.previewVideo}
        style={{ ['--mp-rotate' as string]: `${rotation}deg` }}
      />

      {silhouette && (
        <>
          {/* The instruction as the visitor already knows it: a hand icon, not a
              traced outline. A 🧍 only once the tracker has fallen back to a body,
              because an icon is an instruction and drawing both would be two. */}
          <div className={`${styles.guide} ${locked ? styles.guideLocked : ''}`}>
            <span className={styles.guideGlyph} aria-hidden>
              {guide === 'hand' ? '✋' : '🧍'}
            </span>
          </div>
          <span className={styles.previewRing} aria-hidden />
        </>
      )}

      {trackerX !== null && (
        <div className={styles.tracker}>
          <span className={styles.trackerDot} style={{ left: `${trackerX * 100}%` }} />
        </div>
      )}
    </div>
  );
}
