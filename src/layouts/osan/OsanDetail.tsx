import { useEffect } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { screenSubtitle, screenTitle, useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { useDetailStore } from '@renderer/store/detailStore';
import { OsanSpotDetailCard, type SpotDetailData } from './OsanSpotDetailCard';
import { OsanHeader } from './OsanHeader';
import { OsanBanner } from './OsanBanner';
import { OsanLeftNav } from './OsanLeftNav';
import styles from './OsanDetail.module.css';

interface OsanDetailProps {
  controller: KioskController;
}

export function OsanDetail({ controller }: OsanDetailProps): JSX.Element {
  const lang = useLang();
  const goHome = (): void => controller.navigate('home', 'Back');
  const item = useDetailStore((s) => s.item);
  const goBack = (): void => controller.navigate(item?.from ?? 'home', 'Back');

  const from = item?.from;
  useEffect(() => {
    if (from) void window.api.kiosk.setScreen(`${from}_detail`);
  }, [from]);

  if (!item) {
    return (
      <>
        {osanIconUrl('bg') && (
          <img className={styles.bg} src={osanIconUrl('bg')} alt="" draggable={false} />
        )}
        <OsanHeader title="상세" onHome={goHome} />
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
  };

  return (
    <>
      {osanIconUrl('bg') && (
        <img className={styles.bg} src={osanIconUrl('bg')} alt="" draggable={false} />
      )}

      <OsanHeader
        title={`${screenTitle(item.title, lang)} > ${screenTitle('상세', lang)}`}
        subtitle={screenSubtitle(item.title, lang) ?? t('SubHeader_Detail', lang)}
        onHome={goHome}
        onBack={goBack}
      />

      <OsanSpotDetailCard data={data} />

      <OsanLeftNav onHome={goHome} onBack={goBack} />

      <OsanBanner onClick={() => controller.startPhoto()} />
    </>
  );
}
