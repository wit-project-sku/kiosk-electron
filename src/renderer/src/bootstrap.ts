import type { BootstrapData } from '@shared/ipc/contracts';
import { useSettingsStore } from '@renderer/store/settingsStore';
import { useTemplatesStore } from '@renderer/store/templatesStore';
import { useSyncStore } from '@renderer/store/syncStore';
import { useKioskStore } from '@renderer/store/kioskStore';
import { useLanguageStore } from '@renderer/store/languageStore';

/** Synchronous hydration from preload-injected state — runs before first paint. */
export function hydrateInitialState(): void {
  const initial = window.__INITIAL_STATE__;
  if (!initial) return;
  applyBootstrap(initial);
}

export function applyBootstrap(data: BootstrapData): void {
  useSettingsStore.getState().hydrate(data.settings);
  useTemplatesStore.getState().hydrate(data.templates);
  useSyncStore.getState().hydrate(data.syncStats);
  useKioskStore.getState().hydrate(data.kioskConfig, data.theme, data.content, data.translations);
  useKioskStore.getState().setDevMode(data.devMode === true);
  // Every kiosk offers the same 8 languages (see languageStore ALLOWED).
  useLanguageStore.getState().hydrate(data.currentLanguage);
}
