import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAINTENANCE_KIOSKS,
  TAP_WINDOW_MS,
  readMaintenanceLifted,
  registerTap,
  writeMaintenanceLifted,
} from '../../../src/layouts/jeju/maintenance';

describe('제주 점검 switch — counting taps', () => {
  const tapAt = (times: number[]): { taps: number[]; triggered: boolean } => {
    let state: { taps: number[]; triggered: boolean } = { taps: [], triggered: false };
    for (const now of times) state = registerTap(state.taps, now);
    return state;
  };

  it('four taps are not enough, the fifth flips it and the count starts over', () => {
    expect(tapAt([0, 100, 200, 300]).triggered).toBe(false);
    expect(tapAt([0, 100, 200, 300, 400])).toEqual({ taps: [], triggered: true });
  });

  it('taps older than the window do not count', () => {
    expect(tapAt([0, 100, 200, 300, TAP_WINDOW_MS + 50]).triggered).toBe(false);
  });
});

describe('제주 점검 notice — whether it is up', () => {
  const storage = (value: string | null): void => {
    vi.stubGlobal('localStorage', {
      getItem: () => value,
      setItem: vi.fn(),
    });
  };
  afterEach(() => vi.unstubAllGlobals());

  it('is available on all three 제주 kiosks', () => {
    expect([...MAINTENANCE_KIOSKS].sort()).toEqual(['W008', 'W009', 'W010']);
  });

  it('제주공항 shows it until first lifted; the other two start in the app', () => {
    storage(null);
    expect(readMaintenanceLifted('W008')).toBe(false);
    expect(readMaintenanceLifted('W009')).toBe(true);
    expect(readMaintenanceLifted('W010')).toBe(true);
  });

  it('a saved choice wins on every kiosk', () => {
    storage('1');
    expect(readMaintenanceLifted('W008')).toBe(true);
    storage('0');
    expect(readMaintenanceLifted('W009')).toBe(false);
  });

  it('without storage each kiosk falls back to its default', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('unavailable');
      },
      setItem: () => {
        throw new Error('unavailable');
      },
    });
    expect(readMaintenanceLifted('W008')).toBe(false);
    expect(readMaintenanceLifted('W010')).toBe(true);
    expect(() => writeMaintenanceLifted(true)).not.toThrow();
  });
});
