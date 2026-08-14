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

/**
 * A tab in the outfit picker — `GET /api/outfits/categories`, in registration
 * (`id`) order. This list IS the tab row: the picker draws one tab per row it
 * returns, so adding or renaming a tab is an admin action, not a release.
 *
 * ★ `categoryName` is the FILTER CODE and never appears on screen — it is what
 * `KioskOutfit.categoryName` is matched against. The `label*` fields are the
 * display names, edited in the admin web independently of the code, so the two
 * drift on purpose (`brand` is labelled 이벤트, `New Outfit` is labelled 직업복).
 * Putting a label where a code belongs matches no outfit and empties the tab.
 *
 * School uniforms are deliberately absent: they carry the SCHOOL's name in
 * `categoryName`, so they cannot be filtered by category at all — they are
 * fetched with `type=SCHOOL_UNIFORM` + `schoolId` in the donation flow instead.
 *
 * The server fills a blank label from the Korean one and then from the code, so
 * every field arrives non-empty; the kiosk fills them the same way for the
 * legacy endpoint and the offline bundle (see `shared/constants/outfitCategories`).
 */
export interface OutfitCategory {
  id: number;
  /** Registered filter code, e.g. "w=hannbok". Matches `KioskOutfit.categoryName`. */
  categoryName: string;
  labelKr: string;
  labelEn: string;
  labelJp: string;
  labelCh: string;
  labelVn: string;
  labelId: string;
  labelTh: string;
  labelRu: string;
}

/** The eight display-name fields of an {@link OutfitCategory}. */
export type OutfitCategoryLabels = Omit<OutfitCategory, 'id' | 'categoryName'>;

/** What the renderer receives: the catalogue plus the tab list. */
export interface OutfitCatalogue {
  outfits: KioskOutfit[];
  categories: OutfitCategory[];
  /** True when this is the bundled fallback rather than API content. */
  fallback: boolean;
}
