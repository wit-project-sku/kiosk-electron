import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import styles from './HwaseongPageBg.module.css';

interface HwaseongPageBgProps {
  /** hwaseongIconUrl key — the 상세 frames use their own lantern art. */
  image?: string;
  /** The image fill's opacity over white, as the frame sets it. */
  opacity?: number;
}

/**
 * Content-page background of the 2026-10 화성휴게소 frames: watercolour art
 * over white, covering the full 2160×3840 artboard. 언어선택 (7904:106237) and
 * 검색 (7909:106539) draw `page-bg` at 60%; 상세 (7956:61089) draws
 * `detail-page-bg` at 70%.
 */
export function HwaseongPageBg({ image = 'page-bg', opacity = 0.6 }: HwaseongPageBgProps): JSX.Element {
  const src = hwaseongIconUrl(image);
  return (
    <div className={styles.bg} aria-hidden>
      {src && <img className={styles.img} style={{ opacity }} src={src} alt="" draggable={false} />}
    </div>
  );
}
