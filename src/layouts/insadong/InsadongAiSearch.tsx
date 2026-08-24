import { useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useAiStore } from '@renderer/store/aiStore';
import { useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { AI_CATEGORIES } from '@renderer/data/aiCategories.generated';
import { aiCatLabel } from '@renderer/lib/aiCategoryLabel';
import { InsadongHeader } from './InsadongHeader';
import { InsadongLeftNav } from './InsadongLeftNav';
import styles from './InsadongAiSearch.module.css';

/** 방문 인원 / 체류 시간 pills — Localization key + Figma fixed widths. */
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

/** Per-tile 즐길거리 text colours (Figma), zipped by index with AI_CATEGORIES. */
const INTEREST_COLORS = [
  '#f59993', '#f59993', '#f59993', '#f59993', '#f59993', '#f59993', '#f59993', '#f59993', '#f59993', '#ffa37e',
  '#ffa37e', '#8bceaf', '#81caa8', '#ada6ef', '#ada6ef', '#ada6ef', '#ada6ef', '#6ea8eb', '#6ea8eb', '#6ea8eb',
  '#6ea8eb', '#6ea8eb', '#6375bf', '#6375bf', '#6375bf', '#6375bf', '#c89b7b', '#c89b7b', '#c89b7b', '#c89b7b',
];

interface InsadongAiSearchProps {
  controller: KioskController;
  debug?: boolean;
}

/** '인사' 뭐하지 (AI검색) — preference questionnaire feeding the AI recommendation. */
export function InsadongAiSearch({ controller }: InsadongAiSearchProps): JSX.Element {
  const banner = useRotatingBanner();
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
      else if (next.size < MAX_INTERESTS) next.add(i); // up to 3
      return next;
    });

  const submit = (): void => {
    // Pass the chosen interest names (canonical Korean, in selection order).
    const labels = [...interests].map((i) => AI_CATEGORIES[i]!.ko);
    setAiInterests(labels);
    controller.navigate('ai_result', 'AI 추천');
  };

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title="‘인사’ 뭐하지 (AI 검색)" onHome={goHome} />

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
                  <span className={styles.tileText} style={selected ? undefined : { color: INTEREST_COLORS[i] }}>
                    {aiCatLabel(cat, lang)}
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

      <InsadongLeftNav onHome={goHome} />

      {banner && (
        <button type="button" className={styles.banner} onClick={() => controller.startPhoto()} aria-label="가상 한복 체험">
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </>
  );
}
