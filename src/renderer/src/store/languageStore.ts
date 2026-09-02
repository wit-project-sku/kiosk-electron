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
  /** Populate from the startup bootstrap payload. The kiosk always offers the
   *  8 ALLOWED languages, so only the persisted current language is carried. */
  hydrate: (language: SupportedLanguage) => void;
}

/** The kiosk ships exactly these 8 languages everywhere. Order matters: the
 *  language selector lays these out column-major (4 left, 4 right). */
const ALLOWED: SupportedLanguage[] = ['ko', 'en', 'ja', 'zh', 'vi', 'th', 'ru', 'id'];
const clampLang = (l: SupportedLanguage): SupportedLanguage => (ALLOWED.includes(l) ? l : 'ko');

/**
 * Current language state. Synced to electron-store in the main process so all
 * windows stay in step during a session. Resets to Korean on app launch and on
 * idle timeout (see main/index.ts and useKioskController.handleIdle).
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
    set({ currentLanguage: clampLang(language), availableLanguages: ALLOWED, loaded: true });
  },
}));
