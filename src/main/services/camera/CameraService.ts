import type { WebContents } from 'electron';
import Store from 'electron-store';
import type { CameraDeviceInfo } from '@shared/types/photo';
import { createLogger } from '@main/core/logger';

const log = createLogger('camera-service');

const ELGATO_PATTERN = /elgato|facecam|cam link|prompter/i;

interface CameraStore {
  preferredDeviceId: string | null;
}

let store: Store<CameraStore> | null = null;

function getStore(): Store<CameraStore> {
  if (!store) {
    store = new Store<CameraStore>({
      name: 'camera-config',
      defaults: { preferredDeviceId: null },
    });
  }
  return store;
}

/**
 * Camera hardware abstraction. Enumerates devices via the kiosk renderer's
 * MediaDevices API (orchestrated from main) and selects Elgato/USB cameras.
 * UI never calls camera APIs directly — it requests deviceId through IPC.
 */
export class CameraService {
  private cachedDevices: CameraDeviceInfo[] = [];

  /** Enumerate video input devices using the kiosk window's WebContents. */
  async listDevices(webContents: WebContents): Promise<CameraDeviceInfo[]> {
    const raw = (await webContents.executeJavaScript(`
      (async () => {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          return devices
            .filter((d) => d.kind === 'videoinput')
            .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Camera' }));
        } catch (e) {
          return [];
        }
      })()
    `)) as { deviceId: string; label: string }[];

    this.cachedDevices = raw.map((d) => ({
      deviceId: d.deviceId,
      label: d.label,
      vendor: detectVendor(d.label),
    }));

    log.info('Camera devices enumerated', { count: this.cachedDevices.length });
    return this.cachedDevices;
  }

  getCachedDevices(): CameraDeviceInfo[] {
    return this.cachedDevices;
  }

  /** Select best camera: saved preference → Elgato → first available. */
  resolveDeviceId(): string | null {
    const preferred = getStore().get('preferredDeviceId');
    if (preferred && this.cachedDevices.some((d) => d.deviceId === preferred)) {
      return preferred;
    }

    const elgato = this.cachedDevices.find((d) => d.vendor === 'elgato');
    if (elgato) return elgato.deviceId;

    return this.cachedDevices[0]?.deviceId ?? null;
  }

  setPreferredDevice(deviceId: string): void {
    getStore().set('preferredDeviceId', deviceId);
  }

  getPreferredDevice(): string | null {
    return getStore().get('preferredDeviceId');
  }
}

function detectVendor(label: string): CameraDeviceInfo['vendor'] {
  if (ELGATO_PATTERN.test(label)) return 'elgato';
  if (label.trim().length > 0) return 'usb';
  return 'unknown';
}
