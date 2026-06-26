import Store from 'electron-store';
import type { SupportedLanguage } from '@shared/types/kiosk';

interface LanguageConfig {
  currentLanguage: SupportedLanguage;
}

const DEFAULTS: LanguageConfig = {
  currentLanguage: 'ko',
};

let store: Store<LanguageConfig> | null = null;

function getStore(): Store<LanguageConfig> {
  if (!store) {
    store = new Store<LanguageConfig>({
      name: 'language-config',
      defaults: DEFAULTS,
      clearInvalidConfig: true,
    });
  }
  return store;
}

/**
 * Language preference persistence via electron-store.
 * Survives restarts and is synced to the renderer via IPC.
 */
export const languageStore = {
  get(): SupportedLanguage {
    const s = getStore();
    return s.get('currentLanguage', DEFAULTS.currentLanguage);
  },

  set(language: SupportedLanguage): void {
    const s = getStore();
    s.set('currentLanguage', language);
  },
};
