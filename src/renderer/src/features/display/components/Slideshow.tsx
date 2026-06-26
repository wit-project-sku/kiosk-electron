import { useEffect, useState } from 'react';
import type { ImageAsset } from '@shared/types/domain';
import { assetUrl, isVideo } from '@renderer/lib/media';
import styles from './Slideshow.module.css';

interface SlideshowProps {
  assets: ImageAsset[];
  intervalMs: number;
}

/**
 * Auto-advancing slideshow with a cross-fade. The interval timer is reset
 * whenever the asset set or interval changes, and cleared on unmount to avoid
 * leaking timers during long-running kiosk sessions.
 */
export function Slideshow({ assets, intervalMs }: SlideshowProps): JSX.Element {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [assets]);

  useEffect(() => {
    if (assets.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % assets.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [assets, intervalMs]);

  return (
    <div className={styles.slideshow}>
      {assets.map((asset, i) => (
        <div key={asset.id} className={`${styles.slide} ${i === index ? styles.active : ''}`}>
          {isVideo(asset) ? (
            <video className={styles.media} src={assetUrl(asset)} autoPlay muted loop />
          ) : (
            <img className={styles.media} src={assetUrl(asset)} alt="" />
          )}
        </div>
      ))}
    </div>
  );
}
