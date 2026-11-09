/** 롯데 이벤트 — the 제주 이벤트 list and chips on sample rows. MBTI 추천 waits for a server region. */
import { Fragment, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useDetailStore } from '@renderer/store/detailStore';
import { LottePageFrame } from './LottePageFrame';
import { LOTTE_SAMPLE_EVENTS, type SampleEventCategory } from './lotteSample';
import styles from './LotteEvents.module.css';

const TITLE = '롯데 이벤트';
const CATEGORY_TABS: ReadonlyArray<{ label: string; value: SampleEventCategory }> = [
  { label: '전체', value: 'ALL' },
  { label: '공연', value: 'SHOW' },
  { label: '전시', value: 'EXHIBITION' },
  { label: '기타', value: 'ETC' },
];

export function LotteEvents({ controller }: { controller: KioskController }): JSX.Element {
  const [category, setCategory] = useState<SampleEventCategory>('ALL');
  const setDetail = useDetailStore((s) => s.setItem);
  const items = LOTTE_SAMPLE_EVENTS.filter((e) => category === 'ALL' || e.category === category);
  const open = (e: (typeof LOTTE_SAMPLE_EVENTS)[number]): void => {
    setDetail({
      from: 'events',
      title: TITLE,
      name: e.title,
      category: CATEGORY_TABS.find((c) => c.value === e.category)?.label ?? '',
      photos: [],
      address: e.location,
      hours: '',
      phone: '',
      description: '이벤트 소개는 등록 후 표시합니다. 지금은 화면 확인용 예시 문구입니다.',
      tags: '',
      rating: '',
      instagram: '',
      blogReviews: '',
    });
    controller.navigate('detail', TITLE);
  };
  return (
    <LottePageFrame
      controller={controller}
      title={TITLE}
      subtitle="진행 중인 행사와 혜택을 확인하세요"
      bannerFallback="banner-detail"
    >
      <div className={styles.tabs}>
        <button type="button" className={`${styles.tab} ${styles.tabActive}`}>
          {TITLE}
        </button>
      </div>
      <div className={styles.chips}>
        {CATEGORY_TABS.map((c, i) => (
          <Fragment key={c.value}>
            {i > 0 && <span className={styles.chipSep}>ㅣ</span>}
            <button
              type="button"
              className={`${styles.chip} ${c.value === category ? styles.chipActive : ''}`}
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </button>
          </Fragment>
        ))}
      </div>
      <div className={styles.listScroll}>
        <div className={styles.list}>
          {items.map((e) => (
            <button key={e.id} type="button" className={styles.card} onClick={() => open(e)}>
              <span className={styles.cardThumb} />
              <span className={styles.cardTitle}>{e.title}</span>
              <span className={styles.cardVenue}>{e.location}</span>
            </button>
          ))}
        </div>
      </div>
    </LottePageFrame>
  );
}
