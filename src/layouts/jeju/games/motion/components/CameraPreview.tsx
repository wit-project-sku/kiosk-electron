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
  /** Draw the body outline the visitor lines up with. Calibration only. */
  silhouette?: boolean;
  /** True once a player is locked — turns the outline green. */
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
        <div className={`${styles.silhouette} ${locked ? styles.silhouetteLocked : ''}`}>
          {/* A head-and-torso outline, not a full body: the 제주 camera crops at
              roughly the hip, so an outline with legs would ask the visitor to
              fit into a shape the frame cannot contain. */}
          <svg className={styles.silhouetteSvg} viewBox="0 0 200 260" fill="none" aria-hidden>
            <circle
              cx="100"
              cy="52"
              r="38"
              stroke={locked ? '#3ddc84' : '#ffffff'}
              strokeWidth="7"
              strokeDasharray={locked ? '0' : '16 14'}
            />
            <path
              d="M42 250 C 42 160 66 112 100 112 C 134 112 158 160 158 250"
              stroke={locked ? '#3ddc84' : '#ffffff'}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={locked ? '0' : '16 14'}
            />
          </svg>
        </div>
      )}

      {trackerX !== null && (
        <div className={styles.tracker}>
          <span className={styles.trackerDot} style={{ left: `${trackerX * 100}%` }} />
        </div>
      )}
    </div>
  );
}
