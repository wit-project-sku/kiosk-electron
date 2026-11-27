import { describe, expect, it } from 'vitest';
import { OFFICE_PCS } from '@shared/config/testRig';
import { KIOSK_LOCATIONS } from '@shared/config/kioskLocations';
import {
  SETUP_ARG,
  setupSites,
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
  const SETUP_SITES = setupSites({ stageServer: false });

  const num = (code: string): number => Number(code.replace(/\D/g, ''));

  it('offers every venue and office PC once each, in kiosk-number order', () => {
    const codes = SETUP_SITES.map((s) => s.code);
    const live = Object.values(KIOSK_LOCATIONS)
      .filter((l) => !l.setupStageOnly)
      .map((l) => l.code);
    const office = OFFICE_PCS.filter((pc) => !pc.stageOnly).map((pc) => pc.code);
    expect([...codes].sort()).toEqual([...live, ...office].sort());
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.map(num)).toEqual([...codes.map(num)].sort((x, y) => x - y));
    for (const code of office)
      expect(SETUP_SITES.find((s) => s.code === code)?.testRig, code).toBe(true);
    expect(SETUP_SITES.find((s) => s.code === 'W008')?.testRig).toBe(false);
  });

  it('a stage build offers every kiosk number the stage server has (1~6, 8~14, 200~202)', () => {
    expect(setupSites({ stageServer: true }).map((s) => num(s.code))).toEqual([
      1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 200, 201, 202,
    ]);
  });

  it('a production build leaves out what production does not have yet: 롯데 W012~W014 and HQ W010', () => {
    const production = SETUP_SITES.map((s) => s.code);
    const stage = setupSites({ stageServer: true }).map((s) => s.code);
    for (const code of ['W012', 'W013', 'W014'] as const) {
      expect(KIOSK_LOCATIONS[code].setupStageOnly).toBe(true);
      expect(production).not.toContain(code);
      expect(stage).toContain(code);
    }
    expect(production).not.toContain('W010');
    expect(stage).toContain('W010');
    expect(production.map(num)).toEqual([1, 2, 3, 4, 5, 6, 8, 9, 11, 200, 201, 202]);
  });

  it('numbers 세계자연유산본부 11 and 롯데 12~14, the server kiosk ids since V224', () => {
    expect(KIOSK_LOCATIONS.W011.name).toBe('세계자연유산본부');
    expect(KIOSK_LOCATIONS.W012.name).toBe('롯데월드몰');
    expect(KIOSK_LOCATIONS.W013.name).toBe('롯데백화점 청량리점');
    expect(KIOSK_LOCATIONS.W014.name).toBe('롯데백화점 건대스타시티점');
    expect(Object.keys(KIOSK_LOCATIONS)).not.toContain('W010');
  });

  it('names each site by its kiosk number', () => {
    expect(siteNumberOf('W008')).toBe('008');
    expect(siteNumberOf('W200')).toBe('200');
  });

  it('asks before saving, naming the site and the number its records go under', () => {
    const airport = SETUP_SITES.find((s) => s.code === 'W008')!;
    expect(setupConfirmText(airport).message).toContain(`${airport.name}(008번)`);
    expect(setupConfirmText(airport).detail).toContain('008번');

    const rig = SETUP_SITES.find((s) => s.code === 'W200')!;
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
