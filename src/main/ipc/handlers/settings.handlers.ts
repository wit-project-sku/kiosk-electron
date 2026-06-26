import { IpcChannels, IpcEvents } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import type { WindowManager } from '@main/windows/WindowManager';
import { handle } from '../registry';

/**
 * Registers settings channels. After a successful update the new settings are
 * broadcast to every window so theme and display preferences apply everywhere
 * without each window having to poll.
 */
export function registerSettingsHandlers(container: AppContainer, windows: WindowManager): void {
  const { settings } = container;

  handle(IpcChannels.SettingsGet, () => settings.get());

  handle(IpcChannels.SettingsUpdate, (changes) => {
    const next = settings.update(changes);
    container.analytics.track({
      name: 'settings_changed',
      payload: { keys: Object.keys(changes) },
    });
    windows.broadcast(IpcEvents.SettingsChanged, next);
    return next;
  });
}
