import type { DisplayClip } from '@renderer/lib/videoMap';
import logoUrl from '@renderer/assets/icons/insadong/park-sul-nyeo-logo.svg';
import styles from './AiModelVideoWall.module.css';

interface AiModelVideoWallProps {
  /** Ordered clips for the current screen; the first one loops forever. */
  clips: DisplayClip[];
  /** Hide the built-in top-right label (the generating screen renders its own). */
  hideLabel?: boolean;
}

/**
 * Plays ONE AI-model video for the current kiosk screen on the customer display,
 * looping forever (native `loop`) until the screen changes — with the ambassador
 * label (top-right) and subtitle (bottom).
 *
 * Looping a single element is the only way to get truly smooth, never-pausing,
 * never-advancing playback; cycling multiple clips always introduced a load gap.
 */
export function AiModelVideoWall({ clips, hideLabel = false }: AiModelVideoWallProps): JSX.Element | null {
  const clip = clips[0];
  if (!clip) return null;

  return (
    <div className={styles.wrap}>
      <video
        key={clip.url}
        className={`${styles.video} ${styles.show}`}
        src={clip.url}
        autoPlay
        muted
        playsInline
        loop
        preload="auto"
        onEnded={(e) => {
          // Safety net: if native `loop` ever fails to rewind, force a replay so
          // the kiosk video never freezes on its last frame.
          const v = e.currentTarget;
          v.currentTime = 0;
          void v.play().catch(() => v.load());
        }}
      />

      {/* PARK SUL NYEO brand logo, top-left (matches the ambassador screen design). */}
      {!hideLabel && <img className={styles.logo} src={logoUrl} alt="" draggable={false} />}

      {!hideLabel && clip.label && <div className={styles.label}>{clip.label}</div>}
      {clip.subtitle && <div className={styles.subtitle}>{clip.subtitle}</div>}
    </div>
  );
}
