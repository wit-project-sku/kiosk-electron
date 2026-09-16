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
  /** Draw the outline the visitor lines up with. Calibration only. */
  silhouette?: boolean;
  /**
   * WHICH outline to draw.
   *
   * 'hand' is what a visitor is asked for and therefore the default; 'body' is
   * drawn only once the tracker has actually fallen back to it, because an
   * outline is an instruction and drawing both would be two.
   */
  guide?: 'hand' | 'body';
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
  guide = 'hand',
  locked = false,
  trackerX = null,
  className,
  style,
}: Props): JSX.Element {
  const quarter = rotation === 90 || rotation === 270;
  const stroke = locked ? '#3ddc84' : '#ffffff';
  const dash = locked ? '0' : '16 14';

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
          {guide === 'hand' ? (
            /* An open palm, which is the whole instruction: the visitor lines
               their own hand up with it and the game starts. Deliberately drawn
               large and central rather than as a small target — the outline is
               a picture of the GESTURE, not of where to put it, and a visitor
               who reads no text at all still learns the game from it. */
            <svg className={styles.silhouetteSvg} viewBox="0 0 200 260" fill="none" aria-hidden>
              {/* Palm. */}
              <path
                d="M62 150 C 62 118 70 104 84 104 L 122 104 C 136 104 144 118 144 150
                   L 144 186 C 144 222 124 244 100 244 C 76 244 56 222 56 186 Z"
                stroke={stroke}
                strokeWidth="7"
                strokeLinejoin="round"
                strokeDasharray={dash}
              />
              {/* Four fingers, splayed the way an open hand actually sits. */}
              <path d="M70 108 L 64 56" stroke={stroke} strokeWidth="7" strokeLinecap="round" strokeDasharray={dash} />
              <path d="M92 104 L 90 40" stroke={stroke} strokeWidth="7" strokeLinecap="round" strokeDasharray={dash} />
              <path d="M114 104 L 118 44" stroke={stroke} strokeWidth="7" strokeLinecap="round" strokeDasharray={dash} />
              <path d="M134 110 L 144 66" stroke={stroke} strokeWidth="7" strokeLinecap="round" strokeDasharray={dash} />
              {/* Thumb. */}
              <path d="M60 158 L 26 132" stroke={stroke} strokeWidth="7" strokeLinecap="round" strokeDasharray={dash} />
            </svg>
          ) : (
            /* A head-and-torso outline, not a full body: the 제주 camera crops at
               roughly the hip, so an outline with legs would ask the visitor to
               fit into a shape the frame cannot contain. */
            <svg className={styles.silhouetteSvg} viewBox="0 0 200 260" fill="none" aria-hidden>
              <circle cx="100" cy="52" r="38" stroke={stroke} strokeWidth="7" strokeDasharray={dash} />
              <path
                d="M42 250 C 42 160 66 112 100 112 C 134 112 158 160 158 250"
                stroke={stroke}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={dash}
              />
            </svg>
          )}
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
