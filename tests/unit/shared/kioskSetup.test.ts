import { describe, expect, it } from 'vitest';
import { KIOSK_LOCATIONS } from '@shared/config/kioskLocations';
import {
  SETUP_ARG,
  SETUP_SITES,
  confirmCodeOf,
  confirmMatches,
  isSetupSite,
  setupStateFor,
  withoutSetupArg,
} from '@shared/config/kioskSetup';

describe('지점 설정 — when the screen opens', () => {
  it('a fresh machine (no config keys, no kiosk.db) must choose a site', () => {
    expect(setupStateFor({ storedKeys: 0, databaseExists: false, argv: [] })).toBe('required');
  });

  it('a machine that has run before boots as it did, even unprovisioned', () => {
    // Empty kiosk-config.json but an existing kiosk.db: a live kiosk that relied on
    // the W001 default must not stop at a setup screen after an update.
    expect(setupStateFor({ storedKeys: 0, databaseExists: true, argv: [] })).toBeNull();
    // Only the 제주 renumber flag stored (every run since 2026-10-26 writes it).
    expect(setupStateFor({ storedKeys: 1, databaseExists: false, argv: [] })).toBeNull();
  });

  it('the desktop shortcut asks for it on a provisioned machine', () => {
    expect(
      setupStateFor({ storedKeys: 2, databaseExists: true, argv: ['app.exe', SETUP_ARG] }),
    ).toBe('requested');
  });

  it('a fresh machine stays `required` even when opened from the shortcut', () => {
    expect(setupStateFor({ storedKeys: 0, databaseExists: false, argv: [SETUP_ARG] })).toBe(
      'required',
    );
  });

  it('the restart after saving drops --setup', () => {
    expect(withoutSetupArg(['.', SETUP_ARG, '--foo'])).toEqual(['.', '--foo']);
  });
});

describe('지점 설정 — sites and confirmation', () => {
  it('offers every site plus the office test kiosk, once each', () => {
    const codes = SETUP_SITES.map((s) => s.code);
    expect(codes).toEqual([...Object.keys(KIOSK_LOCATIONS), 'W200']);
    expect(new Set(codes).size).toBe(codes.length);
    expect(SETUP_SITES.find((s) => s.code === 'W200')?.testRig).toBe(true);
  });

  it('carries each site’s terminal and donation flags from kioskLocations', () => {
    for (const loc of Object.values(KIOSK_LOCATIONS)) {
      const site = SETUP_SITES.find((s) => s.code === loc.code)!;
      expect(site).toMatchObject({
        name: loc.name,
        hasCardTerminal: loc.hasCardTerminal,
        hasDonation: loc.hasDonation,
      });
    }
  });

  it('accepts only known codes', () => {
    expect(isSetupSite('W008')).toBe(true);
    expect(isSetupSite('W200')).toBe(true);
    expect(isSetupSite('W006')).toBe(false);
    expect(isSetupSite('')).toBe(false);
  });

  it('confirms with the kiosk number, leading zeros optional', () => {
    expect(confirmCodeOf('W008')).toBe('008');
    expect(confirmCodeOf('W200')).toBe('200');
    expect(confirmMatches('W008', '008')).toBe(true);
    expect(confirmMatches('W008', '8')).toBe(true);
    expect(confirmMatches('W200', '200')).toBe(true);
  });

  it('rejects another number, an empty entry and anything not digits', () => {
    expect(confirmMatches('W008', '009')).toBe(false);
    expect(confirmMatches('W008', '')).toBe(false);
    expect(confirmMatches('W008', 'W008')).toBe(false);
    expect(confirmMatches('W010', '1')).toBe(false);
  });
});
