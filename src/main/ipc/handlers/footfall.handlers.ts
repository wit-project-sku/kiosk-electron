import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/**
 * 유동인구 counting. Four calls, all of them integers or configuration — the
 * camera frames never leave the renderer, so there is no image channel here to
 * audit.
 */
export function registerFootfallHandlers(container: AppContainer): void {
  handle(IpcChannels.FootfallGetRuntime, () => container.footfall.getRuntime());

  handle(IpcChannels.FootfallReport, (report) => container.footfall.report(report));

  handle(IpcChannels.FootfallStatus, ({ available, deviceId }) => {
    container.footfall.setCameraAvailable(available);
    container.footfall.setActiveDevice(deviceId);
    return null;
  });

  handle(IpcChannels.FootfallGetStats, () => container.footfall.getStats());
}
