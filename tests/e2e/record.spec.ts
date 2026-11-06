// Re-record the fake backend's fixtures from stage. Not part of the normal run:
//   npm run test:e2e:record   (playwright.record.config.ts sets RECORD=1)
// Each site boots against a recording proxy; every GET it makes (plus read-only course
// POSTs) is saved trimmed to tests/e2e/fixtures/api. Writes are answered locally and
// never reach stage. Review the diff before committing — the repo is public.
import { test } from '@playwright/test';
import { startFakeApi, type FakeApi } from './support/fake-api';
import { SITES, launchKiosk } from './support/launch';
import { waitForQuiet } from './support/wait';

const UPSTREAM = process.env['RECORD_UPSTREAM'] ?? 'https://api-stage-v3.witteria.com';

test.describe('record fixtures', () => {
  test.skip(
    !process.env['RECORD'],
    'run `npm run test:e2e:record` to re-record fixtures from stage',
  );

  let api: FakeApi;
  test.beforeAll(async () => {
    api = await startFakeApi({ mode: 'record', upstream: UPSTREAM });
  });
  test.afterAll(async () => api.close());

  for (const site of SITES) {
    test(`record ${site}`, async () => {
      const kiosk = await launchKiosk({ site, apiBase: api.url });
      try {
        await waitForQuiet(api, 6_000, 60_000);
      } finally {
        await kiosk.close();
      }
    });
  }
});
