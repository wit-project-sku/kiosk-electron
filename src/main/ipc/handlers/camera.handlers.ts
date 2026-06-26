import type { WebContents } from 'electron';
import { IpcChannels } from '@shared/ipc/channels';
import type { AppContainer } from '@main/container';
import type { WindowManager } from '@main/windows/WindowManager';
import { handle } from '../registry';

export function registerCameraHandlers(container: AppContainer, windows: WindowManager): void {
  handle(IpcChannels.CameraListDevices, async () => {
    const main = windows.getMainWindow();
    if (!main || main.isDestroyed()) {
      return container.camera.getCachedDevices();
    }
    return container.camera.listDevices(main.webContents as WebContents);
  });

  handle(IpcChannels.CameraGetSelected, () => {
    const deviceId = container.camera.resolveDeviceId();
    return { deviceId, devices: container.camera.getCachedDevices() };
  });

  handle(IpcChannels.CameraSetPreferred, (_req: { deviceId: string }) => {
    container.camera.setPreferredDevice(_req.deviceId);
    return { deviceId: _req.deviceId };
  });
}
