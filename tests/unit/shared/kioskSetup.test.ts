import { describe, expect, it } from 'vitest';
import { KIOSK_LOCATIONS } from '@shared/config/kioskLocations';
import {
  SETUP_ARG,
  SETUP_SITES,
  setupActions,
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
    const live = Object.values(KIOSK_LOCATIONS).filter((l) => !l.notInSetup);
    expect(codes).toEqual([...live.map((l) => l.code), 'W200']);
    expect(new Set(codes).size).toBe(codes.length);
    expect(SETUP_SITES.find((s) => s.code === 'W200')?.testRig).toBe(true);
  });

  it('leaves out the 롯데 sites still being built (no kiosk of that number on the server)', () => {
    const codes = SETUP_SITES.map((s) => s.code);
    for (const code of ['W011', 'W012', 'W013'] as const) {
      expect(KIOSK_LOCATIONS[code].notInSetup).toBe(true);
      expect(codes).not.toContain(code);
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

describe('지점 설정 — footer buttons', () => {
  it('the shortcut with the app off starts the kiosk as it is', () => {
    expect(setupActions('requested', false)).toEqual({
      closeLabel: '닫기',
      primary: 'launch',
      primaryLabel: '앱 실행',
      primaryEnabled: true,
    });
  });

  it('choosing another site there saves it and starts as that site', () => {
    expect(setupActions('requested', true)).toMatchObject({
      primary: 'save',
      primaryLabel: '저장하고 실행',
      primaryEnabled: true,
    });
  });

  it('a fresh PC cannot start before a site is saved', () => {
    expect(setupActions('required', false)).toMatchObject({
      closeLabel: '나중에 하기',
      primary: 'save',
      primaryEnabled: false,
    });
    expect(setupActions('required', true)).toMatchObject({
      primary: 'save',
      primaryLabel: '저장하고 실행',
      primaryEnabled: true,
    });
  });

  it('over a running kiosk there is nothing to launch — only save', () => {
    expect(setupActions(null, false)).toMatchObject({
      primary: 'save',
      primaryLabel: '저장',
      primaryEnabled: false,
    });
    expect(setupActions(null, true)).toMatchObject({ primary: 'save', primaryEnabled: true });
  });
});
