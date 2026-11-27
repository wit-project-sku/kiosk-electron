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
 * Decoded 배경 테마 plates, held for the life of the app — same pattern and
 * same reason as `warmed` in outfitStore: the references keep the decoded
 * bitmaps alive, so the picker's step ② paints from memory instead of
 * re-requesting and re-decoding on every visit. Without this the plates were
 * the one image set on the picker with NO warm-up at all, and the first open
 * showed empty tiles until each multi-MB photo arrived and decoded —
 * revisiting the tab then looked "fixed" because the cache was finally hot.
 */
const warmed = new Map<string, HTMLImageElement>();

function prefetchBackgroundImages(backgrounds: KioskBackground[]): void {
  const urls = backgrounds.map((b) => b.imageUrl).filter((u) => u && !warmed.has(u));
  if (urls.length === 0) return;

  const run = (): void => {
    for (const url of urls) {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      // decode() forces the bitmap NOW rather than at first paint — fetching
      // alone still left the first open with a visible decode stall on the
      // 9:16 plates. Rejection (404, retired plate) is fine to ignore: the
      // tile's own <img> handles its fallback.
      void img.decode().catch(() => undefined);
      warmed.set(url, img);
    }
  };
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (ric) ric(run);
  else setTimeout(run, 500);
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
      prefetchBackgroundImages(result.value);
    } else {
      console.warn('[backgroundStore] load() failed', result);
    }
  },
  reload: async () => {
    const result = await window.api.backgrounds.list();
    if (isOk(result)) {
      set({ backgrounds: result.value, loaded: true });
      prefetchBackgroundImages(result.value);
    } else {
      console.warn('[backgroundStore] reload() failed — keeping previous set', result);
    }
  },
}));
