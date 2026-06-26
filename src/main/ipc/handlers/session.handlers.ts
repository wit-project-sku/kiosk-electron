import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

export function registerSessionHandlers(container: AppContainer): void {
  const { sessions } = container;

  handle(IpcChannels.SessionStart, ({ customerId, metadata }) =>
    sessions.start(customerId, metadata),
  );
  handle(IpcChannels.SessionEnd, ({ id, status }) => sessions.end(id, status));
  handle(IpcChannels.SessionListRecent, ({ limit }) => sessions.listRecent(limit));
}
