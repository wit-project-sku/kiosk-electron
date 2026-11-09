import type { Shop } from '@shared/types/shop';
import type { DetailItem } from '@renderer/store/detailStore';
import type { KioskScreenId } from '@shared/types/kiosk';
import type { Lang } from '@renderer/lib/i18n';
import {
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopOpenTime,
  shopSecondCategory,
} from '@renderer/lib/shops';

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
  blogReviews: '',
});
