import type { Shop } from '@shared/types/shop';
import type { DetailItem } from '@renderer/store/detailStore';
import type { KioskScreenId } from '@shared/types/kiosk';
import type { Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { useKioskStore } from '@renderer/store/kioskStore';
import { getKioskLocation } from '@shared/config/kioskLocations';
import {
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopOpenTime,
  shopSecondCategory,
} from '@renderer/lib/shops';

const isUrl = (v: string | null | undefined): v is string => !!v && /^https?:\/\//i.test(v.trim());

/**
 * What the 상세 QR opens: the shop's own `naverLink` when the server has one, else a Naver Map
 * search for "<this venue> <shop>" — the same kind of link 제주's rows carry
 * (`map.naver.com/p/search/제주 <name>`). On stage no 롯데 shop has a naverLink (2026-11-20),
 * so the search is what the QR shows until the data is filled in.
 */
export function lotteShopLink(shop: Shop): string {
  if (isUrl(shop.naverLink)) return shop.naverLink.trim();
  const venue = getKioskLocation(useKioskStore.getState().config.kioskId).name;
  return `https://map.naver.com/p/search/${encodeURIComponent(`${venue} ${shop.shopNameKr}`.trim())}`;
}

/** A shop as the shared detail store wants it. Every 롯데 list opens 상세 through this. */
export const shopDetail = (
  shop: Shop,
  from: KioskScreenId,
  title: string,
  lang: Lang,
): DetailItem => ({
  from,
  shopId: shop.id,
  title,
  name: shopName(shop, lang),
  category: shopSecondCategory(shop, lang).replace(/^\d+-/, ''),
  photos: shopImages(shop),
  address: shopAddress(shop, lang),
  hours: shopOpenTime(shop.openTime),
  phone: shop.tel ?? '',
  description: shopDescription(shop, lang),
  tags: shopHashtag(shop, lang),
  rating: '',
  instagram: '',
  // The 상세 QR's link (as on every venue, the field is not a review count — see JejuDetail).
  blogReviews: lotteShopLink(shop),
  ...(isUrl(shop.homepage) ? { homepageUrl: shop.homepage.trim() } : {}),
});

/** A Naver Map search for "<this venue> <name>" — the 상세 QR for rows with no link of their own. */
const naverSearch = (name: string): string => {
  const venue = getKioskLocation(useKioskStore.getState().config.kioskId).name;
  return `https://map.naver.com/p/search/${encodeURIComponent(`${venue} ${name}`.trim())}`;
};

/**
 * A 건물 안내 핫스팟 card (Figma A-07) as the shared 상세 (B-04, LotteDetail): its photo, name, the
 * one-line intro as the 소개, the floor chip as the address and its hours. The header reads
 * "<지점> > 상세" and 뒤로 returns to 건물 안내, which keeps its building and 핫스팟 tab (lotteNav).
 */
export const hotspotDetail = (
  spot: {
    name: string;
    intro?: string;
    place: string;
    hours?: string;
    category?: string;
    description?: string;
    tel?: string;
  },
  photo: string | undefined,
  title: string,
  lang: Lang,
): DetailItem => ({
  from: 'building',
  title,
  name: spot.name,
  category: spot.category ?? (lang === 'ko' ? '핫스팟' : sheetText('Building_Tab_Hotspot', lang, { en: 'Hot spots' })),
  photos: photo ? [photo] : [],
  address: spot.place,
  hours: spot.hours ?? '',
  phone: spot.tel ?? '',
  description: spot.description ?? spot.intro ?? '',
  tags: '',
  rating: '',
  instagram: '',
  blogReviews: naverSearch(spot.name),
});
