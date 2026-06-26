import { IpcChannels } from '@shared/ipc/channels';
import type { BootstrapData } from '@shared/ipc/contracts';
import type { AppContainer } from '@main/container';
import { buildBootstrapData } from '@main/bootstrap';
import { handle } from '../registry';

/**
 * Aggregate startup data fetched in a single round-trip. The renderer warms its
 * in-memory caches from this so pages render instantly without loading states.
 */
export function registerAppHandlers(container: AppContainer): void {
  handle(IpcChannels.AppBootstrap, (): BootstrapData => buildBootstrapData(container));
}
