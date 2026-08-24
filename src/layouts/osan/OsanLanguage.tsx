import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { trackEvent } from '@renderer/lib/analytics';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { pick } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { OsanHeader } from './OsanHeader';
import { OsanBanner } from './OsanBanner';
import { OsanLeftNav } from './OsanLeftNav';
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

interface OsanLanguageProps {
  controller: KioskController;
}

export function OsanLanguage({ controller }: OsanLanguageProps): JSX.Element {
  const { navigate, kioskId } = controller;
  const current = useLanguageStore((s) => s.currentLanguage);
  const available = useLanguageStore((s) => s.availableLanguages);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const goHome = (): void => navigate('home', 'Back');
  const langs = available.filter((c) => c in LANG_META);
  const currentMeta = LANG_META[current] ?? LANG_META.ko;

  const choose = (code: SupportedLanguage): void => {
    trackEvent({ name: 'button_clicked', payload: { screen: 'language', key: code, kioskId } });
    void setLanguage(code);
  };

  return (
    <>
      {osanIconUrl('bg') && (
        <img className={styles.bg} src={osanIconUrl('bg')} alt="" draggable={false} />
      )}

      <OsanHeader title={t('Language_Select_Language', current)} onHome={goHome} />

      <div className={styles.area}>
        <section className={styles.section}>
          <div className={styles.label}>
            <span className={styles.bar} />
            {pick(SECTION_LABELS.now, current)}
          </div>
          <div className={`${styles.card} ${styles.currentCard}`}>
            <div className={styles.cardRow}>
              <div className={styles.cardLeft}>
                <span className={`${styles.pill} ${styles.pillOn}`}>{currentMeta.code}</span>
                <span className={styles.langName}>{currentMeta.name}</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.label}>
            <span className={styles.bar} />
            {pick(SECTION_LABELS.change, current)}
          </div>
          <div className={styles.list}>
            {langs.map((code) => {
              const meta = LANG_META[code];
              const selected = code === current;
              return (
                <button
                  key={code}
                  type="button"
                  className={`${styles.card} ${selected ? styles.cardOn : ''}`}
                  onClick={() => choose(code)}
                >
                  <div className={styles.cardRow}>
                    <div className={styles.cardLeft}>
                      <span
                        className={`${styles.pill} ${selected ? styles.pillOn : styles.pillOff}`}
                      >
                        {meta.code}
                      </span>
                      <span className={styles.langName}>{meta.name}</span>
                    </div>
                    {osanIconUrl(selected ? 'checked' : 'check') && (
                      <img
                        className={styles.check}
                        src={osanIconUrl(selected ? 'checked' : 'check')}
                        alt=""
                        draggable={false}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <OsanLeftNav onHome={goHome} />

      <OsanBanner onClick={() => controller.startPhoto()} />
    </>
  );
}
