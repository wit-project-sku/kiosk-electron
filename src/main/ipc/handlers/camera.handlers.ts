import type { WebContents } from 'electron';
import { IpcChannels } from '@shared/ipc/channels';
import type { CameraRotation } from '@shared/types/photo';
import { isCameraRotation } from '@shared/types/photo';
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
    return {
      deviceId,
      devices: container.camera.getCachedDevices(),
      rotation: container.camera.getRotation(),
    };
  });

  handle(IpcChannels.CameraSetPreferred, (_req: { deviceId: string }) => {
    container.camera.setPreferredDevice(_req.deviceId);
    return { deviceId: _req.deviceId };
  });

  // On-site mount adjustment — no settings screen yet, so this is driven from
  // the display window's devtools console:
  //   await window.api.camera.setRotation(90)   // or 270 if the feed is upside down
  handle(IpcChannels.CameraSetRotation, (_req: { rotation: CameraRotation }) => {
    if (!isCameraRotation(_req.rotation)) {
      throw new Error(`Invalid camera rotation: ${String(_req.rotation)}`);
    }
    container.camera.setRotation(_req.rotation);
    // Push it to Monitor 2 right away so the live preview flips without having
    // to leave and re-enter the camera screen.
    container.display.setState({
      ...container.display.getState(),
      cameraRotation: _req.rotation,
    });
    return { rotation: _req.rotation };
  });
}
