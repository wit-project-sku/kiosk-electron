/**
 * Centralized filesystem path resolution.
 *
 * All on-disk locations (database file, media library, thumbnails) are derived
 * from Electron's `userData` directory so the app is fully self-contained and
 * portable across platforms. Directories are created lazily on first use.
 */

import { app } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function ensureDir(dir: string): string {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

class AppPaths {
  /** Root user-data directory managed by Electron. */
  get userData(): string {
    return app.getPath('userData');
  }

  /** SQLite database file. */
  get database(): string {
    return join(ensureDir(join(this.userData, 'data')), 'kiosk.db');
  }

  /** Directory holding imported original media files. */
  get media(): string {
    return ensureDir(join(this.userData, 'media'));
  }

  /** Directory holding generated thumbnails. */
  get thumbnails(): string {
    return ensureDir(join(this.userData, 'thumbnails'));
  }

  /** Directory for log files (electron-log default location mirror). */
  get logs(): string {
    return ensureDir(join(this.userData, 'logs'));
  }

  /**
   * Captured + AI-generated photos (permanent storage, paired by sessionId).
   *
   * Saved to a shallow, easy-to-find top-level folder rather than deep inside
   * AppData. Default `C:\KioskPhotos` on Windows; override with PHOTO_SAVE_DIR.
   * Non-Windows (dev on mac/linux) falls back to the userData location.
   */
  get generated(): string {
    const custom = process.env['PHOTO_SAVE_DIR'];
    if (custom && custom.trim()) return ensureDir(custom.trim());
    if (process.platform === 'win32') return ensureDir('C:\\KioskPhotos');
    return ensureDir(join(this.userData, 'data', 'generated'));
  }

  /**
   * Display/attract videos. Shipped as electron-builder extraResources (large,
   * not bundled). Packaged → resources/videos; dev → <repo>/resources/videos.
   */
  get videos(): string {
    return app.isPackaged
      ? join(process.resourcesPath, 'videos')
      : join(process.cwd(), 'resources', 'videos');
  }
}

export const appPaths = new AppPaths();
