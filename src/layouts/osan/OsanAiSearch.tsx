import { useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useAiStore } from '@renderer/store/aiStore';
import { useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { AI_CATEGORIES_OSAEK } from '@renderer/data/aiCategories-osaek.generated';
import { pickText } from '@renderer/data/types';
import { interestColor } from './interestColors';

/** Drop blank rows the sheet leaves behind so no nameless tiles render. */
const AI_CATEGORIES = AI_CATEGORIES_OSAEK.filter((c) => c.ko.trim() !== '');
import { OsanHeader } from './OsanHeader';
import { OsanBanner } from './OsanBanner';
import styles from './OsanAiSearch.module.css';

const VISITORS: { key: string; width: number }[] = [
  { key: 'Visitor_1', width: 268 },
  { key: 'Visitor_2', width: 268 },
  { key: 'Visitor_3', width: 268 },
  { key: 'Visitor_4', width: 268 },
  { key: 'Visitor_5', width: 268 },
  { key: 'Visitor_6', width: 268 },
];
const DURATION: { key: string; width: number }[] = [
  { key: 'StayTime_02', width: 411 },
  { key: 'StayTime_24', width: 411 },
  { key: 'StayTime_46', width: 411 },
  { key: 'StayTime_66', width: 361 },
];

interface OsanAiSearchProps {
  controller: KioskController;
}

export function OsanAiSearch({ controller }: OsanAiSearchProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLang();
  const setAiInterests = useAiStore((s) => s.setInterests);
  const [visitors, setVisitors] = useState('Visitor_2');
  const [duration, setDuration] = useState('StayTime_24');
  const [interests, setInterests] = useState<Set<number>>(() => new Set([0]));

  const MAX_INTERESTS = 3;
  const toggleInterest = (i: number): void =>
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else if (next.size < MAX_INTERESTS) next.add(i);
      return next;
    });

  const submit = (): void => {
    const labels = [...interests].map((i) => AI_CATEGORIES[i]!.ko);
    setAiInterests(labels);
    controller.navigate('ai_result', 'AI 추천');
  };

  return (
    <>
      {osanIconUrl('bg') && (
        <img className={styles.bg} src={osanIconUrl('bg')} alt="" draggable={false} />
      )}

      <OsanHeader title="'정이' 모하지 (AI 검색)" onHome={goHome} />

      <div className={styles.content}>
        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            <span className={styles.bar} />
            {t('VisitorCount', lang)}
          </div>
          <div className={styles.pillRow}>
            {VISITORS.map((v) => (
              <button
                key={v.key}
                type="button"
                style={{ width: `${v.width}px` }}
                className={`${styles.pill} ${visitors === v.key ? styles.pillSel : ''}`}
                onClick={() => setVisitors(v.key)}
              >
                {t(v.key, lang)}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            <span className={styles.bar} />
            {t('StayTime', lang)}
          </div>
          <div className={styles.pillRow}>
            {DURATION.map((d) => (
              <button
                key={d.key}
                type="button"
                style={{ width: `${d.width}px` }}
                className={`${styles.pill} ${duration === d.key ? styles.pillSel : ''}`}
                onClick={() => setDuration(d.key)}
              >
                {t(d.key, lang)}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            <span className={styles.bar} />
            {t('JoyContent', lang)}
          </div>
          <div className={styles.tileGrid}>
            {AI_CATEGORIES.map((cat, i) => {
              const selected = interests.has(i);
              return (
                <button
                  key={`${cat.ko}-${i}`}
                  type="button"
                  className={`${styles.tile} ${selected ? styles.tileSel : ''}`}
                  onClick={() => toggleInterest(i)}
                >
                  <span
                    className={styles.tileText}
                    style={selected ? undefined : { color: interestColor(cat.ko) }}
                  >
                    {pickText(cat, lang)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <button type="button" className={styles.cta} onClick={submit}>
          {t('AI_SubmitButton', lang)}
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

      <OsanBanner onClick={() => controller.startPhoto()} />
    </>
  );
}
