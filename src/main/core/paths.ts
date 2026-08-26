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
   * Display/attract videos. Large and pre-downloaded per kiosk, so they live in a
   * fixed EXTERNAL folder OUTSIDE the app install directory. This is what lets an
   * auto-update replace the app without wiping the videos: the old
   * `resources/videos` lived inside the install dir (process.resourcesPath) and
   * would be lost on every update. Videos are NO LONGER shipped in the installer
   * (removed from electron-builder extraResources) — drop the .mp4s into
   * `<dir>/<set>/` (insadong|osaek|hwaseong|jeju — see VIDEO_SETS) once per
   * machine and updates leave
   * them untouched.
   *
   * Default `C:\KioskVideos` on a packaged Windows kiosk (mirrors C:\KioskPhotos);
   * override with `KIOSK_VIDEOS_DIR`. Dev keeps using the repo's resources/videos.
   */
  get videos(): string {
    const custom = process.env['KIOSK_VIDEOS_DIR'];
    if (custom && custom.trim()) return ensureDir(custom.trim());
    if (app.isPackaged && process.platform === 'win32') return ensureDir('C:\\KioskVideos');
    return join(process.cwd(), 'resources', 'videos');
  }

  /**
   * Read-only assets shipped INSIDE the install directory via electron-builder
   * `extraResources` — currently just the MediaPipe runtime (see
   * `scripts/vendor-mediapipe.mjs`).
   *
   * Unlike `videos` these are part of the app, not per-machine content, so they
   * are meant to be replaced by an auto-update. Not `ensureDir`'d: the folder is
   * created by the installer, and silently making an empty one would hide a
   * packaging mistake behind a 404 instead of surfacing it.
   */
  get bundled(): string {
    if (app.isPackaged) return process.resourcesPath;
    return join(process.cwd(), 'resources');
  }
}

export const appPaths = new AppPaths();
