import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useDetailStore } from '@renderer/store/detailStore';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { InsadongHeader } from './InsadongHeader';
import { SpotDetailCard, type SpotDetailData } from './SpotDetailCard';
import { InsadongLeftNav } from './InsadongLeftNav';
import styles from './InsadongAiDetail.module.css';

/**
 * '인사' 뭐하지 — AI course spot DETAIL (Figma 7519:76755).
 *
 * The frame is the same plate as `검색 > 상세` (7519:74932), so it renders the
 * shared {@link SpotDetailCard} and inherits the renewal styling rather than
 * carrying a second copy of it. What changed here is the DATA: it used to draw
 * a hardcoded 을지정육 placeholder, and now reads the stop the course result
 * put in the detail store.
 */
export function InsadongAiDetail({ controller }: { controller: KioskController; debug?: boolean }): JSX.Element {
  const banner = useRotatingBanner();
  const item = useDetailStore((s) => s.item);
  const goHome = (): void => controller.navigate('home', 'Back');
  const goBack = (): void => controller.navigate(item?.from ?? 'ai_result', 'Back');
  /* The header ID, not a pre-resolved string. `AI_Course_Title` is not a row on
     the 인사 tab, so this always fell through to the Korean literal — and the
     literal is not a TITLE_KEYS id either (the id carries "(AI 검색)"), so
     screenTitle had nothing to look up and drew 인사 뭐하지 in Korean in all
     eight languages, with no page description at all. Passing the id resolves
     MainButton_AI / SubHeader_AISearch from the sheet, the same as the AI
     landing and the course result already do. */
  const title = '‘인사’ 뭐하지 (AI 검색)';

  if (!item) {
    return (
      <>
        {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}
        <InsadongHeader title={title} onHome={goHome} onBack={goBack} />
        <InsadongLeftNav onHome={goHome} onBack={goBack} />
      </>
    );
  }

  const data: SpotDetailData = {
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
    originName: getKioskLocation(controller.kioskId).name,
    distanceKm: item.route?.distanceKm ?? null,
    walkMin: item.route?.walkMin ?? null,
  };

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title={title} onHome={goHome} onBack={goBack} />

      <SpotDetailCard data={data} />

      <InsadongLeftNav onHome={goHome} onBack={goBack} />

      {banner && (
        <button type="button" className={styles.banner} onClick={() => controller.startPhoto()} aria-label="가상 한복 체험">
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </>
  );
}
