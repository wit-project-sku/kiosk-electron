import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/core/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

import { StatsService } from '@main/services/StatsService';
import type { KioskService } from '@main/services/KioskService';
import type { FailedRequestService } from '@main/services/FailedRequestService';

/** The test kiosk: it is 200 and currently shows 화성휴게소 (5). */
const previewing = {
  kioskNum: () => 5,
  identityNum: () => 200,
  getConfig: () => ({ layout: 'hwaseong' }),
} as unknown as KioskService;

const sentBodies = (): Record<string, unknown>[] =>
  vi
    .mocked(fetch)
    .mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)) as never);

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['WITTERIA_API_BASE'];
});

describe('shot statistics', () => {
  it('are recorded under the machine’s own id, not the site it is showing', async () => {
    process.env['WITTERIA_API_BASE'] = 'https://api.example.test';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ success: true })),
    );
    const stats = new StatsService(previewing, {} as FailedRequestService);

    await stats.recordShot({ isSuccess: true, outfitCode: '1.1' } as never);

    expect(sentBodies()[0]).toMatchObject({ kioskId: 200, isSuccess: true });
  });
});
