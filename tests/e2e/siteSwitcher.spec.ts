// Stage-only site switcher: on a build whose API base is a stage server, ONE MOUSE click
// on the home screen's location pin opens the site menu; touch never does, and a
// production server never shows it. The machine keeps its kiosk id (previewSite).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { startFakeApi, type FakeApi } from './support/fake-api';
import { launchKiosk } from './support/launch';
import { waitForQuiet } from './support/wait';

let api: FakeApi;
test.beforeAll(async () => {
  api = await startFakeApi({ mode: 'replay' });
});
test.afterAll(async () => api.close());

const STAGE = { KIOSK_E2E_STAGE: '1' };
const hotspot = (main: Page): Locator =>
  main.getByRole('button', { name: '키오스크 전환 메뉴 표시' });
const menu = (main: Page): Locator => main.getByRole('dialog', { name: '키오스크 위치 선택' });

test('production server: no site switcher at all', async () => {
  const kiosk = await launchKiosk({ site: 'W009', apiBase: api.url });
  try {
    await expect(kiosk.main.locator('#root > *').first()).toBeVisible();
    await kiosk.main.waitForTimeout(1_000);
    await expect(hotspot(kiosk.main)).toHaveCount(0);
  } finally {
    await kiosk.close();
  }
});

test('stage server: a mouse click on the pin opens the menu, a touch does not', async () => {
  const kiosk = await launchKiosk({ site: 'W009', apiBase: api.url, env: STAGE });
  try {
    const { main } = kiosk;
    await expect(hotspot(main)).toHaveCount(1, { timeout: 30_000 });

    for (let i = 0; i < 3; i++) {
      await hotspot(main).dispatchEvent('pointerup', { pointerType: 'touch', bubbles: true });
    }
    await main.waitForTimeout(500);
    await expect(menu(main)).toHaveCount(0);

    await hotspot(main).click();
    await expect(menu(main)).toBeVisible();
    await expect(menu(main).getByText('제주국제여객터미널 (이 PC)')).toBeVisible();
    await expect(menu(main).getByText(/stage 서버 빌드에서만/)).toBeVisible();
  } finally {
    await kiosk.close();
  }
});

test('stage server: a venue PC keeps its id and shows the chosen site', async () => {
  const before = api.requests.length;
  const kiosk = await launchKiosk({
    site: 'W008',
    apiBase: api.url,
    env: STAGE,
    kioskConfig: { previewSite: 'W004' },
  });
  try {
    await expect(kiosk.main.locator('#root > *').first()).toBeVisible();
    await waitForQuiet(api, 4_000, 45_000);
    const keys = api.requests.slice(before).map((r) => r.key);
    expect(keys).toContain('GET /api/shops/v2?region=OSAEK');
    expect(keys).not.toContain('GET /api/shops/v2?region=JEJU_AIRPORT');
  } finally {
    await kiosk.close();
  }
});

test('production server: a leftover previewSite is ignored', async () => {
  const before = api.requests.length;
  const kiosk = await launchKiosk({
    site: 'W009',
    apiBase: api.url,
    kioskConfig: { previewSite: 'W004' },
  });
  try {
    await expect(kiosk.main.locator('#root > *').first()).toBeVisible();
    await waitForQuiet(api, 4_000, 45_000);
    const keys = api.requests.slice(before).map((r) => r.key);
    expect(keys).toContain('GET /api/shops/v2?region=JEJU_PORT');
    expect(keys).not.toContain('GET /api/shops/v2?region=OSAEK');
  } finally {
    await kiosk.close();
  }
});
