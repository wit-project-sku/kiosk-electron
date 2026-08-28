/** A shop image (S3 webp URL) ordered by sortOrder. */
export interface ShopImage {
  id: number;
  imageUrl: string;
  sortOrder: number;
}

/** Driving distance/time from the kiosk to a rentcar shop (witteria `route`). */
export interface ShopRoute {
  distanceKm: number | null;
  durationMin: number | null;
  guideType?: string | null;
}

/**
 * A shop record from the witteria shops API (multilingual).
 *
 * Each text field exists in all 8 UI languages via a suffix: Kr, En, Jp, Ch,
 * Vn, Id, Th, Ru. The renderer resolves the right one by language through the
 * `field()` helper in lib/shops.ts, so all 8 must be declared here. Optional
 * (`?`) on the newer languages so older cached rows that predate them still fit.
 */
export interface Shop {
  id: number;
  no: string;
  kioskId: number;
  // Korean (always present — the canonical fallback)
  shopNameKr: string;
  baseCategoryKr: string | null;
  secondCategoryKr: string | null;
  aiCategoryKr: string | null;
  addressKr: string;
  hashTagKr: string;
  descriptionKr: string;
  // English
  shopNameEn: string;
  baseCategoryEn: string | null;
  secondCategoryEn: string | null;
  aiCategoryEn?: string | null;
  addressEn: string;
  hashTagEn: string;
  descriptionEn: string;
  // Japanese
  shopNameJp: string;
  baseCategoryJp: string | null;
  secondCategoryJp: string | null;
  aiCategoryJp?: string | null;
  addressJp: string;
  hashTagJp: string;
  descriptionJp: string;
  // Chinese
  shopNameCh: string;
  baseCategoryCh: string | null;
  secondCategoryCh: string | null;
  aiCategoryCh?: string | null;
  addressCh: string;
  hashTagCh: string;
  descriptionCh: string;
  // Vietnamese
  shopNameVn?: string;
  baseCategoryVn?: string | null;
  secondCategoryVn?: string | null;
  aiCategoryVn?: string | null;
  addressVn?: string;
  hashTagVn?: string;
  descriptionVn?: string;
  // Indonesian
  shopNameId?: string;
  baseCategoryId?: string | null;
  secondCategoryId?: string | null;
  aiCategoryId?: string | null;
  addressId?: string;
  hashTagId?: string;
  descriptionId?: string;
  // Thai
  shopNameTh?: string;
  baseCategoryTh?: string | null;
  secondCategoryTh?: string | null;
  aiCategoryTh?: string | null;
  addressTh?: string;
  hashTagTh?: string;
  descriptionTh?: string;
  // Russian
  shopNameRu?: string;
  baseCategoryRu?: string | null;
  secondCategoryRu?: string | null;
  aiCategoryRu?: string | null;
  addressRu?: string;
  hashTagRu?: string;
  descriptionRu?: string;
  openTime: string | null;
  tel: string | null;
  naverLink: string | null;
  naverRating: number | null;
  images: ShopImage[];
  /** Present on rentcar rows — distance/duration from the kiosk. */
  route?: ShopRoute | null;
}
