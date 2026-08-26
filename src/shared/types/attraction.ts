/**
 * 제주 관광명소 — the curated sightseeing catalogue behind 여기는 제주도's third
 * tab, from `GET /api/jeju/attractions?kioskId=`.
 *
 * ── Why this is not just a filtered `Shop[]` ──────────────────────────
 * The tab used to read the general shop catalogue filtered to
 * `baseCategoryKr === '제주 뭐하지'`. That is 136 rows spanning 11 second
 * categories, and five of them are ACTIVITIES, not sights — 해녀 체험, 감귤 체험,
 * 승마 체험, 레저·액티비티, 사진 촬영. This endpoint is the curated 101: only
 * 자연명소, 해변, 섬 여행, 오름·트래킹, 역사유적지 and 전시관·문화공간 (verified
 * against stage 2026-08-14). So the switch is not plumbing — it changes which
 * rows the visitor sees, and it is the reason a 승마 체험 no longer shows up
 * under 관광명소.
 *
 * The row shape is a strict SUPERSET of `Shop`, so it extends it and every
 * `shop*` helper in `lib/shops.ts` (name, address, images, description, hashtag,
 * category label) works on an Attraction unchanged.
 */
import type { Shop } from './shop';

/** Difficulty as the CMS grades it: 1 easy … 3 demanding. Null when ungraded. */
export type AttractionDifficulty = 1 | 2 | 3;

export interface Attraction extends Shop {
  /**
   * Area of the island — 산간 / 동부 / 서부 / 제주시권 / 서귀포동부 / 중문·안덕.
   * Populated in all 8 languages, unlike most of the shop catalogue.
   */
  regionKr: string;
  regionEn?: string;
  regionJp?: string;
  regionCh?: string;
  regionVn?: string;
  regionId?: string;
  regionTh?: string;
  regionRu?: string;

  latitude: number | null;
  longitude: number | null;

  /**
   * Trip-planning attributes. ★ NOTHING READS THESE YET — they are declared so
   * the cached row keeps the full wire shape rather than being silently
   * narrowed, and because 제주 already has course artwork (`arrow-course.svg`,
   * `course-*.png`) that these clearly exist to feed. About 95 of the 101 rows
   * carry them; `capacityTier` is "L" on every row that has one, so it does not
   * yet distinguish anything.
   */
  dwellMin: number | null;
  difficulty: AttractionDifficulty | null;
  capacityTier: string | null;
  minParty: number | null;

  createdAt?: string;
  updatedAt?: string;
}
