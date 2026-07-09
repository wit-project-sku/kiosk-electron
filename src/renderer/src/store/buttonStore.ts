import { create } from 'zustand';
import type { KioskButton } from '@shared/types/buttons';
import { isOk } from '@shared/types/result';

interface ButtonState {
  buttons: KioskButton[];
  loaded: boolean;
  /** Fetch the cached home button layout from main (once). */
  load: () => Promise<void>;
  /** Re-fetch after main signals the layout changed (e.g. first-launch sync). */
  reload: () => Promise<void>;
}

/** In-memory home button layout, loaded from the SQLite-cached API data. */
export const useButtonStore = create<ButtonState>((set, get) => ({
  buttons: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    const result = await window.api.buttons.list();
    if (isOk(result)) {
      console.info('[buttonStore] load()', { count: result.value.length });
      set({ buttons: result.value, loaded: true });
    } else {
      console.warn('[buttonStore] load() failed', result);
    }
  },
  reload: async () => {
    const result = await window.api.buttons.list();
    // Only replace when there's data, so we never wipe a populated layout.
    if (isOk(result) && result.value.length > 0) {
      console.info('[buttonStore] reload()', { count: result.value.length });
      set({ buttons: result.value, loaded: true });
    } else {
      console.warn('[buttonStore] reload() got no data — keeping previous layout', result);
    }
  },
}));
