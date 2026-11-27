import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/core/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

import { StatsService } from '@main/services/StatsService';
import type { KioskService } from '@main/services/KioskService';
import type { FailedRequestService } from '@main/services/FailedRequestService';

/** shotsV2Url is private; the URL is the only thing under test here. */
const urlOf = (): string =>
  (
    new StatsService({} as KioskService, {} as FailedRequestService) as unknown as {
      shotsV2Url(): string;
    }
  ).shotsV2Url();

afterEach(() => {
  delete process.env['WITTERIA_API_BASE'];
  delete process.env['STATS_SHOTS_V2_URL'];
});

describe('제주 measurement shots URL', () => {
  it('defaults to /api/stats/shots/measurement on the configured API base', () => {
    process.env['WITTERIA_API_BASE'] = 'https://api.example.test/';
    expect(urlOf()).toBe('https://api.example.test/api/stats/shots/measurement');
  });

  it('still honours the STATS_SHOTS_V2_URL override from existing .env files', () => {
    process.env['STATS_SHOTS_V2_URL'] = 'https://override.example.test/shots';
    expect(urlOf()).toBe('https://override.example.test/shots');
  });
});
