import { describe, expect, it } from 'vitest';
import {
  KIOSK_LOCATIONS,
  getKioskLayout,
  getKioskLocation,
  getKioskRegion,
  isJejuLayout,
} from '@shared/config/kioskLocations';

/**
 * The per-site table decides which server rows a kiosk asks for (region on every v2
 * endpoint) and whether the card-terminal payment agent is started. A wrong row here
 * shows another site's shops or leaves a card terminal dead — so the table is pinned.
 * When a site is added or changed on purpose, update this table in the same commit.
 */
const EXPECTED = {
  W001: { layout: 'INSADONG', region: 'INSADONG_NORTH', hasCardTerminal: false },
  W002: { layout: 'INSADONG', region: 'INSADONG_CENTER', hasCardTerminal: false },
  W003: { layout: 'NAM_INSADONG', region: 'INSADONG_SOUTH', hasCardTerminal: true },
  W004: { layout: 'OSAN', region: 'OSAEK', hasCardTerminal: true },
  W005: { layout: 'HWASEONG', region: 'HWASEONG', hasCardTerminal: true },
  W006: { layout: 'JEJU_AIRPORT', region: 'JEJU_AIRPORT', hasCardTerminal: true },
  W007: { layout: 'JEJU_AIRPORT', region: 'JEJU_PORT', hasCardTerminal: true },
  W008: { layout: 'JEJU_HERITAGE', region: 'JEJU_HERITAGE', hasCardTerminal: true },
  W202: { layout: 'KADA', region: null, hasCardTerminal: false },
} as const;

describe('kioskLocations', () => {
  it('has exactly the known sites', () => {
    expect(Object.keys(KIOSK_LOCATIONS).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.entries(EXPECTED))('%s → layout, region and card terminal', (code, want) => {
    const loc = getKioskLocation(code);
    expect(loc.code).toBe(code);
    expect({
      layout: loc.layout,
      region: loc.region,
      hasCardTerminal: loc.hasCardTerminal,
    }).toEqual(want);
    expect(getKioskLayout(code)).toBe(want.layout);
    expect(getKioskRegion(code)).toBe(want.region);
  });

  it('gives every site except KADA its own region (two sites never share server rows)', () => {
    const regions = Object.values(KIOSK_LOCATIONS)
      .map((l) => l.region)
      .filter((r) => r !== null);
    expect(new Set(regions).size).toBe(regions.length);
  });

  it('falls back to W001 for an unprovisioned or unknown id', () => {
    expect(getKioskLocation('W999').code).toBe('W001');
    expect(getKioskLocation('').code).toBe('W001');
  });

  it('marks only the 제주 layouts as Jeju', () => {
    const jeju = Object.values(KIOSK_LOCATIONS)
      .filter((l) => isJejuLayout(l.layout))
      .map((l) => l.code)
      .sort();
    expect(jeju).toEqual(['W006', 'W007', 'W008']);
  });
});
