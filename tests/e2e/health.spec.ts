// A run that dies without quitting is reported at the next launch: the kiosk sends
// ABNORMAL_EXIT to POST /api/kiosks/{kioskNum}/crash-reports. A normal quit sends
// nothing. (In the field this is what made the October shutdowns invisible.)
import { rmSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { startFakeApi, type FakeApi } from './support/fake-api';
import { launchKiosk } from './support/launch';

let api: FakeApi;
test.beforeAll(async () => {
  api = await startFakeApi();
});
test.afterAll(async () => api.close());

const crashReports = () =>
  api.requests.filter((r) => r.method === 'POST' && r.url === '/api/kiosks/4/crash-reports');

test('a killed run is reported as ABNORMAL_EXIT at the next launch; a clean quit is not', async () => {
  const first = await launchKiosk({ site: 'W004', apiBase: api.url, keepUserData: true });
  const userData = first.userData;
  try {
    await expect(first.main.locator('#root > *').first()).toBeVisible();
    // Let the run-state heartbeat file exist, then die without quitting.
    await first.main.waitForTimeout(1_500);
    first.app.process().kill('SIGKILL');
    await first.app.waitForEvent('close').catch(() => undefined);

    const before = crashReports().length;
    const second = await launchKiosk({
      site: 'W004',
      apiBase: api.url,
      userData,
      keepUserData: true,
    });
    await expect.poll(() => crashReports().length, { timeout: 20_000 }).toBe(before + 1);
    const report = crashReports().at(-1)?.body as Record<string, unknown>;
    expect(report).toMatchObject({
      kind: 'ABNORMAL_EXIT',
      kioskCode: 'W004',
      suspectedCause: 'APP_CRASH',
    });
    expect(typeof report['appVersion']).toBe('string');
    expect(report['occurredAt']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);

    // A normal quit marks the run clean: the third launch reports nothing new.
    await second.close();
    const afterClean = crashReports().length;
    const third = await launchKiosk({
      site: 'W004',
      apiBase: api.url,
      userData,
      keepUserData: true,
    });
    await expect(third.main.locator('#root > *').first()).toBeVisible();
    await third.main.waitForTimeout(3_000);
    expect(crashReports().length).toBe(afterClean);
    await third.close();
  } finally {
    rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
