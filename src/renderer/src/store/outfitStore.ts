import { create } from 'zustand';
import { isOk } from '@shared/types/result';
import type { KioskOutfit, OutfitCategory, OutfitCategoryLabels } from '@shared/types/outfit';
import { fallbackOutfitLabels, uniformOutfitLabels } from '@shared/constants/outfitCategories';
import { OUTFITS_BY_CATEGORY } from '@renderer/assets/photos/insadong/hanbok/clothes';

/**
 * The registered category name for each bundled `catN-*` folder, in folder
 * order. Lets the offline fallback be keyed exactly like API content, so the
 * picker has ONE lookup path instead of a fallback branch everywhere.
 *
 * Taken from the live `GET /api/outfits/categories` (2026-08-14) — note
 * "w=hannbok" really is spelled with two n's server-side, and matching is
 * case-insensitive but otherwise exact.
 *
 * These are the first eight registered categories; the ninth ("New Outfit") has
 * no bundled folder, so an offline kiosk simply has one tab fewer.
 */
const BUNDLED_CATEGORY_NAMES = [
  'w=hannbok',
  'w=model',
  'm=hanbok',
  'm=everyday',
  'global',
  'promotion',
  'brand',
  'K-Culture',
] as const;

/**
 * One outfit as the picker draws it, whatever the source.
 *
 * Carries the eight `label*` fields like a category does — the card's caption
 * is CMS content in the visitor's language, resolved at render time by
 * `outfitLabel` so a language switch relabels the strip without refetching.
 */
export interface PickerOutfit extends OutfitCategoryLabels {
  /** AR outfit code — what `clothingKey` carries to the AR API. */
  code: string;
  /** Card image: a remote URL from the API, or a bundled asset URL offline. */
  url: string;
  gender: 'female' | 'male' | undefined;
  /**
   * The chip this outfit sits under, or null. Null for every outfit on a
   * catalogue with no sub-categories (prod today) and for the bundled PNGs,
   * which is why an unpicked chip row must show the whole category rather than
   * filtering on it — see the chip row in JejuHanbokSelect.
   */
  subCategoryId: number | null;
}

interface OutfitState {
  /** Outfits grouped by LOWER-CASED category name. */
  byCategory: Record<string, PickerOutfit[]>;
  categories: OutfitCategory[];
  /** True while the bundled PNGs are standing in for a cache that is empty. */
  fallback: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  reload: () => Promise<void>;
}

/** Bundled PNGs, keyed the same way API content is. Used only offline. */
function bundledCatalogue(): Record<string, PickerOutfit[]> {
  const out: Record<string, PickerOutfit[]> = {};
  BUNDLED_CATEGORY_NAMES.forEach((name, i) => {
    const folder = OUTFITS_BY_CATEGORY[i] ?? [];
    if (folder.length > 0) {
      // The bundle predates sub-categories and has no way to express one.
      out[name.toLowerCase()] = folder.map((o) => ({
        code: o.code,
        url: o.url,
        // The bundle predates the labels — the file stem IS the AR code, so it
        // is the only caption an offline kiosk can put under the card.
        ...uniformOutfitLabels(o.code),
        gender: o.gender,
        subCategoryId: null,
      }));
    }
  });
  return out;
}

/**
 * Tabs for the bundled catalogue, so the offline picker has a tab row at all.
 *
 * The ids are positional rather than the server's — nothing matches on them,
 * and this branch only runs when the server's list never arrived.
 */
function bundledCategories(): OutfitCategory[] {
  return BUNDLED_CATEGORY_NAMES.map((name, i) => ({
    id: i + 1,
    categoryName: name,
    // Positional, like the ids: the folder order IS the order offline, and
    // there are no chips to draw for a bundle that has no sub-categories.
    sortOrder: i,
    subCategories: [],
    ...fallbackOutfitLabels(name),
  }));
}

const LABEL_KEYS = [
  'labelKr',
  'labelEn',
  'labelJp',
  'labelCh',
  'labelVn',
  'labelId',
  'labelTh',
  'labelRu',
] as const satisfies readonly (keyof OutfitCategoryLabels)[];

