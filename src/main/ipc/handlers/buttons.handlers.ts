import { IpcChannels } from '@shared/ipc/channels';
import type { KioskButton } from '@shared/types/buttons';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/** Serves the cached home button layout to the renderer (instant, offline). */
export function registerButtonHandlers(container: AppContainer): void {
  handle(IpcChannels.ButtonsList, (): KioskButton[] => container.buttons.list());
}
