import { IpcChannels, IpcEvents } from '@shared/ipc/channels';
import type { WindowManager } from '@main/windows/WindowManager';
import { handle } from '../registry';

/**
 * Kiosk navigation bridge. The touch window reports its current screen; main
 * rebroadcasts it so the customer display can swap to the matching AI-model
 * video (VideoSubtitle_Insa).
 */
export function registerKioskHandlers(windows: WindowManager): void {
  handle(IpcChannels.KioskSetScreen, ({ screen }) => {
    windows.broadcast(IpcEvents.KioskScreenChanged, screen);
    return screen;
  });

  // Touch screen asked for the next clip (e.g. home weather card) — tell the
  // customer display to advance within the current screen's clip list.
  handle(IpcChannels.KioskAdvanceVideo, () => {
    windows.broadcast(IpcEvents.KioskVideoAdvanced, null);
    return true;
  });
}
