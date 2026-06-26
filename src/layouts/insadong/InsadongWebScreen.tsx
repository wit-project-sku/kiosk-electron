import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { InsadongHeader } from './InsadongHeader';
import styles from './InsadongWebScreen.module.css';

interface InsadongWebScreenProps {
  title: string;
  url: string;
  controller: KioskController;
  /** Override the webview body height in px (default: fills to bottom banner). */
  bodyHeight?: number;
}

/**
 * Embeds an existing website in the BODY region only; the header (InsadongHeader),
 * left nav, and bottom banner are the same as every other Figma content screen.
 * Used for 위드마켓 (WITStore) and 인사동 이벤트.
 */
export function InsadongWebScreen({ title, url, controller, bodyHeight }: InsadongWebScreenProps): JSX.Element {
  const banner = useRotatingBanner();
  const goHome = (): void => controller.navigate('home', 'Back');

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title={title} onHome={goHome} />

      <div className={styles.body} style={bodyHeight !== undefined ? { height: `${bodyHeight}px`, bottom: 'auto' } : undefined}>
        {url ? (
          // eslint-disable-next-line react/no-unknown-property
          <webview src={url} partition="persist:embeds" className={styles.embed} />
        ) : (
          <div className={styles.placeholder}>
            <p>{title}</p>
            <p className={styles.placeholderHint}>웹사이트 주소가 설정되지 않았습니다</p>
          </div>
        )}
      </div>

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="홈으로">
          {iconUrl('home-btn') && <img src={iconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="뒤로">
          {iconUrl('back-arrow') && <img src={iconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>

      {banner && (
        <button type="button" className={styles.banner} onClick={() => controller.startPhoto()} aria-label="가상 한복 체험">
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </>
  );
}
