import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/** 자동 촬영. The frame arrives already captured and upright; main only runs the AR pipeline. */
export function registerAutoShotHandlers(container: AppContainer): void {
  handle(IpcChannels.AutoShotPlan, () => container.autoShot.plan());
  handle(IpcChannels.AutoShotRun, (request) => container.autoShot.run(request));
}
