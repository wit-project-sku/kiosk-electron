import { create } from 'zustand';
import type { Attraction } from '@shared/types/attraction';
import { isOk } from '@shared/types/result';
import { prefetchShopThumbnails } from '@renderer/lib/shops';

interface AttractionState {
  attractions: Attraction[];
  loaded: boolean;
  /** Fetch the cached 관광명소 catalogue from main (once). */
  load: () => Promise<void>;
  /** Re-fetch after main signals the catalogue changed (first-launch/nightly). */
  reload: () => Promise<void>;
}

/**
 * 제주 관광명소, loaded from the SQLite-cached API data.
 *
 * Deliberately its own store rather than a selector over `shopStore`: it is a
 * different endpoint returning a different (curated) row set, and folding it
 * into the shop catalogue would put activity rows back in front of the visitor
 * — see `@shared/types/attraction`.
 *
 * `prefetchShopThumbnails` is reused verbatim; an Attraction IS a Shop
 * structurally, and the card grid wants its first image warmed just the same.
 */
export const useAttractionStore = create<AttractionState>((set, get) => ({
  attractions: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    const result = await window.api.attractions.list();
    if (isOk(result)) {
      set({ attractions: result.value, loaded: true });
      prefetchShopThumbnails(result.value);
    }
  },
  reload: async () => {
    const result = await window.api.attractions.list();
    // Only replace when there is data, so a bad refresh never wipes a populated
    // catalogue out from under a visitor mid-browse.
    if (isOk(result) && result.value.length > 0) {
      set({ attractions: result.value, loaded: true });
      prefetchShopThumbnails(result.value);
    }
  },
}));
