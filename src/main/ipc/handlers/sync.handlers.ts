import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

export function registerSyncHandlers(container: AppContainer): void {
  const { sync } = container;

  handle(IpcChannels.SyncStats, () => sync.getStats());
  handle(IpcChannels.SyncListByStatus, ({ status, limit }) => sync.listByStatus(status, limit));
  handle(IpcChannels.SyncRetry, (id) => sync.retryFailed(id));
}
