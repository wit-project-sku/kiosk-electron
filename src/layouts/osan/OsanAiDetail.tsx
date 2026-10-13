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

interface OsanAiDetailProps {
  controller: KioskController;
}

/**
 * '정이' 뭐하지 — a course stop's detail. Figma 오산>코스 상세 7812:111257: the
 * shared 상세 card (OsanSpotDetailCard) under the course title, with the banner.
 * Shows the item the result page stored in detailStore; blank without one.
 */
export function OsanAiDetail({ controller }: OsanAiDetailProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const goBack = (): void => controller.navigate('ai_result', 'Back');
  const lang = useLang();
  const item = useDetailStore((s) => s.item);
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

      {data && <OsanSpotDetailCard data={data} />}

      <OsanLeftNav onHome={goHome} onBack={goBack} />

      <OsanBanner onClick={() => controller.startPhoto()} />
    </>
  );
}
