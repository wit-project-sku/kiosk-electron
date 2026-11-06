// 제주 시스템 점검 notice: staff flip it with five quick MOUSE clicks — on the small
// plane in the home screen's top bar, and on the leftmost tangerine of the notice.
// Regression: switching it on used to show the error page ("Something went wrong"),
// because the unmounting 탐나오/제주큐랑 webviews threw from their cleanup.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { startFakeApi, type FakeApi } from './support/fake-api';
import { appWindowErrors, launchKiosk } from './support/launch';

let api: FakeApi;
test.beforeAll(async () => {
  api = await startFakeApi({ mode: 'replay' });
});
test.afterAll(async () => api.close());

const notice = (main: Page): Locator => main.locator('img[src*="maintenance"]');
const noticeSwitch = (main: Page): Locator => main.locator('div[style*="left: 1437px"]');
const plane = (main: Page): Locator => main.locator('[class*="planeSwitch"]');
const date = (main: Page): Locator => main.locator('[class*="dateTime"]').first();
const pin = (main: Page): Locator => main.getByText('JEJU', { exact: true }).first();

// Real mouse clicks at the target's centre, back to back. Not locator.click() in a
// loop: on the Windows CI runner each one waits for the ticking clock to settle,
// and five took ~8 s — past the switch's 3 s window.
async function clickTimes(target: Locator, n: number): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('click target is not visible');
  const page = target.page();
  for (let i = 0; i < n; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

// While the home screen is still loading, the Windows CI runner can stall long
// enough that five clicks outlast the switch's 3 s window, so the gesture is
// repeated until it lands. The notice has no listener at the plane's spot, so an
// extra round cannot flip it back. How many taps count: unit test (maintenanceSwitch).
async function flipWithPlane(main: Page): Promise<void> {
  await expect(async () => {
    await clickTimes(plane(main), 5);
    await expect(notice(main)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 45_000 });
}

test('W008: boots into the notice, and five mouse clicks on the plane bring it back', async () => {
  const kiosk = await launchKiosk({ site: 'W008', apiBase: api.url });
  try {
    const { main } = kiosk;
    // Boots into the notice; five clicks on the leftmost tangerine lift it.
    await expect(notice(main)).toBeVisible({ timeout: 30_000 });
    await clickTimes(noticeSwitch(main), 5);
    await expect(notice(main)).toHaveCount(0);
    await expect(date(main)).toBeVisible();

    // Neither the pin nor the date is the switch.
    await clickTimes(pin(main), 5);
    await clickTimes(date(main), 5);
    await main.waitForTimeout(500);
    await expect(notice(main)).toHaveCount(0);

    // A finger on the plane never counts (pointerType 'touch').
    for (let i = 0; i < 5; i++) {
      await plane(main).dispatchEvent('pointerup', { pointerType: 'touch', bubbles: true });
    }
    await main.waitForTimeout(500);
    await expect(notice(main)).toHaveCount(0);

    // Five mouse clicks on the plane: straight to the notice, no error page.
    await flipWithPlane(main);
    await expect(main.getByText('Something went wrong')).toHaveCount(0);
    const appErrors = appWindowErrors(kiosk.errors);
    expect(appErrors.filter((e) => /WebView|ErrorBoundary|pageerror/.test(e))).toEqual([]);
  } finally {
    await kiosk.close();
  }
});

for (const site of ['W009', 'W010'] as const) {
  test(`${site}: boots into the app, and the plane and tangerine flip the notice`, async () => {
    const kiosk = await launchKiosk({ site, apiBase: api.url });
    try {
      const { main } = kiosk;
      await expect(plane(main)).toBeVisible({ timeout: 30_000 });
      await expect(notice(main)).toHaveCount(0);

      await flipWithPlane(main);

      await clickTimes(noticeSwitch(main), 5);
      await expect(notice(main)).toHaveCount(0);
      await expect(plane(main)).toBeVisible();
    } finally {
      await kiosk.close();
    }
  });
}
