import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

export function registerAnalyticsHandlers(container: AppContainer): void {
  const { analytics } = container;

  handle(IpcChannels.AnalyticsTrack, (event) => analytics.track(event));
  handle(IpcChannels.AnalyticsReport, ({ rangeStart, rangeEnd }) =>
    analytics.report(rangeStart, rangeEnd),
  );
}
