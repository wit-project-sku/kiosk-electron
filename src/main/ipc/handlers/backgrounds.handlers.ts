import { IpcChannels } from '@shared/ipc/channels';
import type { KioskBackground } from '@shared/types/background';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/** Serves the cached AR 배경 테마 set to the renderer (instant, offline). */
export function registerBackgroundHandlers(container: AppContainer): void {
  handle(IpcChannels.BackgroundsList, (): KioskBackground[] => container.backgrounds.list());
}
