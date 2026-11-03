// 제주공항 (W008) 시스템 점검 notice: staff flip it with five quick MOUSE clicks — on the
// date (top right) of the home screen, and on the leftmost tangerine of the notice.
// Regression: switching it on used to show the error page ("Something went wrong"),
// because the unmounting 탐나오/제주큐랑 webviews threw from their cleanup.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { startFakeApi, type FakeApi } from './support/fake-api';
import { launchKiosk } from './support/launch';

let api: FakeApi;
test.beforeAll(async () => {
  api = await startFakeApi({ mode: 'replay' });
});
test.afterAll(async () => api.close());

const notice = (main: Page): Locator => main.locator('img[src*="maintenance"]');
const noticeSwitch = (main: Page): Locator => main.locator('div[style*="left: 1437px"]');
const date = (main: Page): Locator => main.locator('[class*="dateTime"]').first();
const pin = (main: Page): Locator => main.getByText('JEJU', { exact: true }).first();

async function clickTimes(target: Locator, n: number): Promise<void> {
  for (let i = 0; i < n; i++) await target.click();
}

test('W008: five mouse clicks on the date open the 점검 notice directly', async () => {
  const kiosk = await launchKiosk({ site: 'W008', apiBase: api.url });
  try {
    const { main } = kiosk;
    // Boots into the notice; five clicks on the leftmost tangerine lift it.
    await expect(notice(main)).toBeVisible({ timeout: 30_000 });
    await clickTimes(noticeSwitch(main), 5);
    await expect(notice(main)).toHaveCount(0);
    await expect(date(main)).toBeVisible();

    // The pin is no longer the switch.
    await clickTimes(pin(main), 5);
    await main.waitForTimeout(500);
    await expect(notice(main)).toHaveCount(0);

    // A finger on the date never counts (pointerType 'touch').
    for (let i = 0; i < 5; i++) {
      await date(main).dispatchEvent('pointerup', { pointerType: 'touch', bubbles: true });
    }
    await main.waitForTimeout(500);
    await expect(notice(main)).toHaveCount(0);

    // Five mouse clicks on the date: straight to the notice, no error page.
    await clickTimes(date(main), 5);
    await expect(notice(main)).toBeVisible();
    await expect(main.getByText('Something went wrong')).toHaveCount(0);
    expect(kiosk.errors.filter((e) => /WebView|ErrorBoundary|pageerror/.test(e))).toEqual([]);
  } finally {
    await kiosk.close();
  }
});
