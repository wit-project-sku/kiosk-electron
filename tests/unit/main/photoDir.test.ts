import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getPath: () => '/tmp', getAppPath: () => '/tmp' } }));
vi.mock('@electron-toolkit/utils', () => ({ electronApp: { setAppUserModelId: vi.fn() } }));

import { BETA_PHOTO_DIR, PHOTO_DIR, windowsPhotoDir } from '@main/core/paths';

describe('photo folder — a test build never shares production’s', () => {
  it('production keeps C:\\KioskPhotos, where staff and the 드라이브 보관 look', () => {
    expect(windowsPhotoDir(false)).toBe('C:\\KioskPhotos');
    expect(PHOTO_DIR).toBe('C:\\KioskPhotos');
  });

  it('a beta / kdh build saves to its own folder', () => {
    // Side by side on one PC, a shared folder let the production app (set to W008)
    // archive the kdh build's test shots as 제주국제공항 (2026-11-12).
    expect(windowsPhotoDir(true)).toBe('C:\\KioskPhotos-beta');
    expect(BETA_PHOTO_DIR).not.toBe(PHOTO_DIR);
  });
});
