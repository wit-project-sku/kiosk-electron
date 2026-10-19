import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREVIEW_SITE,
  TEST_RIG_KIOSK_ID,
  kioskNumOf,
  resolveKioskIdentity,
} from '@shared/config/testRig';

describe('test rig identity', () => {
  it('a normal kiosk is itself', () => {
    expect(resolveKioskIdentity('W004', 'W006')).toEqual({
      kioskId: 'W004',
      identityKioskId: 'W004',
      testRig: false,
    });
  });

  it('the test rig keeps W200 as identity and shows the preview site', () => {
    expect(resolveKioskIdentity(TEST_RIG_KIOSK_ID, 'W006')).toEqual({
      kioskId: 'W006',
      identityKioskId: 'W200',
      testRig: true,
    });
  });

  it('an unknown or missing preview site falls back to the default site', () => {
    expect(resolveKioskIdentity('W200').kioskId).toBe(DEFAULT_PREVIEW_SITE);
    expect(resolveKioskIdentity('W200', 'W999').kioskId).toBe(DEFAULT_PREVIEW_SITE);
    expect(resolveKioskIdentity('W200', 'W200').kioskId).toBe(DEFAULT_PREVIEW_SITE);
  });

  it('kioskNumOf reads the digits', () => {
    expect(kioskNumOf('W004')).toBe(4);
    expect(kioskNumOf('W200')).toBe(200);
    expect(kioskNumOf('W202')).toBe(202);
    expect(kioskNumOf('')).toBe(1);
  });
});
