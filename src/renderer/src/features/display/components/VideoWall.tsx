import { useState } from 'react';
import styles from './VideoWall.module.css';

interface VideoWallProps {
  videos: string[];
}

/**
 * Full-screen video for the customer display's default state. A single clip loops
 * forever via the native `loop` attribute; multiple clips advance and wrap.
 */
export function VideoWall({ videos }: VideoWallProps): JSX.Element {
  const [index, setIndex] = useState(0);
  const src = videos[index]!;
  const single = videos.length === 1;

  return (
    <video
      key={src}
      className={styles.video}
      autoPlay
      muted
      loop={single}
      playsInline
      onEnded={(e) => {
        if (single) {
          // Safety net for native `loop` — force replay so it never freezes.
          const v = e.currentTarget;
          v.currentTime = 0;
          void v.play().catch(() => v.load());
        } else {
          setIndex((i) => (i + 1) % videos.length);
        }
      }}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
