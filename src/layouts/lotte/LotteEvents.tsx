/** 롯데 이벤트 — the 제주 이벤트 list and chips on sample rows. MBTI 추천 waits for a server region. */
import { belowModeBar, LOW_REACH_BANNER_HEIGHT } from './lowReach';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { Fragment, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useDetailStore } from '@renderer/store/detailStore';
import { LottePageFrame } from './LottePageFrame';
import { LOTTE_SAMPLE_EVENTS, type SampleEventCategory } from './lotteSample';
import { useLanguageStore } from '@renderer/store/languageStore';
import type { Lang } from '@renderer/lib/i18n';
import { lotteTitle, tc, tcRow } from './lotteCopy';
import { lt } from './lotteText';
import styles from './LotteEvents.module.css';

const TITLE = '롯데 이벤트';
/** Filter chips — the sheet's Tab_All / Event_Filter_* rows, Korean as drawn. */
const CATEGORY_TABS: ReadonlyArray<{ label: string; key: string; value: SampleEventCategory }> = [
  { label: '전체', key: 'Tab_All', value: 'ALL' },
  { label: '공연', key: 'Event_Filter_Show', value: 'SHOW' },
  { label: '전시', key: 'Event_Filter_Exhibit', value: 'EXHIBITION' },
  { label: '기타', key: 'Event_Filter_Etc', value: 'ETC' },
];
const chipLabel = (c: (typeof CATEGORY_TABS)[number], lang: Lang): string =>
  lang === 'ko' ? c.label : lt(c.key, lang, c.label);

export function LotteEvents({ controller }: { controller: KioskController }): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage) as Lang;
  const title = lotteTitle(TITLE, lang);
  const [category, setCategory] = useState<SampleEventCategory>('ALL');
  const setDetail = useDetailStore((s) => s.setItem);
  const items = LOTTE_SAMPLE_EVENTS.filter((e) => category === 'ALL' || e.category === category);
  const open = (e: (typeof LOTTE_SAMPLE_EVENTS)[number]): void => {
    setDetail({
      from: 'events',
      title: TITLE,
      name: e.title,
      category: ((c) => (c ? chipLabel(c, lang) : ''))(CATEGORY_TABS.find((c) => c.value === e.category)),
      photos: [],
      address: e.location,
      hours: '',
      phone: '',
      description: tc('Event_DescPending', lang),
      tags: '',
      rating: '',
      instagram: '',
      blogReviews: '',
    });
    controller.navigate('detail', TITLE);
  };
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  return (
    <LottePageFrame
      controller={controller}
      title={TITLE}
      subtitle={tcRow('MainButton_Event_Subtext', 'Event_Subtitle', lang)}
      bannerFallback="banner-detail"
      /* ♿: JejuEvents' shape — bar, the promo under it, header at bar + 573, the list in
         the middle, the tab row and the category chips at the foot. */
      lowReachModeBar
      lowReachBarBanner
      lowReachShift={belowModeBar(LOW_REACH_BANNER_HEIGHT)}
    >
      <div className={`${styles.tabs} ${lowReach ? `${styles.tabsLow} ${styles.tabsLowSingle}` : ''}`}>
        <button type="button" className={`${styles.tab} ${styles.tabActive}`}>
          {title}
        </button>
      </div>
      <div className={`${styles.chips} ${lowReach ? styles.chipsLow : ''}`}>
        {CATEGORY_TABS.map((c, i) => (
          <Fragment key={c.value}>
            {i > 0 && <span className={styles.chipSep}>ㅣ</span>}
            <button
              type="button"
              className={`${styles.chip} ${c.value === category ? styles.chipActive : ''}`}
              onClick={() => setCategory(c.value)}
            >
              {chipLabel(c, lang)}
            </button>
          </Fragment>
        ))}
      </div>
      <div className={`${styles.listScroll} ${lowReach ? styles.listScrollLow : ''}`}>
        <div className={styles.list}>
          {items.map((e) => (
            <button key={e.id} type="button" className={styles.card} onClick={() => open(e)}>
              <span className={styles.cardThumb} />
              <span className={styles.cardTitle}>{e.title}</span>
              <span className={styles.cardVenue} aria-label={`${lt('Event_Place', lang, '장소')} ${e.location}`}>
                {e.location}
              </span>
            </button>
          ))}
          {/* A chip with nothing under it — the sheet's Event_None. */}
          {items.length === 0 && (
            <p className={styles.cardTitle}>{lt('Event_None', lang, '지금 진행 중인 이벤트가 없습니다')}</p>
          )}
        </div>
      </div>
    </LottePageFrame>
  );
}
