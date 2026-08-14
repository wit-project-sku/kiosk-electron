import { create } from 'zustand';
import { isOk } from '@shared/types/result';
import type { KioskOutfit, OutfitCategory } from '@shared/types/outfit';
import { fallbackOutfitLabels } from '@shared/constants/outfitCategories';
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

/** One outfit as the picker draws it, whatever the source. */
export interface PickerOutfit {
  /** AR outfit code — what `clothingKey` carries to the AR API. */
  code: string;
  /** Card image: a remote URL from the API, or a bundled asset URL offline. */
  url: string;
  gender: 'female' | 'male' | undefined;
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
      out[name.toLowerCase()] = folder.map((o) => ({ code: o.code, url: o.url, gender: o.gender }));
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
    ...fallbackOutfitLabels(name),
  }));
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
    (out[key] ??= []).push({ code: o.code, url: o.imageUrl, gender: o.gender });
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
    if (next) set({ ...next, loaded: true });
    else {
      // Never leave the picker empty: without cards there is no way to take a
      // photo at all, which is worse than showing last release's outfits.
      console.warn('[outfitStore] load() failed — using the bundled catalogue');
      set({
        byCategory: bundledCatalogue(),
        categories: bundledCategories(),
        fallback: true,
        loaded: true,
      });
    }
  },
  reload: async () => {
    const next = await fetchCatalogue();
    if (next) set({ ...next, loaded: true });
    else console.warn('[outfitStore] reload() failed — keeping the current catalogue');
  },
}));
