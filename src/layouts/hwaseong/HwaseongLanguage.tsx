/**
 * 화성휴게소 언어선택 — Figma 7904:105945.
 *
 * Shared header (title + Language_Content description), 현재 언어 card, then
 * the eight languages as four rows of two (KR VN / EN TH / JP RU / CN ID), the
 * bottom promo banner and the shared left nav. Positions in
 * HwaseongLanguage.module.css are the frame's values (1 CSS px = 1 Figma px).
 *
 * The frame's bottom banner is a 제주 placeholder (#제주도 #혼저옵서예); the page
 * keeps HwaseongBanner, which shows the live 화성 banner.
 */
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { trackEvent } from '@renderer/lib/analytics';
import { useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { HwaseongHeader } from './HwaseongHeader';
import { HwaseongBanner } from './HwaseongBanner';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import { HwaseongPageBg } from './HwaseongPageBg';
import styles from './HwaseongLanguage.module.css';

/** Strip a leading "* " marker the sheet prefixes some labels with. */
const clean = (s: string): string => s.replace(/^\s*\*\s*/, '');

interface Props {
  controller: KioskController;
}

const LANG_META: Record<SupportedLanguage, { code: string; name: string }> = {
  ko:    { code: 'KR', name: '한국어' },
  en:    { code: 'EN', name: 'English' },
  ja:    { code: 'JP', name: '日本語' },
  zh:    { code: 'CN', name: '中國語' },
  zh_cn: { code: 'CN', name: '中文(简)' },
  zh_tw: { code: 'CN', name: '中文(繁)' },
  vi:    { code: 'VN', name: 'Tiếng Việt' },
  th:    { code: 'TH', name: 'ภาษาไทย' },
  ru:    { code: 'RU', name: 'Русский' },
  id:    { code: 'ID', name: 'Indonesia' },
  es:    { code: 'ES', name: 'Español' },
};

export function HwaseongLanguage({ controller }: Props): JSX.Element {
  const current = useLanguageStore((s) => s.currentLanguage);
  const available = useLanguageStore((s) => s.availableLanguages);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const lang = useLang();

  const currentMeta = LANG_META[current] ?? LANG_META.ko;
  const langs = available.filter((c): c is SupportedLanguage => c in LANG_META);
  const goHome = (): void => controller.navigate('home', 'Back');
  // ♿ (Figma 7904:105977): promo under the mode bar, header at 723, lists at 1423.
  const low = useAccessibilityStore((s) => s.lowReach);

  function choose(code: SupportedLanguage): void {
    trackEvent({ name: 'button_clicked', payload: { screen: 'language', key: code, kiosk: 'W005' } });
    void setLanguage(code);
  }

  return (
    <div className={styles.root}>
      <HwaseongPageBg />

      {low ? (
        <div style={{ position: 'absolute', top: 723, left: 0, width: 2160, height: 700 }}>
          <HwaseongHeader controller={controller} title="언어선택" />
        </div>
      ) : (
        <HwaseongHeader controller={controller} title="언어선택" />
      )}

      <div className={low ? `${styles.area} ${styles.lowRoot}` : styles.area}>
        <section className={`${styles.section} ${styles.sectionNow}`}>
          <div className={`${styles.label} ${styles.labelNow}`}>
            <span className={styles.bar} />
            {clean(t('Language_Now_Language', lang))}
          </div>
          <div className={styles.currentCard}>
            <div className={styles.currentRow}>
              <span className={`${styles.pill} ${styles.pillOn}`}>{currentMeta.code}</span>
              <span className={styles.currentName}>{currentMeta.name}</span>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={`${styles.label} ${styles.labelChange}`}>
            <span className={styles.bar} />
            {clean(t('Language_Target_Language', lang))}
          </div>
          <div className={styles.list}>
            {langs.map((code) => {
              const meta = LANG_META[code];
              const selected = code === current;
              const tick = hwaseongIconUrl(selected ? 'lang-check-on' : 'lang-check-off');
              return (
                <button
                  key={code}
                  type="button"
                  className={`${styles.card} ${selected ? styles.cardOn : ''}`}
                  onClick={() => choose(code)}
                  aria-pressed={selected}
                >
                  <span className={styles.cardRow}>
                    <span className={styles.cardLeft}>
                      <span className={`${styles.pill} ${selected ? styles.pillOn : styles.pillOff}`}>{meta.code}</span>
                      <span className={styles.langName}>{meta.name}</span>
                    </span>
                    {tick && <img className={styles.check} src={tick} alt="" draggable={false} />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <HwaseongLeftNav onHome={goHome} />

      <HwaseongBanner onClick={() => controller.startPhoto()} top={low ? 146 : undefined} />
    </div>
  );
}
