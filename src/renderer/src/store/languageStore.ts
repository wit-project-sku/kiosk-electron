import { create } from 'zustand';
import type { SupportedLanguage } from '@shared/types/kiosk';
import { isOk } from '@shared/types/result';
import { toast } from './toastStore';

interface LanguageState {
  currentLanguage: SupportedLanguage;
  availableLanguages: SupportedLanguage[];
  loaded: boolean;
  /** Set the current language and persist to main process. */
  setLanguage: (language: SupportedLanguage) => Promise<void>;
  /** Mirror a language change from the main process WITHOUT re-persisting (no IPC).
   *  Used by the LanguageChanged broadcast handler to avoid an echo loop. */
  applyLanguage: (language: SupportedLanguage) => void;
  /** Populate from the startup bootstrap payload. */
  hydrate: (language: SupportedLanguage, available: SupportedLanguage[]) => void;
}

/** The kiosk ships exactly these 4 languages everywhere. */
const ALLOWED: SupportedLanguage[] = ['ko', 'en', 'ja', 'zh'];
const clampLang = (l: SupportedLanguage): SupportedLanguage => (ALLOWED.includes(l) ? l : 'ko');

/**
 * Current language state. Persisted via electron-store in the main process.
 * Language changes are instantaneous (no network) but persist across restarts.
 */
export const useLanguageStore = create<LanguageState>((set, get) => ({
  currentLanguage: 'ko',
  availableLanguages: ALLOWED,
  loaded: false,

  setLanguage: async (language) => {
    const previous = get().currentLanguage;
    set({ currentLanguage: language });
    const result = await window.api.language.set(language);
    if (!isOk(result)) {
      set({ currentLanguage: previous });
      toast.error('Failed to save language preference.');
    }
  },

  applyLanguage: (language) => set({ currentLanguage: clampLang(language) }),

  hydrate: (language) => {
    // Ignore the backend's language list — the kiosk always offers the 4 ALLOWED.
    set({ currentLanguage: clampLang(language), availableLanguages: ALLOWED, loaded: true });
  },
}));
