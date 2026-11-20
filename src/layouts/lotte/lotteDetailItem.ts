import type { Shop } from '@shared/types/shop';
import type { DetailItem } from '@renderer/store/detailStore';
import type { KioskScreenId } from '@shared/types/kiosk';
import type { Lang } from '@renderer/lib/i18n';
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
