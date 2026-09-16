/** Cross-process constants and sane defaults. */

import type { AppSettings } from './types/domain';
import type { KioskConfig } from './types/kiosk';

export const APP_NAME = 'Kiosk App';

/**
 * Windows AppUserModelID and electron-builder `appId`. Keep in step with
 * electron-builder.yml — the beta build appends ".beta" to both this and
 * APP_NAME so it installs and stores its data separately (see
 * main/core/appIdentity.ts).
 */
export const APP_ID = 'com.kioskapp.desktop';

/**
 * Witteria API base used when `WITTERIA_API_BASE` is unset — the PROD host.
 * Stage is `https://api-stage-v3.witteria.com`; set the env var, don't edit this.
 */
export const DEFAULT_WITTERIA_API_BASE = 'https://api-v3.witteria.com';

/** Default kiosk identity — override per deployment (W001/W002/W003). */
export const DEFAULT_KIOSK_CONFIG: KioskConfig = {
  kioskId: 'W001',
  layout: 'INSADONG',
  apiBase: DEFAULT_WITTERIA_API_BASE,
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  displayKioskMode: true,
  slideshowIntervalMs: 5000,
  preferredDisplayId: null,
  businessName: 'Kiosk App',
};

export const PAGINATION = {
  defaultPageSize: 25,
  maxPageSize: 200,
} as const;

/** Image/video MIME types accepted by the import pipeline. */
export const SUPPORTED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export const SUPPORTED_VIDEO_MIME = ['video/mp4', 'video/webm'] as const;

export const SUPPORTED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'] as const;
export const SUPPORTED_VIDEO_EXT = ['.mp4', '.webm'] as const;
