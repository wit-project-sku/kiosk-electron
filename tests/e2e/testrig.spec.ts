// The office test kiosk (W200) shows any site's app but stays kiosk 200 to the server:
// content follows the preview site, crash reports carry the identity.
import { expect, test } from '@playwright/test';
import { startFakeApi, type FakeApi } from './support/fake-api';
import { killHard, launchKiosk, removeDir } from './support/launch';

let api: FakeApi;
test.beforeAll(async () => {
  api = await startFakeApi();
});
test.afterAll(async () => api.close());

test('W200 previewing 오색 loads 오색 content and reports crashes as kiosk 200', async () => {
  const before = api.requests.length;
  const first = await launchKiosk({
    site: 'W200',
    kioskConfig: { previewSite: 'W004' },
    apiBase: api.url,
    keepUserData: true,
  });
  const userData = first.userData;
  try {
    // 오색's home: its own tiles, and 오색 content requested from the server.
    await expect(first.main.getByRole('button', { name: /정이.*뭐먹지/ }).first()).toBeVisible();
    await expect
      .poll(() => api.requests.slice(before).map((r) => r.key))
      .toContain('GET /api/shops/v2?region=OSAEK');

    await first.main.waitForTimeout(1_500);
    killHard(first.app);
    await first.app.waitForEvent('close', { timeout: 10_000 }).catch(() => undefined);

    const second = await launchKiosk({
      site: 'W200',
      kioskConfig: { previewSite: 'W004' },
      apiBase: api.url,
      userData,
      keepUserData: true,
    });
    const reports = () =>
      api.requests.filter((r) => r.method === 'POST' && r.url.endsWith('/crash-reports'));
    await expect.poll(() => reports().length, { timeout: 20_000 }).toBeGreaterThan(0);
    const last = reports().at(-1);
    expect(last?.url).toBe('/api/kiosks/200/crash-reports');
    expect(last?.body).toMatchObject({ kind: 'ABNORMAL_EXIT', kioskCode: 'W200' });
    await second.close();
  } finally {
    removeDir(userData);
  }
});
