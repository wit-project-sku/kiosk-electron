import { describe, expect, it } from 'vitest';
import { migrateStoredSite } from '@shared/config/kioskRenumber';
import { sheetSiteOf } from '@shared/config/kioskLocations';

const fresh = { jejuShifted: true, v224Shifted: true };

describe('kiosk renumber — stored site codes', () => {
  it('moves 유산본부 W010 → W011 and 롯데 W011~W013 → W012~W014 once (V224)', () => {
    const cases: Array<[string, string]> = [
      ['W010', 'W011'],
      ['W011', 'W012'],
      ['W012', 'W013'],
      ['W013', 'W014'],
    ];
    for (const [from, to] of cases) {
      const r = migrateStoredSite({ kioskId: from, jejuShifted: true, v224Shifted: false });
      expect(r.kioskId, from).toBe(to);
      expect(r.changed).toEqual(['kioskId']);
    }
  });

  it('leaves every other site alone', () => {
    for (const code of ['W001', 'W004', 'W008', 'W009', 'W200', 'W202']) {
      expect(migrateStoredSite({ kioskId: code, jejuShifted: true, v224Shifted: false })).toEqual({
        kioskId: code,
        previewSite: undefined,
        changed: [],
      });
    }
  });

  it('never moves a code twice — the flag says it is already new', () => {
    expect(migrateStoredSite({ kioskId: 'W011', ...fresh }).kioskId).toBe('W011');
    expect(migrateStoredSite({ kioskId: 'W012', previewSite: 'W013', ...fresh })).toMatchObject({
      kioskId: 'W012',
      previewSite: 'W013',
      changed: [],
    });
  });

  it('moves a test kiosk preview site too, keeping its identity', () => {
    expect(
      migrateStoredSite({
        kioskId: 'W200',
        previewSite: 'W011',
        jejuShifted: true,
        v224Shifted: false,
      }),
    ).toEqual({ kioskId: 'W200', previewSite: 'W012', changed: ['previewSite'] });
  });

  it('chains both renumbers for a PC provisioned before 2026-10-26 (old 유산본부 W008)', () => {
    expect(
      migrateStoredSite({ kioskId: 'W008', jejuShifted: false, v224Shifted: false }).kioskId,
    ).toBe('W011');
    // …and a 2026-10-26-era 제주공항 W008 (jeju flag set) stays 제주공항.
    expect(
      migrateStoredSite({ kioskId: 'W008', jejuShifted: true, v224Shifted: false }).kioskId,
    ).toBe('W008');
  });
});

describe('sheetSiteOf — the content sheets keep their pre-V224 row suffixes', () => {
  it('maps 유산본부 and 롯데 to the sheet suffix and passes other sites through', () => {
    expect(sheetSiteOf('W011')).toBe('W010');
    expect(sheetSiteOf('W012')).toBe('W011');
    expect(sheetSiteOf('W013')).toBe('W012');
    expect(sheetSiteOf('W014')).toBe('W013');
    expect(sheetSiteOf('W008')).toBe('W008');
    expect(sheetSiteOf('W999')).toBe('W999');
  });
});
