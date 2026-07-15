import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { trackEvent } from '@renderer/lib/analytics';
import { useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongLanguage.module.css';

/** Strip a leading "* " marker the sheet prefixes some labels with. */
const clean = (s: string): string => s.replace(/^\s*\*\s*/, '');

interface Props {
  controller: KioskController;
}

// ── Language metadata ──────────────────────────────────
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

// ── SVG icons ──────────────────────────────────────────
function CheckOn(): JSX.Element {
  return (
    <div className={styles.checkOn}>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <path d="M12 34L26 48L52 18" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function CheckOff(): JSX.Element {
  return (
    <div className={styles.checkOff}>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <path d="M12 34L26 48L52 18" stroke="#bbb" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

// ── Main component ─────────────────────────────────────
export function HwaseongLanguage({ controller }: Props): JSX.Element {
  const current    = useLanguageStore((s) => s.currentLanguage);
  const available  = useLanguageStore((s) => s.availableLanguages);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const lang = useLang();

  const currentMeta = LANG_META[current] ?? LANG_META.ko;
  const langs = available.filter((c): c is SupportedLanguage => c in LANG_META);

  function choose(code: SupportedLanguage): void {
    trackEvent({ name: 'button_clicked', payload: { screen: 'language', key: code, kiosk: 'W005' } });
    void setLanguage(code);
  }

  const bgSrc = hwaseongIconUrl('bg');

  return (
    <div className={styles.root}>
      {/* ── Background ── */}
      <div className={styles.bgBase} />
      {bgSrc && <img src={bgSrc} alt="" className={styles.bgImage} draggable={false} />}

      {/* ── Header ────────────────────────────────────── */}
      <HwaseongHeader controller={controller} title="언어선택" />

      {/* ── Language selection area ────────────────────── */}
      <div className={styles.area}>
        {/* 현재 언어 */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>
            <span className={styles.sectionBar} />
            <span className={styles.sectionLabelText}>{clean(t('Language_Now_Language', lang))}</span>
          </div>
          <div className={styles.currentCard}>
            <div className={styles.cardRow}>
              <div className={styles.cardLeft}>
                <span className={styles.pillOn}>{currentMeta.code}</span>
                <span className={styles.langName}>{currentMeta.name}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 변경 언어 */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>
            <span className={styles.sectionBar} />
            <span className={styles.sectionLabelText}>{clean(t('Language_Target_Language', lang))}</span>
          </div>
          <div className={styles.list}>
            {langs.map((code) => {
              const meta = LANG_META[code];
              const selected = code === current;
              return (
                <div
                  key={code}
                  className={`${styles.langCard} ${selected ? styles.langCardOn : ''}`}
                  onClick={() => choose(code)}
                >
                  <div className={styles.cardRow}>
                    <div className={styles.cardLeft}>
                      {selected
                        ? <span className={styles.pillOn}>{meta.code}</span>
                        : <span className={styles.pillOff}>{meta.code}</span>
                      }
                      <span className={styles.langName}>{meta.name}</span>
                    </div>
                    {selected ? <CheckOn /> : <CheckOff />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Left nav (single Figma render) ──────────────── */}
      <div className={styles.leftNav}>
        {hwaseongIconUrl('fg-leftnav') && (
          <img src={hwaseongIconUrl('fg-leftnav')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button type="button" className={styles.leftNavZoneHome} onClick={() => controller.navigate('home')} aria-label="홈" />
        <button type="button" className={styles.leftNavZoneBack} onClick={() => controller.navigate('home')} aria-label="뒤로" />
      </div>

      {/* ── Bottom banner ─────────────────────────────── */}
      <div className={styles.bottomBanner}>
        {hwaseongIconUrl('fg-banner') && (
          <img
            src={hwaseongIconUrl('fg-banner')}
            alt=""
            className={styles.bottomBannerImg}
            draggable={false}
          />
        )}
      </div>
    </div>
  );
}
