import type { Lang } from '@renderer/lib/i18n';
import type { Shop } from '@shared/types/shop';

type Suffix = 'Kr' | 'En' | 'Jp' | 'Ch';
const SUFFIX: Record<string, Suffix> = { ko: 'Kr', en: 'En', ja: 'Jp', zh: 'Ch' };
const sfx = (lang: Lang): Suffix => SUFFIX[lang] ?? 'Kr';

const field = (s: Shop, base: string, lang: Lang, fallback: string): string =>
  (s[`${base}${sfx(lang)}` as keyof Shop] as string | null) || fallback;

export const shopName = (s: Shop, lang: Lang): string => field(s, 'shopName', lang, s.shopNameKr);
export const shopAddress = (s: Shop, lang: Lang): string => field(s, 'address', lang, s.addressKr);
export const shopHashtag = (s: Shop, lang: Lang): string => field(s, 'hashTag', lang, s.hashTagKr);
export const shopDescription = (s: Shop, lang: Lang): string => field(s, 'description', lang, s.descriptionKr);
export const shopSecondCategory = (s: Shop, lang: Lang): string =>
  stripPrefix(field(s, 'secondCategory', lang, s.secondCategoryKr ?? ''));
export const shopBaseCategory = (s: Shop, lang: Lang): string =>
  field(s, 'baseCategory', lang, s.baseCategoryKr ?? '');

/**
 * Free-text search across name/tag/description (live + KR), ranked by where the
 * match lands: title first, then hashtag, then description/category/address.
 */
export function searchShops(shops: Shop[], query: string, lang: Lang, limit = 60): Shop[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored: Array<{ shop: Shop; rank: number }> = [];
  for (const s of shops) {
    const title = `${shopName(s, lang)} ${s.shopNameKr}`.toLowerCase();
    const tag = `${shopHashtag(s, lang)} ${s.hashTagKr}`.toLowerCase();
    const rest = `${shopDescription(s, lang)} ${shopSecondCategory(s, lang)} ${shopAddress(s, lang)} ${s.addressKr}`.toLowerCase();

    // 1 = title, 2 = tag, 3 = description/other; lower is better.
    const rank = title.includes(q) ? 1 : tag.includes(q) ? 2 : rest.includes(q) ? 3 : 0;
    if (rank > 0) scored.push({ shop: s, rank });
  }

  // Stable sort by rank keeps the original catalogue order within each tier.
  scored.sort((a, b) => a.rank - b.rank);
  return scored.slice(0, limit).map((e) => e.shop);
}

/** Strip a leading "12-" group/order prefix from a category label. */
export const stripPrefix = (s: string): string => s.replace(/^\s*\d+\s*-\s*/, '').trim();

/** Image URLs ordered by sortOrder. */
export const shopImages = (s: Shop): string[] =>
  [...s.images].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.imageUrl);

/**
 * Exactly `count` image URLs for a card grid — real images first, then the
 * no-image placeholder repeated to fill the remaining slots (so the 2×2 layout
 * always holds its shape). Returns the first `count` if there are more.
 */
export function padImages(urls: string[], noImage: string | undefined, count = 4): string[] {
  const out = urls.slice(0, count);
  if (noImage) while (out.length < count) out.push(noImage);
  return out;
}

/**
 * Warm the browser/disk cache with shop card thumbnails (the first image of each
 * shop) in the background so list pages render instantly after the first launch.
 * Runs deferred and at idle priority.
 */
export function prefetchShopThumbnails(shops: Shop[]): void {
  const urls: string[] = [];
  for (const s of shops) {
    const first = [...s.images].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.imageUrl;
    if (first) urls.push(first);
  }
  const run = (): void => {
    for (const url of urls) {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  };
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (ric) ric(run);
  else setTimeout(run, 500);
}

/** Kiosk screen id → API baseCategoryKr. */
export const SCREEN_BASE_CATEGORY: Record<string, string> = {
  eat: '인사 뭐먹지',
  shop: '인사 뭐사지',
  museum: '인사동 미술관',
  lodging: '인사동 숙박',
  help: '인사 도와줘',
};

export function shopsForBase(shops: Shop[], baseKr: string): Shop[] {
  return shops.filter((s) => s.baseCategoryKr === baseKr);
}

/** Ordered distinct secondCategoryKr (raw "N-name") values for a base category. */
export function secondCategoriesKr(shops: Shop[], baseKr: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of shopsForBase(shops, baseKr)) {
    const c = s.secondCategoryKr;
    if (c && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out.sort((a, b) => (parseInt(a, 10) || 999) - (parseInt(b, 10) || 999));
}
