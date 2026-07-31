import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import { handle } from '../registry';

/**
 * Auto-update IPC. Read-only status plus two explicit operator actions
 * (force-check, install-now). All update behaviour is automatic; these just let
 * a UI reflect and, if desired, nudge it.
 */
export function registerUpdateHandlers(container: AppContainer): void {
  handle(IpcChannels.UpdateGetStatus, () => container.updater.getStatus());
  handle(IpcChannels.UpdateCheckNow, () => container.updater.checkNow());
  handle(IpcChannels.UpdateInstallNow, () => container.updater.installNow());
}
