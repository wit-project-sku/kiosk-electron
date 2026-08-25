import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/**
 * Registers the 제주국제여객터미널 선박 운항 read channel. The snapshot is
 * produced and refreshed by SailingService in the main process.
 */
export function registerSailingHandlers(container: AppContainer): void {
  handle(IpcChannels.SailingsGet, () => container.sailings.getCurrent());
}
