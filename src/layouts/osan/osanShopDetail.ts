import type { Lang } from '@renderer/lib/i18n';
import {
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopSecondCategory,
} from '@renderer/lib/shops';
import type { DetailItem } from '@renderer/store/detailStore';
import type { KioskScreenId } from '@shared/types/kiosk';
import type { Shop } from '@shared/types/shop';

/**
 * The 상세 payload for one witteria shop — shared by the 뭐먹지/뭐사지 lists and
 * the home's 오늘의 상점 board, so both open the same page for the same shop.
 * `noImage` stands in for a shop with no photos, so the plate never renders empty.
 */
export function osanShopDetail(
  shop: Shop,
  lang: Lang,
  from: KioskScreenId,
  title: string,
  noImage: string | undefined,
): DetailItem {
  const photos = shopImages(shop);
  return {
    from,
    title,
    name: shopName(shop, lang),
    category: shopSecondCategory(shop, lang),
    photos: photos.length > 0 ? photos : noImage ? [noImage] : [],
    address: shopAddress(shop, lang),
    hours: shop.openTime ?? '',
    phone: shop.tel ?? '',
    description: shopDescription(shop, lang),
    tags: shopHashtag(shop, lang),
    rating: shop.naverRating != null ? String(shop.naverRating) : '',
    instagram: '',
    blogReviews: shop.naverLink ?? '',
  };
}
