import { describe, expect, it } from 'vitest';
import { KIOSK_LOCATIONS } from '@shared/config/kioskLocations';
import {
  SETUP_ARG,
  SETUP_SITES,
  setupConfirmText,
  setupStateFor,
  siteNumberOf,
  withoutSetupArg,
} from '@shared/config/kioskSetup';

describe('지점 설정 — when the screen opens', () => {
  it('a fresh machine (no config keys, no kiosk.db) must choose a site', () => {
    expect(setupStateFor({ storedKeys: 0, databaseExists: false, pending: false, argv: [] })).toBe(
      'required',
    );
  });

  it('a machine that has run before boots as it did, even unprovisioned', () => {
    // Empty kiosk-config.json but an existing kiosk.db: a live kiosk that relied on
    // the W001 default must not stop at a setup screen after an update.
    expect(
      setupStateFor({ storedKeys: 0, databaseExists: true, pending: false, argv: [] }),
    ).toBeNull();
    // Only the 제주 renumber flag stored (every run since 2026-10-26 writes it).
    expect(
      setupStateFor({ storedKeys: 1, databaseExists: false, pending: false, argv: [] }),
    ).toBeNull();
  });

  it('the desktop shortcut asks for it on a provisioned machine', () => {
    expect(
      setupStateFor({
        storedKeys: 2,
        databaseExists: true,
        pending: false,
        argv: ['app.exe', SETUP_ARG],
      }),
    ).toBe('requested');
  });

  it('a fresh machine stays `required` even when opened from the shortcut', () => {
    expect(
      setupStateFor({ storedKeys: 0, databaseExists: false, pending: false, argv: [SETUP_ARG] }),
    ).toBe('required');
  });

  it('a fresh machine closed without choosing is still fresh on its next launch', () => {
    expect(setupStateFor({ storedKeys: 2, databaseExists: true, pending: true, argv: [] })).toBe(
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

  it('names each site by its kiosk number', () => {
    expect(siteNumberOf('W008')).toBe('008');
    expect(siteNumberOf('W200')).toBe('200');
  });

  it('asks before saving, naming the site and the number its records go under', () => {
    const airport = SETUP_SITES.find((s) => s.code === 'W008')!;
    expect(setupConfirmText(airport).message).toContain(`${airport.name}(008번)`);
    expect(setupConfirmText(airport).detail).toContain('008번');

    const rig = SETUP_SITES.find((s) => s.testRig)!;
    expect(setupConfirmText(rig).detail).toContain('200번');
    expect(setupConfirmText(rig).detail).toContain('핀');
  });
});
