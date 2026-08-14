import { create } from 'zustand';
import type { KioskBackground } from '@shared/types/background';
import { isOk } from '@shared/types/result';

interface BackgroundState {
  backgrounds: KioskBackground[];
  loaded: boolean;
  /** Fetch the cached AR 배경 테마 set from main (once). */
  load: () => Promise<void>;
  /** Re-fetch after main signals the set changed (launch/nightly refresh). */
  reload: () => Promise<void>;
}

/**
 * In-memory AR 배경 테마 set, loaded from the SQLite-cached API data.
 *
 * Unlike {@link useBannerStore}, `reload()` accepts an EMPTY result: a kiosk
 * whose backgrounds were all retired must actually lose its plates, and the
 * main-side service already falls back to the previous cache when the API is
 * unreachable — so an empty array here means "none assigned", never "offline".
 */
export const useBackgroundStore = create<BackgroundState>((set, get) => ({
  backgrounds: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    const result = await window.api.backgrounds.list();
    if (isOk(result)) {
      set({ backgrounds: result.value, loaded: true });
    } else {
      console.warn('[backgroundStore] load() failed', result);
    }
  },
  reload: async () => {
    const result = await window.api.backgrounds.list();
    if (isOk(result)) {
      set({ backgrounds: result.value, loaded: true });
    } else {
      console.warn('[backgroundStore] reload() failed — keeping previous set', result);
    }
  },
}));
