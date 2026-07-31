import { create } from 'zustand';
import type { KioskBanner } from '@shared/types/banner';
import { isOk } from '@shared/types/result';

interface BannerState {
  banners: KioskBanner[];
  loaded: boolean;
  /** Fetch the cached bottom banners from main (once). */
  load: () => Promise<void>;
  /** Re-fetch after main signals the banners changed (launch/nightly refresh). */
  reload: () => Promise<void>;
}

/** In-memory bottom promo banners, loaded from the SQLite-cached API data. */
export const useBannerStore = create<BannerState>((set, get) => ({
  banners: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    const result = await window.api.banners.list();
    if (isOk(result)) {
      console.info('[bannerStore] load()', { count: result.value.length });
      set({ banners: result.value, loaded: true });
    } else {
      console.warn('[bannerStore] load() failed', result);
    }
  },
  reload: async () => {
    const result = await window.api.banners.list();
    // Only replace when there's data, so we never wipe a populated set.
    if (isOk(result) && result.value.length > 0) {
      console.info('[bannerStore] reload()', { count: result.value.length });
      set({ banners: result.value, loaded: true });
    } else {
      console.warn('[bannerStore] reload() got no data — keeping previous banners', result);
    }
  },
}));
