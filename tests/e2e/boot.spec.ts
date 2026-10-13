// Every site boots to its home screen against the fake backend, asks the server for
// its own region, and makes no request the fixtures do not know (= no contract drift).
import { expect, test } from '@playwright/test';
import { getKioskRegion } from '@shared/config/kioskLocations';
import { startFakeApi, type FakeApi } from './support/fake-api';
import { SITES, launchKiosk } from './support/launch';
import { waitForQuiet } from './support/wait';

let api: FakeApi;
test.beforeAll(async () => {
  api = await startFakeApi({ mode: 'replay' });
});
test.afterAll(async () => api.close());

for (const site of SITES) {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the fixture object pattern
  test(`${site} boots to home`, async ({}, testInfo) => {
    const before = api.requests.length;
    const unmatchedBefore = api.unmatched.length;
    const kiosk = await launchKiosk({ site, apiBase: api.url });
    try {
      // The layout paints synchronously from bootstrap state; give background fetches time.
      await expect(kiosk.main.locator('#root > *').first()).toBeVisible();
      await waitForQuiet(api, 4_000, 45_000);

      const shot = testInfo.outputPath(`${site}-home.png`);
      await kiosk.main.screenshot({ path: shot });
      await testInfo.attach(`${site}-home.png`, { path: shot, contentType: 'image/png' });

      const mine = api.requests.slice(before);
      const region = getKioskRegion(site);
      if (region) {
        expect(mine.map((r) => r.key)).toContain(`GET /api/shops/v2?region=${region}`);
        expect(mine.map((r) => r.key)).toContain(`GET /api/kiosks/${region}/buttons/v2`);
      }
      expect(api.unmatched.slice(unmatchedBefore), 'requests without a recorded fixture').toEqual(
        [],
      );
      expect(
        kiosk.errors.filter((e) => e.includes('pageerror')),
        'uncaught errors in a window',
      ).toEqual([]);
      if (kiosk.errors.length) {
        await testInfo.attach(`${site}-console-errors.txt`, { body: kiosk.errors.join('\n') });
      }
    } finally {
      await kiosk.close();
    }
  });
}