/**
 * The label fields an outfit row actually carries, dropping the empty ones so
 * they do not overwrite the stand-in spread in before them. A cache written
 * before OutfitService normalised these has none at all.
 */
function pickLabels(o: KioskOutfit): Partial<OutfitCategoryLabels> {
  const out: Partial<OutfitCategoryLabels> = {};
  for (const k of LABEL_KEYS) if (o[k]) out[k] = o[k];
  return out;
}

function group(outfits: KioskOutfit[]): Record<string, PickerOutfit[]> {
  const out: Record<string, PickerOutfit[]> = {};
  for (const o of outfits) {
    // A school uniform's `categoryName` is the SCHOOL's name, so it can never
    // match a picker tab. Dropping it here keeps it out of the 제주 flow, where
    // uniforms do not belong — they are the donation flow's content.
    if (o.type === 'SCHOOL_UNIFORM') continue;
    const key = o.categoryName.toLowerCase();
    if (!key) continue;
    (out[key] ??= []).push({
      code: o.code,
      url: o.imageUrl,
      // Already normalised to eight non-empty strings by OutfitService — except
      // on a cache written before the fields existed, where they are absent and
      // the AR code stands in rather than the caption slot rendering blank.
      ...uniformOutfitLabels(o.code),
      ...pickLabels(o),
      gender: o.gender,
      subCategoryId: o.subCategoryId,
    });
  }
  return out;
}

async function fetchCatalogue(): Promise<Pick<OutfitState, 'byCategory' | 'categories' | 'fallback'> | null> {
  const result = await window.api.outfits.get();
  if (!isOk(result)) return null;
  const { outfits, categories, fallback } = result.value;
  if (fallback || outfits.length === 0) {
    // The two halves fail independently: a kiosk can hold cached tabs and no
    // outfits. Keep whichever the cache has and only synthesize the missing one.
    return {
      byCategory: bundledCatalogue(),
      categories: categories.length > 0 ? categories : bundledCategories(),
      fallback: true,
    };
  }
  return { byCategory: group(outfits), categories, fallback: false };
}

/**
 * Warm the browser cache with outfit card images in the background so the picker
 * renders instantly after the catalogue metadata is in memory. Runs deferred at
 * idle priority — same pattern as {@link prefetchShopThumbnails}.
 */
function prefetchOutfitImages(byCategory: Record<string, PickerOutfit[]>): void {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const list of Object.values(byCategory)) {
    for (const o of list) {
      if (o.url && !seen.has(o.url)) {
        seen.add(o.url);
        urls.push(o.url);
      }
    }
  }
  if (urls.length === 0) return;

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

/**
 * The AR 한복 outfit catalogue, from the SQLite-cached API data.
 *
 * Outfits used to be a build-time PNG glob, so adding one meant redeploying
 * every kiosk. They now come from `GET /api/outfits` (see OutfitService), with
 * the old bundle kept purely as the offline fallback — a machine that has never
 * synced still opens the picker.
 *
 * Grouping happens ONCE here rather than per tab, because the endpoint's
 * `categoryName` filter does not work (it returns the full list whatever you
 * pass) and because a request per tab tap would put the network in the middle
 * of the UI.
 */
export const useOutfitStore = create<OutfitState>((set, get) => ({
  byCategory: {},
  categories: [],
  fallback: false,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    const next = await fetchCatalogue();
    if (next) {
      set({ ...next, loaded: true });
      prefetchOutfitImages(next.byCategory);
    } else {
      // Never leave the picker empty: without cards there is no way to take a
      // photo at all, which is worse than showing last release's outfits.
      console.warn('[outfitStore] load() failed — using the bundled catalogue');
      const byCategory = bundledCatalogue();
      set({
        byCategory,
        categories: bundledCategories(),
        fallback: true,
        loaded: true,
      });
      prefetchOutfitImages(byCategory);
    }
  },
  reload: async () => {
    const next = await fetchCatalogue();
    if (next) {
      set({ ...next, loaded: true });
      prefetchOutfitImages(next.byCategory);
    } else console.warn('[outfitStore] reload() failed — keeping the current catalogue');
  },
}));
