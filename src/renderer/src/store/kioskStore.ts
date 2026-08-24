import { create } from 'zustand';
import type { CachedContent, KioskConfig, KioskScreenId, KioskTheme, SupportedLanguage } from '@shared/types/kiosk';

type TranslationMap = {
  [key: string]: Partial<Record<SupportedLanguage, string>>;
};

interface KioskState {
  config: KioskConfig;
  theme: KioskTheme;
  content: Map<string, CachedContent>;
  translations: TranslationMap;
  screen: KioskScreenId;
  /** `DEV_MODE=true` in the app's `.env` — surfaces the kiosk-location switcher. */
  devMode: boolean;
  setScreen: (screen: KioskScreenId) => void;
  setDevMode: (devMode: boolean) => void;
  hydrate: (config: KioskConfig, theme: KioskTheme, content: CachedContent[], translations: TranslationMap) => void;
  refreshContent: (content: CachedContent[]) => void;
  getContent: (key: string) => CachedContent | undefined;
}

export const useKioskStore = create<KioskState>((set, get) => ({
  config: { kioskId: 'W001', layout: 'INSADONG' },
  theme: {
    id: 'insadong',
    name: 'Insadong',
    colors: {
      primary: '#FE6C50',
      primaryHover: '#E85A40',
      secondary: '#F8ECDE',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      text: '#232323',
      textMuted: '#999999',
      accent: '#FE6C50',
    },
    typography: {
      fontFamily: 'sans-serif',
      headingSize: '2.5rem',
      bodySize: '1.125rem',
      buttonSize: '1.25rem',
    },
    spacing: { screenPadding: '2rem', buttonGap: '1rem' },
  },
  content: new Map(),
  translations: {},
  screen: 'home',
  devMode: false,
  setScreen: (screen) => set({ screen }),
  setDevMode: (devMode) => set({ devMode }),
  hydrate: (config, theme, content, translations) => {
    const map = new Map<string, CachedContent>();
    for (const item of content) map.set(item.key, item);
    set({ config, theme, content: map, translations });
  },
  refreshContent: (content) => {
    const map = new Map<string, CachedContent>();
    for (const item of content) map.set(item.key, item);
    set({ content: map });
  },
  getContent: (key) => get().content.get(key),
}));
