import { useEffect } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { screenSubtitle, screenTitle, useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useDetailStore } from '@renderer/store/detailStore';
import { buildDetailCardSaveUrlForQr } from '@renderer/lib/detailCardSave';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { barrierFreeTitle, DETAIL_LOW_REACH_STYLE } from './barrierFree';
import { InsadongHeader } from './InsadongHeader';
import { SpotDetailCard, type SpotDetailData } from './SpotDetailCard';
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
  const lowReach = useAccessibilityStore((s) => s.lowReach);
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
      <div className={lowReach ? styles.lowRoot : undefined} style={lowReach ? DETAIL_LOW_REACH_STYLE : undefined}>
        {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}
        {lowReach && <div className={styles.modeBar}>{barrierFreeTitle(lang)}</div>}
        <InsadongHeader title="상세" onHome={goHome} />
      </div>
    );
  }

  const data: SpotDetailData = {
    name: item.name,
    category: item.category,
    photos: item.photos,
    address: item.address,
    hours: [
      ...item.hours.split(/\n+/).map((h) => h.trim()).filter(Boolean),
      ...(item.breaktime ? [`(${item.breaktime})`] : []),
    ],
    phone: item.phone,
    description: item.description,
    tags: item.tags,
    rating: item.rating,
    instagram: item.instagram,
    blog: item.blogReviews,
    /* 7516:74320 reads "남인사마당에서 1.6 km" — the origin is THIS kiosk, so it
       comes from the location table rather than being hardcoded per frame. */
    originName: getKioskLocation(controller.kioskId).name,
    distanceKm: item.route?.distanceKm ?? null,
    walkMin: item.route?.walkMin ?? null,
    /* 7537:81399 — the code on the 도보 pill. Built here because it needs the
       current language; null for a row with no shopId, which hides it. */
    saveQrUrl:
      item.shopId != null
        ? buildDetailCardSaveUrlForQr({ lang, from: item.from, shopId: item.shopId })
        : null,
  };

  return (
    <div className={lowReach ? styles.lowRoot : undefined} style={lowReach ? DETAIL_LOW_REACH_STYLE : undefined}>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      {lowReach && <div className={styles.modeBar}>{barrierFreeTitle(lang)}</div>}

      <InsadongHeader
        title={screenTitle(item.title, lang)}
        subtitle={screenSubtitle(item.title, lang) ?? t('SubHeader_Detail', lang)}
        onHome={goHome}
        onBack={goBack}
      />

      <SpotDetailCard data={data} />

      <InsadongLeftNav onHome={goHome} onBack={goBack} />

      {banner && (
        <button type="button" className={styles.banner} onClick={() => controller.startPhoto()} aria-label="가상 한복 체험">
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </div>
  );
}
