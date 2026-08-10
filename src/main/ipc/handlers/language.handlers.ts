import { IpcChannels, IpcEvents } from '@shared/ipc/channels';
import type { SupportedLanguage } from '@shared/types/kiosk';
import { languageStore } from '@main/core/LanguageStore';
import type { WindowManager } from '@main/windows/WindowManager';
import { handle } from '../registry';

/**
 * Registers language channels. Language selection is persisted to electron-store
 * and broadcast to all windows so the UI updates instantly without network.
 */
export function registerLanguageHandlers(windows: WindowManager): void {
  handle(IpcChannels.LanguageGet, () => {
    return languageStore.get();
  });

  handle(IpcChannels.LanguageSet, (language: SupportedLanguage) => {
    languageStore.set(language);
    windows.broadcast(IpcEvents.LanguageChanged, language);
    return language;
  });
}
