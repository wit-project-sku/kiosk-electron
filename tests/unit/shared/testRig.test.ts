import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PREVIEW_SITE,
  TEST_RIG_KIOSK_ID,
  isStageApiBase,
  kioskNumOf,
  planSiteSwitch,
  resolveKioskIdentity,
} from '@shared/config/testRig';

describe('test rig identity', () => {
  it('a normal kiosk is itself', () => {
    expect(resolveKioskIdentity('W004', 'W008')).toEqual({
      kioskId: 'W004',
      identityKioskId: 'W004',
      testRig: false,
    });
  });

  it('the test rig keeps W200 as identity and shows the preview site', () => {
    expect(resolveKioskIdentity(TEST_RIG_KIOSK_ID, 'W008')).toEqual({
      kioskId: 'W008',
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

describe('stage servers', () => {
  it('detects a stage API base by its host label', () => {
    expect(isStageApiBase('https://api-stage-v3.witteria.com')).toBe(true);
    expect(isStageApiBase('https://stage.example.test/')).toBe(true);
    expect(isStageApiBase('https://api-v3.witteria.com')).toBe(false);
    expect(isStageApiBase('https://backstage.example.test')).toBe(false);
    expect(isStageApiBase('')).toBe(false);
    expect(isStageApiBase('not a url')).toBe(false);
  });

  it('a venue machine on stage keeps its identity and shows the preview site', () => {
    expect(resolveKioskIdentity('W008', 'W004', { stageServer: true })).toEqual({
      kioskId: 'W004',
      identityKioskId: 'W008',
      testRig: false,
    });
    expect(resolveKioskIdentity('W008', undefined, { stageServer: true }).kioskId).toBe('W008');
    expect(resolveKioskIdentity('W008', 'W999', { stageServer: true }).kioskId).toBe('W008');
  });

  it('a production server ignores a previewSite left in kiosk-config.json', () => {
    expect(resolveKioskIdentity('W008', 'W004')).toEqual({
      kioskId: 'W008',
      identityKioskId: 'W008',
      testRig: false,
    });
  });
});

describe('planSiteSwitch', () => {
  const venue = { kioskId: 'W008', identityKioskId: 'W008' };

  it('refuses on a production build without dev mode or the test rig', () => {
    expect(planSiteSwitch(venue, 'W004', false)).toEqual({ kind: 'denied' });
  });

  it('on stage keeps the identity: preview another site, clear it to come back', () => {
    expect(planSiteSwitch({ ...venue, stageServer: true }, 'W004', false)).toEqual({
      kind: 'preview',
      site: 'W004',
    });
    expect(
      planSiteSwitch(
        { kioskId: 'W004', identityKioskId: 'W008', stageServer: true },
        'W008',
        false,
      ),
    ).toEqual({ kind: 'clearPreview' });
    expect(planSiteSwitch({ ...venue, stageServer: true }, 'W008', false)).toEqual({
      kind: 'none',
    });
  });

  it('stage wins over dev mode (beta builds keep the identity too)', () => {
    expect(planSiteSwitch({ ...venue, stageServer: true }, 'W001', true).kind).toBe('preview');
  });

  it('the test rig always previews; dev mode elsewhere becomes the new kiosk', () => {
    expect(
      planSiteSwitch({ kioskId: 'W001', identityKioskId: 'W200', testRig: true }, 'W004', false),
    ).toEqual({ kind: 'preview', site: 'W004' });
    expect(planSiteSwitch(venue, 'W004', true)).toEqual({ kind: 'kioskId', site: 'W004' });
  });
});
