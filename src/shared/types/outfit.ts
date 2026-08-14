/**
 * AR 한복체험 outfit catalogue, as served by `GET /api/outfits` (no auth).
 *
 * Replaces the build-time PNG glob in
 * `renderer/src/assets/photos/insadong/hanbok/clothes` — that catalogue is kept
 * only as an offline fallback for a kiosk that has never synced.
 */

/** Female / male / unisex. Undefined = the AR request sends no gender. */
export type OutfitGender = 'female' | 'male' | undefined;

/** One wearable outfit. */
export interface KioskOutfit {
  /** DB id. Not sent anywhere — `code` is what the AR API takes. */
  id: number;
  /**
   * The AR outfit code (`outfitCode`), e.g. "1.1" or "10.6-F". This is the
   * value that ends up in the `outfit` form field — see ARImageTransport.
   */
  code: string;
  /** Remote card image (webp). Shown directly, like shop and banner images. */
  imageUrl: string;
  /**
   * Registered category name — `categoryName` verbatim, e.g. "w=hannbok",
   * "K-Culture". This is the tab key, NOT a display label. For a school uniform
   * it is the school's name instead, which is why uniforms never match a tab.
   */
  categoryName: string;
  type: 'NORMAL' | 'PREMIUM' | 'SCHOOL_UNIFORM';
  /** Set only for SCHOOL_UNIFORM. */
  schoolId: number | null;
  gender: OutfitGender;
  /** Kiosks this outfit is assigned to (DB kiosk ids, W006 → 6). */
  kioskIds: number[];
}

/** A tab in the outfit picker — `GET /api/categories/outfits`. */
export interface OutfitCategory {
  id: number;
  /** Registered name. Matches `KioskOutfit.categoryName`. */
  name: string;
}

/** What the renderer receives: the catalogue plus the tab list. */
export interface OutfitCatalogue {
  outfits: KioskOutfit[];
  categories: OutfitCategory[];
  /** True when this is the bundled fallback rather than API content. */
  fallback: boolean;
}
