import type { WebContents } from 'electron';
import Store from 'electron-store';
import type { CameraDeviceInfo } from '@shared/types/photo';
import { createLogger } from '@main/core/logger';
import { classifyCamera } from '@shared/config/cameras';

const log = createLogger('camera-service');

/**
 * Selection rules live in @shared/config/cameras so main and the renderer
 * cannot drift apart. The renderer's copy is the one that actually protects
 * the photo (it is what calls getUserMedia); this one keeps main's own
 * consumers — footfall, the operator device list — honest about the same
 * devices. See useKioskCamera for why the renderer must decide for itself.
 */
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

    log.info('Camera devices enumerated', {
      count: this.cachedDevices.length,
      depth: this.cachedDevices.filter((d) => d.vendor === 'depth').length,
    });
    return this.cachedDevices;
  }

  getCachedDevices(): CameraDeviceInfo[] {
    return this.cachedDevices;
  }

  /**
   * Everything that may be opened as a photo camera — i.e. not a depth sensor.
   *
   * Every selection path goes through this, including the stored preference: a
   * kiosk provisioned before the ZED arrived can have one persisted, and an
   * operator can pick the wrong row from the device list. Filtering at the point
   * of USE rather than the point of writing means such a preference is simply
   * ignored instead of quietly re-breaking capture.
   */
  private selectableDevices(): CameraDeviceInfo[] {
    return this.cachedDevices.filter((d) => d.vendor !== 'depth');
  }

  /** Select best camera: saved preference → Elgato → first available. */
  resolveDeviceId(): string | null {
    const selectable = this.selectableDevices();

    const preferred = getStore().get('preferredDeviceId');
    if (preferred && selectable.some((d) => d.deviceId === preferred)) {
      return preferred;
    }

    const elgato = selectable.find((d) => d.vendor === 'elgato');
    if (elgato) return elgato.deviceId;

    // Deliberately the first SELECTABLE device, never simply the first
    // enumerated one — see DEPTH_CAMERA_PATTERN in @shared/config/cameras.
    return selectable[0]?.deviceId ?? null;
  }

  setPreferredDevice(deviceId: string): void {
    getStore().set('preferredDeviceId', deviceId);
  }

  getPreferredDevice(): string | null {
    return getStore().get('preferredDeviceId');
  }
}

function detectVendor(label: string): CameraDeviceInfo['vendor'] {
  return classifyCamera(label);
}
