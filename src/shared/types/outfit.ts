/**
 * AR 한복체험 outfit catalogue, as served by `GET /api/outfits` (no auth).
 *
 * Replaces the build-time PNG glob in
 * `renderer/src/assets/photos/insadong/hanbok/clothes` — that catalogue is kept
 * only as an offline fallback for a kiosk that has never synced.
 */

/** Female / male / unisex. Undefined = the AR request sends no gender. */
export type OutfitGender = 'female' | 'male' | undefined;

/**
 * One wearable outfit.
 *
 * Extends `OutfitCategoryLabels` for the same reason a category does: the eight
 * `label*` fields are the outfit's DISPLAY NAME, edited per language in the
 * admin web. `name` is not — see below.
 */
export interface KioskOutfit extends OutfitCategoryLabels {
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
   * ★ The INTERNAL slug, e.g. "global_5.7" — NOT the caption. It is the
   * operator's filing name: category code plus outfit code, in one language,
   * and it is what the admin web lists rows by. The visitor sees `label*`.
   *
   * Kept only as the last resort behind those labels, for the same reason
   * `categoryName` is kept behind a category's: a row the operator has just
   * created and not yet named reads oddly rather than blank. Empty on a row
   * that never had one, and on a cache written before this field existed.
   */
  name: string;
  /**
   * Registered category name — `categoryName` verbatim, e.g. "w=hannbok",
   * "K-Culture". This is the tab key, NOT a display label. For a school uniform
   * it is the school's name instead, which is why uniforms never match a tab.
   */
  categoryName: string;
  /** Registered category id. Null where the endpoint omits it (prod today). */
  categoryId: number | null;
  /** The chip this outfit sits under, or null — most categories have no chips. */
  subCategoryId: number | null;
  /**
   * The sub-category's Korean label ("남자" / "여자") verbatim, or null.
   *
   * Kept because it is the ONLY gender signal left on the newer catalogue: the
   * `w=` / `m=` category prefixes are gone there and the codes under 한복 and
   * 일상의상 carry no `-F` / `-M` suffix either. See `genderOf`.
   */
  subCategoryLabelKr: string | null;
  type: 'NORMAL' | 'PREMIUM' | 'SCHOOL_UNIFORM';
  /** Set only for SCHOOL_UNIFORM. */
  schoolId: number | null;
  gender: OutfitGender;
  /** Kiosks this outfit is assigned to (DB kiosk ids, W006 → 6). */
  kioskIds: number[];
}

/**
 * A tab in the outfit picker — `GET /api/outfits/categories`, in `sortOrder`.
 * This list IS the tab row: the picker draws one tab per row it returns, so
 * adding, renaming or REORDERING a tab is an admin action, not a release.
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
/** The eight display-name fields carried by a category and a sub-category alike. */
export interface OutfitCategoryLabels {
  labelKr: string;
  labelEn: string;
  labelJp: string;
  labelCh: string;
  labelVn: string;
  labelId: string;
  labelTh: string;
  labelRu: string;
}

/**
 * One chip under a tab — a row of the category's `subCategories`.
 *
 * Unlike a category it has NO name/code of its own: an outfit points at it by
 * `subCategoryId`, so the id is the whole key and the labels are the whole
 * display. Stage registers exactly 남자/여자 under 한복, 직업의상 and 일상의상;
 * every other category ships an empty array and draws no chip row.
 */
export interface OutfitSubCategory extends OutfitCategoryLabels {
  id: number;
  /** The operator's order for the chip row. */
  sortOrder: number;
}

export interface OutfitCategory extends OutfitCategoryLabels {
  id: number;
  /** Registered filter code, e.g. "w=hannbok". Matches `KioskOutfit.categoryName`. */
  categoryName: string;
  /**
   * The operator's tab order. NOT the id: stage returns ids 76, 77, 9, 78, 5…
   * against sortOrder 1…9, so ordering by id would scramble the row.
   *
   * Where the endpoint omits the field (prod today) the kiosk substitutes the
   * row's position in the response, which makes sorting a no-op there and keeps
   * the order the server chose.
   */
  sortOrder: number;
  /** Empty for a category the operator gave no sub-categories. */
  subCategories: OutfitSubCategory[];
}

/** What the renderer receives: the catalogue plus the tab list. */
export interface OutfitCatalogue {
  outfits: KioskOutfit[];
  categories: OutfitCategory[];
  /** True when this is the bundled fallback rather than API content. */
  fallback: boolean;
}
