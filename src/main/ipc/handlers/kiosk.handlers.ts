import { IpcChannels, IpcEvents } from '@shared/ipc/channels';
import type { WindowManager } from '@main/windows/WindowManager';
import { handle } from '../registry';

/**
 * Kiosk navigation bridge. The touch window reports its current screen; main
 * rebroadcasts it so the customer display can swap to the matching AI-model
 * video (VideoSubtitle_Insa).
 */
export function registerKioskHandlers(windows: WindowManager): void {
  handle(IpcChannels.KioskSetScreen, ({ screen, buttonId }) => {
    windows.broadcast(IpcEvents.KioskScreenChanged, { screen, buttonId: buttonId ?? null });
    return screen;
  });

  // Home weather card tapped — tell the customer display to play the clip for
  // today's condition (Weather_Rain/Cold/Sunny). The touch window resolves the
  // key from its weather snapshot; main just rebroadcasts it.
  handle(IpcChannels.KioskPlayWeatherVideo, ({ key }) => {
    windows.broadcast(IpcEvents.KioskWeatherVideo, key);
    return true;
  });
}
