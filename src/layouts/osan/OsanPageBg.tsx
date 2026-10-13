import { osanIconUrl } from '@renderer/assets/icons/osan';
import styles from './OsanPageBg.module.css';

/**
 * Content-page background of the 2026-10 Osan frames (first seen on 오산>언어선택
 * 7812:107953): the watercolour 한옥 art at 70% opacity over white, covering the
 * full 2160×3840 artboard. page-bg.png is the designer's full-size 2160×3840
 * file with that 70% already composited, so it is drawn at full opacity.
 * Every Osan content page draws the same file (`osanIconUrl('page-bg')`).
 */
export function OsanPageBg(): JSX.Element {
  const src = osanIconUrl('page-bg');
  return (
    <div className={styles.bg} aria-hidden>
      {src && <img className={styles.img} src={src} alt="" draggable={false} />}
    </div>
  );
}
