import type { KioskController } from '@renderer/hooks/useKioskController';
import { ui } from '@renderer/lib/uiText';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useLanguageStore } from '@renderer/store/languageStore';
import { OsanHeader } from './OsanHeader';
import { OsanBanner } from './OsanBanner';
import styles from './OsanWebScreen.module.css';

interface OsanWebScreenProps {
  title: string;
  url: string;
  controller: KioskController;
  /** Override the webview body height in px (default: fills to bottom banner). */
  bodyHeight?: number;
}

/**
 * Embeds an existing website in the BODY region only; header/left-nav/banner are
 * the same as every other Osan content screen. Used for 위드마켓 + 오산시 이벤트.
 */
export function OsanWebScreen({ title, url, controller, bodyHeight }: OsanWebScreenProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLanguageStore((s) => s.currentLanguage);

  return (
    <>
      {osanIconUrl('bg') && <img className={styles.bg} src={osanIconUrl('bg')} alt="" draggable={false} />}

      <OsanHeader title={title} onHome={goHome} />

      <div
        className={styles.body}
        style={bodyHeight !== undefined ? { height: `${bodyHeight}px`, bottom: 'auto' } : undefined}
      >
        {url ? (
          // eslint-disable-next-line react/no-unknown-property
          <webview src={url} partition="persist:embeds" className={styles.embed} />
        ) : (
          <div className={styles.placeholder}>
            <p>{title}</p>
            <p className={styles.placeholderHint}>{ui('noWebsite', lang)}</p>
          </div>
        )}
      </div>

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="홈으로">
          {osanIconUrl('home-btn') && <img src={osanIconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="뒤로">
          {osanIconUrl('back-arrow') && <img src={osanIconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>

      <OsanBanner onClick={() => controller.startPhoto()} />
    </>
  );
}
