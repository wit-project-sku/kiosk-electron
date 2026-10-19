import type { KioskController } from '@renderer/hooks/useKioskController';
import { useDetailStore } from '@renderer/store/detailStore';
import { screenTitle, useLang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { OsanSpotDetailCard, type SpotDetailData } from './OsanSpotDetailCard';
import { OsanHeader } from './OsanHeader';
import { OsanBanner } from './OsanBanner';
import { OsanLeftNav } from './OsanLeftNav';
import { OsanPageBg } from './OsanPageBg';
import { osanAiTitle } from './OsanAiCourse';
import { useEffect, useRef } from 'react';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { JejuCourseSpotCard } from '@layouts/jeju/JejuCourseSpotCard';
import styles from './OsanAiDetail.module.css';

/** 오산's navy copies of 제주's course-card icons (same drawings, main 01). */
const NEXT_ICONS = {
  marker: osanIconUrl('course-next-marker'),
  duration: osanIconUrl('course-next-duration'),
  difficulty: osanIconUrl('course-next-difficulty'),
};

interface OsanAiDetailProps {
  controller: KioskController;
}

/**
 * '정이' 뭐하지 — a course stop's detail. Figma 오산>코스 상세 7812:111257: the
 * shared 상세 card (OsanSpotDetailCard) under the course title, with the banner.
 * Shows the item the result page stored in detailStore; blank without one.
 *
 * Like 제주's course detail (JejuDetail), a stop that has a next stop on the
 * route draws it under the place: a down chevron, then the 다음 장소 card with
 * its 체류시간 — 제주's JejuCourseSpotCard in 오산's navy. Tapping it shows that
 * stop here (the store item is swapped; 뒤로 still returns to the course).
 */
export function OsanAiDetail({ controller }: OsanAiDetailProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const goBack = (): void => controller.navigate('ai_result', 'Back');
  const lang = useLang();
  const item = useDetailStore((s) => s.item);
  const setItem = useDetailStore((s) => s.setItem);
  const next = item?.courseNext;
  /* A new stop starts at the top of its own detail. */
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [item]);
  /* ♿ 오산>코스 상세 (7878:46583) titles the page "'정이' 뭐하지 > 상세"; the
     normal frame (7812:111257) keeps the plain course title. */
  const low = useAccessibilityStore((s) => s.lowReach);

  const data: SpotDetailData | null = item
    ? {
        name: item.name,
        category: item.category,
        photos: item.photos,
        address: item.address,
        hours: [item.hours, ...(item.breaktime ? [`(${item.breaktime})`] : [])],
        phone: item.phone,
        description: item.description,
        tags: item.tags,
        rating: item.rating,
        instagram: item.instagram,
        blog: item.blogReviews,
      }
    : null;

  return (
    <>
      <OsanPageBg />

      <OsanHeader
        title={low ? `${osanAiTitle(lang)} > ${screenTitle('상세', lang)}` : osanAiTitle(lang)}
        // SubHeader_Detail — the same description the shop 상세 page shows.
        subtitle={sheetText('SubHeader_Detail', lang) || undefined}
        onHome={goHome}
        onBack={goBack}
      />

      {data && next ? (
        <div ref={scrollRef} className={styles.courseScroll}>
          <div className={styles.courseColumn}>
            <OsanSpotDetailCard data={data} className={styles.flowCard} />
            {osanIconUrl('course-next-chevron') && (
              <img src={osanIconUrl('course-next-chevron')} alt="" className={styles.nextChevron} draggable={false} />
            )}
            <JejuCourseSpotCard
              width={1793}
              photo={next.item.photos[0] ?? osanIconUrl('noimage') ?? ''}
              name={next.item.name}
              category={next.item.category}
              address={next.item.address}
              description={next.item.description}
              dwell={next.dwell}
              difficulty={next.difficulty}
              icons={NEXT_ICONS}
              onClick={() => setItem(next.item)}
            />
          </div>
        </div>
      ) : (
        data && <OsanSpotDetailCard data={data} />
      )}

      <OsanLeftNav onHome={goHome} onBack={goBack} />

      <OsanBanner onClick={() => controller.startPhoto()} />
    </>
  );
}
