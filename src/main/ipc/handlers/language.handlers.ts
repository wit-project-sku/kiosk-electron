import { IpcChannels, IpcEvents } from '@shared/ipc/channels';
import type { SupportedLanguage } from '@shared/types/kiosk';
import { getKioskLanguages } from '@shared/config/kioskLocations';
import { languageStore } from '@main/core/LanguageStore';
import type { AppContainer } from '@main/container';
import type { WindowManager } from '@main/windows/WindowManager';
import { handle } from '../registry';

/**
 * Registers language channels. Language selection is persisted to electron-store
 * and broadcast to all windows so the UI updates instantly without network.
 */
export function registerLanguageHandlers(container: AppContainer, windows: WindowManager): void {
  handle(IpcChannels.LanguageGet, () => {
    return languageStore.get();
  });

  handle(IpcChannels.LanguageSet, (language: SupportedLanguage) => {
    languageStore.set(language);
    windows.broadcast(IpcEvents.LanguageChanged, language);
    return language;
  });

  // The selector adapts to the kiosk: languages come from the kioskId catalog,
  // not from whatever translation rows happen to be cached. Fully offline.
  handle(IpcChannels.LanguageGetAvailable, () => {
    const { kioskId } = container.kiosk.getConfig();
    return getKioskLanguages(kioskId);
  });
}
