/**
 * 제주공항 언어선택 — Figma node 6212:50714 (제주>언어선택), 2026-08 redesign.
 *
 * Reuses the shared language state (languageStore) and the JejuPageFrame chrome;
 * only the 현재 언어 / 변경 언어 body is Jeju-specific.
 */
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { trackEvent } from '@renderer/lib/analytics';
import { useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { JejuPageFrame } from './JejuPageFrame';
import styles from './JejuLanguage.module.css';

interface Props {
  controller: KioskController;
}

/** Strip a leading "* " marker the sheet prefixes some labels with. */
const clean = (s: string): string => s.replace(/^\s*\*\s*/, '');

/**
 * Pill code + display name per language.
 *
 * Every name is the language's ENDONYM — what it calls itself — so a visitor who
 * reads no Korean can still find their own row. The Jeju Figma draws ID as
 * 인도네시아어, the one entry written in Korean; deliberately not followed, since
 * an Indonesian speaker cannot read the label that is meant to identify their
 * language. "Indonesia" is also what Hwaseong, Insadong and Osan already draw.
 *
 * CN still reads 中國語 as the Jeju Figma has it, where the other layouts differ.
 */
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

/** Grid geometry (see JejuLanguage.module.css). */
const CARD_COL_X = [0, 945];
const CARD_ROW_STEP = 420;

export function JejuLanguage({ controller }: Props): JSX.Element {
  const current = useLanguageStore((s) => s.currentLanguage);
  const available = useLanguageStore((s) => s.availableLanguages);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const lang = useLang();

  const currentMeta = LANG_META[current] ?? LANG_META.ko;
  const langs = available.filter((c): c is SupportedLanguage => c in LANG_META);

  /**
   * The Figma reads KR·VN / EN·TH / JP·RU / CN·ID — that is the app's own
   * LANGUAGES order laid out COLUMN-major, not row-major: the left column is the
   * first half of the list and the right column the second. Chunking that way
   * keeps the design's reading order while staying driven by the store.
   */
  const half = Math.ceil(langs.length / 2);
  const rows = Array.from({ length: half }, (_, i) => [langs[i], langs[i + half]]);

  function choose(code: SupportedLanguage): void {
    trackEvent({ name: 'button_clicked', payload: { screen: 'language', key: code, kioskId: controller.kioskId } });
    void setLanguage(code);
  }

  return (
    /* This page's ♿ frame (6286:24611) is on the 2026-08-26 mode-bar revision:
       bar at the top, no promo banner, header y113, body +420 (언어선택영역
       y700 → y1120, measured). */
    <JejuPageFrame
      controller={controller}
      title="언어선택"
      lowReachModeBar
      lowReachShift={113}
      lowReachBodyShift={420}
    >
      <div className={styles.area}>
        {/* ── 현재 언어 ── */}
        <div className={`${styles.label} ${styles.labelCurrent}`}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>{clean(t('Language_Now_Language', lang))}</p>
        </div>

        <div className={styles.currentCard}>
          <div className={styles.cardLeft}>
            <span className={`${styles.pill} ${styles.pillOn}`}>{currentMeta.code}</span>
            <p className={styles.langName}>{currentMeta.name}</p>
          </div>
        </div>

        {/* ── 변경 언어 ── */}
        <div className={`${styles.label} ${styles.labelTarget}`}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>{clean(t('Language_Target_Language', lang))}</p>
        </div>

        <div className={styles.grid}>
          {rows.map((row, r) =>
            row.map((code, c) => {
              if (!code) return null;
              const meta = LANG_META[code];
              const selected = code === current;
              // check-off-lang, not the shared check-off: this screen's Figma
              // fills the empty tick with #FFEAC7 ([제주] main 02) while
              // JejuPhotoRegister's still specifies #FFE0C4.
              const check = jejuIconUrl(selected ? 'check-on' : 'check-off-lang');
              return (
                <button
                  key={code}
                  type="button"
                  className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
                  style={{ left: CARD_COL_X[c], top: r * CARD_ROW_STEP }}
                  onClick={() => choose(code)}
                >
                  <span className={styles.cardLeft}>
                    <span className={`${styles.pill} ${selected ? styles.pillOn : styles.pillOff}`}>
                      {meta.code}
                    </span>
                    <span className={styles.langName}>{meta.name}</span>
                  </span>
                  {check && <img src={check} alt="" className={styles.check} draggable={false} />}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </JejuPageFrame>
  );
}
