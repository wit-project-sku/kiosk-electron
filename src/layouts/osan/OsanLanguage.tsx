/**
 * 오산 언어선택 — Figma 7812:105893 (오산>언어선택).
 *
 * Shared header (title + Language_Content description), 현재 언어 card, then
 * the eight languages as four rows of two (KR VN / EN TH / JP RU / CN ID), the
 * bottom promo banner and the shared left nav. Positions in OsanLanguage.module.css
 * are the frame's values (1 CSS px = 1 Figma px).
 */
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { trackEvent } from '@renderer/lib/analytics';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { pick } from '@renderer/lib/i18n';
import { OsanHeader } from './OsanHeader';
import { OsanBanner } from './OsanBanner';
import { OsanLeftNav } from './OsanLeftNav';
import { OsanPageBg } from './OsanPageBg';
import styles from './OsanLanguage.module.css';

const SECTION_LABELS = {
  now:    { ko: '현재 언어', en: 'Current Language', ja: '現在の言語', zh: '当前语言', vi: 'Ngôn ngữ hiện tại', th: 'ภาษาปัจจุบัน', ru: 'Текущий язык', id: 'Bahasa saat ini' },
  change: { ko: '변경 언어', en: 'Change Language',  ja: '変更する言語', zh: '更改语言', vi: 'Đổi ngôn ngữ', th: 'เปลี่ยนภาษา', ru: 'Сменить язык', id: 'Ubah bahasa' },
};

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

/**
 * Tick per state. The two existing exports are the frame's colours but carry
 * each other's names: `check.png` is the main-01 navy tick the SELECTED card
 * shows, `checked.png` the #D3DFEC one every other card shows.
 */
const TICK_SELECTED = 'check';
const TICK_IDLE = 'checked';

interface OsanLanguageProps {
  controller: KioskController;
}

export function OsanLanguage({ controller }: OsanLanguageProps): JSX.Element {
  const { navigate, kioskId } = controller;
  const current = useLanguageStore((s) => s.currentLanguage);
  const available = useLanguageStore((s) => s.availableLanguages);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const goHome = (): void => navigate('home', 'Back');
  // ♿ low-reach frame (Figma 7878:44195): promo under the bar, header at 723, lists at 1423.
  const low = useAccessibilityStore((s) => s.lowReach);
  const langs = available.filter((c) => c in LANG_META);
  const currentMeta = LANG_META[current] ?? LANG_META.ko;

  const choose = (code: SupportedLanguage): void => {
    trackEvent({ name: 'button_clicked', payload: { screen: 'language', key: code, kioskId } });
    void setLanguage(code);
  };

  return (
    <>
      <OsanPageBg />

      {/* The screen id, not the sheet string: '언어선택' resolves its title
          (Language_Select_Language) and description (Language_Content) through
          i18n, without the sheet's "* " bullet. */}
      {low ? (
        <div style={{ position: 'absolute', top: 723, left: 0, width: 2160, height: 700 }}>
          <OsanHeader title="언어선택" onHome={goHome} />
        </div>
      ) : (
        <OsanHeader title="언어선택" onHome={goHome} />
      )}

      <div className={low ? `${styles.area} ${styles.lowRoot}` : styles.area}>
        <section className={`${styles.section} ${styles.sectionNow}`}>
          <div className={`${styles.label} ${styles.labelNow}`}>
            <span className={styles.bar} />
            {pick(SECTION_LABELS.now, current)}
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
            {pick(SECTION_LABELS.change, current)}
          </div>
          <div className={styles.list}>
            {langs.map((code) => {
              const meta = LANG_META[code];
              const selected = code === current;
              const tick = osanIconUrl(selected ? TICK_SELECTED : TICK_IDLE);
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
                      <span className={`${styles.pill} ${selected ? styles.pillOn : styles.pillOff}`}>
                        {meta.code}
                      </span>
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

      <OsanLeftNav onHome={goHome} />

      <OsanBanner onClick={() => controller.startPhoto()} top={low ? 146 : undefined} />
    </>
  );
}
