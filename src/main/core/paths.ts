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
import { isBetaBuild } from './appIdentity';

function ensureDir(dir: string): string {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** Production's photo folder — where field staff and the 드라이브 보관 look. */
export const PHOTO_DIR = 'C:\\KioskPhotos';

/**
 * A non-production build's own photo folder (beta · kdh · demo — see isBetaBuild).
 *
 * Production and a test build can be installed side by side on one PC (the office
 * test rig, core/appIdentity.ts). With one shared folder each build's 드라이브 보관
 * scans the other's photos and sends them as its own kiosk: on 2026-11-12 three
 * test shots taken with the kdh build were filed under 제주국제공항 by the
 * production app on the same PC, which was set to W008.
 */
export const BETA_PHOTO_DIR = 'C:\\KioskPhotos-beta';

/** The Windows photo folder for a production or a non-production build. */
export function windowsPhotoDir(beta: boolean): string {
  return beta ? BETA_PHOTO_DIR : PHOTO_DIR;
}

class AppPaths {
  /** Read once: which build this is cannot change while it runs. */
  private betaBuild: boolean | undefined;

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

  /**
   * Locally mirrored copies of remote CMS images — AR 한복 outfit cards and
   * 배경 테마 tiles. Written by RemoteImageCache, served as `media://remote/`.
   *
   * userData rather than one of the fixed C:\ folders that photos and videos
   * use: this is a derived cache, not content. Deleting it costs one re-download
   * and nothing else, so it belongs where an uninstall will take it with them.
   */
  get remoteImages(): string {
    return ensureDir(join(this.userData, 'remote-images'));
  }

  /** Directory for log files (electron-log default location mirror). */
  get logs(): string {
    return ensureDir(join(this.userData, 'logs'));
  }

  /**
   * Captured + AI-generated photos (permanent storage, paired by sessionId).
   *
   * Saved to a shallow, easy-to-find top-level folder rather than deep inside
   * AppData. Default `C:\KioskPhotos` on Windows — `C:\KioskPhotos-beta` for a
   * non-production build, so builds sharing a PC never archive each other's
   * photos (windowsPhotoDir); override with PHOTO_SAVE_DIR.
   * Non-Windows (dev on mac/linux) falls back to the userData location.
   */
  get generated(): string {
    const custom = process.env['PHOTO_SAVE_DIR'];
    if (custom && custom.trim()) return ensureDir(custom.trim());
    if (process.platform === 'win32') {
      this.betaBuild ??= isBetaBuild();
      return ensureDir(windowsPhotoDir(this.betaBuild));
    }
    return ensureDir(join(this.userData, 'data', 'generated'));
  }

  /**
   * Display/attract videos. Large and pre-downloaded per kiosk, so they live in a
   * fixed EXTERNAL folder OUTSIDE the app install directory. This is what lets an
   * auto-update replace the app without wiping the videos: the old
   * `resources/videos` lived inside the install dir (process.resourcesPath) and
   * would be lost on every update. Videos are NO LONGER shipped in the installer
   * (removed from electron-builder extraResources) — drop the .mp4s into
   * `<dir>/<set>/` once per machine and updates leave them untouched.
   *
   * The set folders are the VIDEO_SETS names, and the app creates the empty tree
   * on first launch (see video.handlers' listVideoFiles) so the exact folder
   * names are visible on the machine rather than guessed. Note that 제주 is THREE
   * of them — `jeju-airport` (W008), `jeju-terminal` (W009) and `jeju-heritage`
   * (W010) — because those venues share a design but not their footage.
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
