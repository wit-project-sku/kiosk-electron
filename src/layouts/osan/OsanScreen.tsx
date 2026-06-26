import type { KioskScreenId, SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useLanguageStore } from '@renderer/store/languageStore';
import { OsanHeader } from './OsanHeader';
import styles from './OsanScreen.module.css';

function pick<T>(m: Partial<Record<SupportedLanguage, T>>, lang: SupportedLanguage): T {
  return (m[lang] ?? m.ko ?? (Object.values(m)[0] as T)) as T;
}

const T = {
  comingSoon: { ko: '준비 중입니다', en: 'Coming soon', ja: '準備中です', zh: '准备中' },
  home: { ko: '← 홈으로', en: '← Home', ja: '← ホームへ', zh: '← 返回主页' },
};

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
  const title = SCREEN_TITLES[screen] ?? screen;

  return (
    <>
      {osanIconUrl('bg') && (
        <img className={styles.bg} src={osanIconUrl('bg')} alt="" draggable={false} />
      )}

      <OsanHeader title={title} onHome={goHome} />

      <div className={styles.body}>
        <p className={styles.note}>{pick(T.comingSoon, lang)}</p>
        <button type="button" className={styles.backBtn} onClick={goHome}>
          {pick(T.home, lang)}
        </button>
      </div>

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="홈으로">
          {osanIconUrl('home-btn') && (
            <img src={osanIconUrl('home-btn')} alt="" draggable={false} />
          )}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="뒤로">
          {osanIconUrl('back-arrow') && (
            <img src={osanIconUrl('back-arrow')} alt="" draggable={false} />
          )}
        </button>
      </div>
    </>
  );
}
