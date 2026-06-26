import { create } from 'zustand';
import type { AppSettings } from '@shared/types/domain';
import { isOk } from '@shared/types/result';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { toast } from './toastStore';

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  /** Load settings from the main process. */
  load: () => Promise<void>;
  /** Populate from the startup bootstrap payload (memory cache). */
  hydrate: (settings: AppSettings) => void;
  /** Persist a partial update; optimistic with rollback on failure. */
  update: (changes: Partial<AppSettings>) => Promise<void>;
  /** Apply settings pushed from the main process (cross-window sync). */
  applyExternal: (settings: AppSettings) => void;
}

/**
 * Server-backed settings cache. The main process is the source of truth; this
 * store mirrors it and stays in sync via the `SettingsChanged` broadcast, so a
 * change in one window is reflected in the other.
 */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    const result = await window.api.settings.get();
    if (isOk(result)) {
      set({ settings: result.value, loaded: true });
    } else {
      set({ loaded: true });
      toast.error('Failed to load settings.');
    }
  },

  update: async (changes) => {
    const previous = get().settings;
    set({ settings: { ...previous, ...changes } });
    const result = await window.api.settings.update(changes);
    if (isOk(result)) {
      set({ settings: result.value });
    } else {
      set({ settings: previous });
      toast.error(result.error.message);
    }
  },

  hydrate: (settings) => set({ settings, loaded: true }),

  applyExternal: (settings) => set({ settings }),
}));
