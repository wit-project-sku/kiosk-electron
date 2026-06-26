import type { KioskController } from '@renderer/hooks/useKioskController';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useDetailStore } from '@renderer/store/detailStore';
import { useLang } from '@renderer/lib/i18n';
import { screenTitle } from '@renderer/lib/i18n';
import { OsanSpotDetailCard, type SpotDetailData } from './OsanSpotDetailCard';
import { OsanHeader } from './OsanHeader';
import { OsanBanner } from './OsanBanner';
import styles from './OsanAiDetail.module.css';

interface OsanAiDetailProps {
  controller: KioskController;
}

/**
 * '정이' 모하지 (AI 검색) — spot detail.
 * If a real item is stored in detailStore (from tapping an AI result card) it
 * is shown; otherwise falls back to a blank state.
 */
export function OsanAiDetail({ controller }: OsanAiDetailProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const goBack = (): void => controller.navigate('ai_result', 'Back');
  const lang = useLang();
  const item = useDetailStore((s) => s.item);

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
      {osanIconUrl('bg') && (
        <img className={styles.bg} src={osanIconUrl('bg')} alt="" draggable={false} />
      )}

      <OsanHeader
        title={`${screenTitle("'정이' 모하지 (AI 검색)", lang)} > ${screenTitle('상세', lang)}`}
        onHome={goHome}
        onBack={goBack}
      />

      {data && <OsanSpotDetailCard data={data} />}

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="홈으로">
          {osanIconUrl('home-btn') && (
            <img src={osanIconUrl('home-btn')} alt="" draggable={false} />
          )}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={goBack} aria-label="뒤로">
          {osanIconUrl('back-arrow') && (
            <img src={osanIconUrl('back-arrow')} alt="" draggable={false} />
          )}
        </button>
      </div>

      <OsanBanner onClick={() => controller.startPhoto()} />
    </>
  );
}
