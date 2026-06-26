import { app } from 'electron';
import { IpcChannels } from '@shared/ipc/channels';
import type { AppVersionInfo } from '@shared/ipc/contracts';
import type { WindowManager } from '@main/windows/WindowManager';
import { handle } from '../registry';

/** Registers read-only system/diagnostics channels. */
export function registerSystemHandlers(windows: WindowManager): void {
  handle(IpcChannels.SystemGetMonitors, () => windows.listMonitors());

  handle(
    IpcChannels.SystemGetVersion,
    (): AppVersionInfo => ({
      app: app.getVersion(),
      electron: process.versions.electron ?? 'unknown',
      chrome: process.versions.chrome ?? 'unknown',
      node: process.versions.node ?? 'unknown',
    }),
  );
}
