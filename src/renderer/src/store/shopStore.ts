import { create } from 'zustand';
import type { Shop } from '@shared/types/shop';
import { isOk } from '@shared/types/result';
import { prefetchShopThumbnails } from '@renderer/lib/shops';

interface ShopState {
  shops: Shop[];
  loaded: boolean;
  /** Fetch the cached shop catalogue from main (once). */
  load: () => Promise<void>;
  /** Re-fetch after main signals the catalogue changed (e.g. first-launch sync). */
  reload: () => Promise<void>;
}

/** In-memory shop catalogue, loaded from the SQLite-cached API data. */
export const useShopStore = create<ShopState>((set, get) => ({
  shops: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    const result = await window.api.shops.list();
    if (isOk(result)) {
      set({ shops: result.value, loaded: true });
      prefetchShopThumbnails(result.value);
    }
  },
  reload: async () => {
    const result = await window.api.shops.list();
    // Only replace when there's data, so we never wipe a populated catalogue.
    if (isOk(result) && result.value.length > 0) {
      set({ shops: result.value, loaded: true });
      prefetchShopThumbnails(result.value);
    }
  },
}));
