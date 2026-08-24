import { useEffect } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { screenSubtitle, screenTitle, useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { useDetailStore } from '@renderer/store/detailStore';
import { InsadongHeader } from './InsadongHeader';
import { SpotDetailCard, type SpotDetailData } from './SpotDetailCard';
import { PalaceDetailCard } from './PalaceDetailCard';
import { InsadongLeftNav } from './InsadongLeftNav';
import styles from './InsadongDetail.module.css';

interface InsadongDetailProps {
  controller: KioskController;
  debug?: boolean;
}

/** 상세 — shared list-item detail page; uses the AI 검색상세 design (SpotDetailCard). */
export function InsadongDetail({ controller }: InsadongDetailProps): JSX.Element {
  const banner = useRotatingBanner();
  const lang = useLang();
  const goHome = (): void => controller.navigate('home', 'Back');
  const item = useDetailStore((s) => s.item);
  const goBack = (): void => controller.navigate(item?.from ?? 'home', 'Back');

  // Tell the customer display which detail video to play (e.g. `eat_detail`
  // → ToEat_Detail). navigate() only reported the generic 'detail' screen.
  const from = item?.from;
  useEffect(() => {
    if (from) void window.api.kiosk.setScreen(`${from}_detail`);
  }, [from]);

  if (!item) {
    return (
      <>
        {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}
        <InsadongHeader title="상세" onHome={goHome} />
      </>
    );
  }

  const isPalace = item.title === '고궁안내';

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
  };

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader
        title={`${screenTitle(item.title, lang)} > ${screenTitle('상세', lang)}`}
        subtitle={screenSubtitle(item.title, lang) ?? t('SubHeader_Detail', lang)}
        onHome={goHome}
        onBack={goBack}
        compact={isPalace}
      />

      {isPalace ? <PalaceDetailCard item={item} /> : <SpotDetailCard data={data} />}

      <InsadongLeftNav onHome={goHome} onBack={goBack} />

      {banner && (
        <button type="button" className={styles.banner} onClick={() => controller.startPhoto()} aria-label="가상 한복 체험">
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </>
  );
}
