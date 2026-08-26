import type { KioskScreenId } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useLanguageStore } from '@renderer/store/languageStore';
import { OsanHeader } from './OsanHeader';
import { OsanLeftNav } from './OsanLeftNav';
import styles from './OsanScreen.module.css';
import { screenTitle } from '@renderer/lib/i18n';
import { ui } from '@renderer/lib/uiText';


const SCREEN_TITLES: Partial<Record<KioskScreenId, string>> = {
  market:    '위드마켓',
  events:    '오산시 이벤트',
  taxfree:   'TAX-FREE',
  about:     '여기는 오색시장',
  hello:     "안녕 '정이'",
  help:      "도와줘 '정이'",
  map:       '오색시장 지도',
  exchange:  '환율',
  transport: '교통안내',
  palace:    '전국시장',
  museum:    '지역화폐',
  kdrama:    'K-DRAMA',
  restroom:  '화장실 안내',
};

interface OsanScreenProps {
  screen: KioskScreenId;
  controller: KioskController;
}

/**
 * Generic placeholder for Osan screens without dedicated components yet.
 * Shows the screen title and a nav-back button.
 */
export function OsanScreen({ screen, controller }: OsanScreenProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLanguageStore((s) => s.currentLanguage);
  // Localized through the same resolver the real headers use — the placeholder
  // must not be the one screen that shows a raw Korean id.
  const title = screenTitle(SCREEN_TITLES[screen] ?? screen, lang);

  return (
    <>
      {osanIconUrl('bg') && (
        <img className={styles.bg} src={osanIconUrl('bg')} alt="" draggable={false} />
      )}

      <OsanHeader title={title} onHome={goHome} />

      <div className={styles.body}>
        <p className={styles.note}>{ui('comingSoon', lang)}</p>
        <button type="button" className={styles.backBtn} onClick={goHome}>
          {ui('backHome', lang)}
        </button>
      </div>

      <OsanLeftNav onHome={goHome} />
    </>
  );
}
