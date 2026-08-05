import type { WebContents } from 'electron';
import Store from 'electron-store';
import type { CameraDeviceInfo, CameraRotation } from '@shared/types/photo';
import { DEFAULT_CAMERA_ROTATION, isCameraRotation } from '@shared/types/photo';
import { createLogger } from '@main/core/logger';

const log = createLogger('camera-service');

const ELGATO_PATTERN = /elgato|facecam|cam link|prompter/i;

interface CameraStore {
  preferredDeviceId: string | null;
  /** Degrees clockwise the camera is physically rotated on its mount. */
  captureRotation: CameraRotation;
}

/**
 * Rotation for a machine that has never been configured: DEFAULT_CAMERA_ROTATION
 * (270 — vertical mount), overridable per machine with VITE_CAMERA_ROTATION=0
 * for a kiosk whose camera is still horizontal.
 */
function envRotation(): CameraRotation {
  const raw = Number(process.env['VITE_CAMERA_ROTATION']);
  return isCameraRotation(raw) ? raw : DEFAULT_CAMERA_ROTATION;
}

let store: Store<CameraStore> | null = null;

function getStore(): Store<CameraStore> {
  if (!store) {
    store = new Store<CameraStore>({
      name: 'camera-config',
      defaults: { preferredDeviceId: null, captureRotation: envRotation() },
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

  /**
   * Mount rotation, applied to BOTH the Monitor-2 preview and the saved JPEG so
   * the two can never disagree. A stored value from an older build (or a hand
   * edit) that isn't a right angle falls back to the env default.
   */
  getRotation(): CameraRotation {
    const stored = getStore().get('captureRotation');
    return isCameraRotation(stored) ? stored : envRotation();
  }

  setRotation(rotation: CameraRotation): void {
    getStore().set('captureRotation', rotation);
    log.info('Camera rotation set', { rotation });
  }
}

function detectVendor(label: string): CameraDeviceInfo['vendor'] {
  if (ELGATO_PATTERN.test(label)) return 'elgato';
  if (label.trim().length > 0) return 'usb';
  return 'unknown';
}
