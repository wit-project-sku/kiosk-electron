import type { WebContents } from 'electron';
import Store from 'electron-store';
import type { CameraDeviceInfo } from '@shared/types/photo';
import { createLogger } from '@main/core/logger';

const log = createLogger('camera-service');

const ELGATO_PATTERN = /elgato|facecam|cam link|prompter/i;
/**
 * The ZED 2i, the kiosk's camera since 2026-08. UVC-compliant, so it needs no
 * driver and no ZED SDK to appear here — but its frames are side by side and
 * are halved in the renderer (`renderer/lib/stereoCamera.ts`).
 */
const ZED_PATTERN = /\bzed\b|stereolabs/i;

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

    // Labels, not just a count: "is the ZED even being seen, and is it listed
    // twice?" is the first question every camera call-out starts with.
    log.info('Camera devices enumerated', {
      count: this.cachedDevices.length,
      devices: this.cachedDevices.map((d) => `${d.label} (${d.vendor})`),
    });
    return this.cachedDevices;
  }

  getCachedDevices(): CameraDeviceInfo[] {
    return this.cachedDevices;
  }

  /**
   * Select best camera: saved preference → ZED → Elgato → first available.
   *
   * The ZED outranks the Elgato because it is the camera the kiosks are being
   * fitted with; a machine that still has both plugged in during the swap
   * should be running the new one. `find` also settles the case of a driver
   * that lists the ZED more than once — the first entry is the one every open
   * then uses, rather than a different node each time.
   */
  resolveDeviceId(): string | null {
    const preferred = getStore().get('preferredDeviceId');
    if (preferred && this.cachedDevices.some((d) => d.deviceId === preferred)) {
      return preferred;
    }

    const zed = this.cachedDevices.find((d) => d.vendor === 'zed');
    if (zed) return zed.deviceId;

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
  if (ZED_PATTERN.test(label)) return 'zed';
  if (ELGATO_PATTERN.test(label)) return 'elgato';
  if (label.trim().length > 0) return 'usb';
  return 'unknown';
}
