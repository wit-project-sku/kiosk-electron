import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

export function registerEventsHandlers(container: AppContainer): void {
  handle(IpcChannels.EventsGet, (query) => container.events.get(query));
  handle(IpcChannels.EventsRecommend, (query) => container.events.recommend(query));
  handle(IpcChannels.EventsDetailGet, ({ eventId }) => container.events.getDetail(eventId));
}
