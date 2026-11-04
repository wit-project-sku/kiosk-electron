// 지점 설정 (shared/config/kioskSetup.ts): a fresh PC chooses its site on screen
// instead of through provision-kiosk, and the desktop shortcut (--setup) opens the
// same screen over a running kiosk.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { startFakeApi, type FakeApi } from './support/fake-api';
import { launchKiosk } from './support/launch';

let api: FakeApi;
test.beforeAll(async () => {
  api = await startFakeApi({ mode: 'replay' });
});
test.afterAll(async () => api.close());

const setup = (main: Page): Locator => main.getByRole('dialog', { name: '키오스크 지점 설정' });
const key = (main: Page, label: string): Locator =>
  setup(main).getByRole('button', { name: label, exact: true });

test('a fresh PC opens only the setup screen and becomes the site it confirms', async () => {
  const kiosk = await launchKiosk({
    site: 'W001',
    apiBase: api.url,
    fresh: true,
    keepUserData: true,
  });
  try {
    const { main } = kiosk;
    await expect(setup(main)).toBeVisible({ timeout: 30_000 });
    // Nothing to close and nothing behind it: the kiosk is not shown yet.
    await expect(setup(main).getByRole('button', { name: '닫기' })).toHaveCount(0);
    await expect(main.locator('#root > *')).toHaveCount(1);
    // Nothing is "current" on a machine that is no kiosk yet.
    await expect(setup(main).getByText('현재', { exact: true })).toHaveCount(0);

    await setup(main)
      .getByRole('button', { name: /오산시 오색시장/ })
      .click();
    await expect(setup(main).getByText('키오스크 번호', { exact: true })).toBeVisible();
    const save = setup(main).getByRole('button', { name: '저장하고 다시 시작' });

    // A wrong number never enables saving.
    await key(main, '5').click();
    await expect(save).toBeDisabled();
    await key(main, '전체 지움').click();
    for (const d of ['0', '0', '4']) await key(main, d).click();
    await expect(save).toBeEnabled();
    await save.click();

    // Unpackaged, the app reloads in place (a packaged build restarts) as W004.
    await expect(setup(main)).toHaveCount(0, { timeout: 30_000 });
    await expect(main.locator('#root > *').first()).toBeVisible();
    const stored = JSON.parse(readFileSync(join(kiosk.userData, 'kiosk-config.json'), 'utf8'));
    expect(stored).toMatchObject({ kioskId: 'W004', jejuIdShift202610: true });
    expect(stored.previewSite).toBeUndefined();
  } finally {
    await kiosk.close();
  }
});

test('the desktop shortcut (--setup) opens it over a provisioned kiosk, and it closes', async () => {
  const kiosk = await launchKiosk({ site: 'W009', apiBase: api.url, args: ['--setup'] });
  try {
    const { main } = kiosk;
    await expect(setup(main)).toBeVisible({ timeout: 30_000 });
    // This PC's own site is marked and cannot be picked again.
    const own = setup(main).getByRole('button', { name: /제주국제여객터미널/ });
    await expect(own).toBeDisabled();
    await expect(own).toContainText('현재');

    await setup(main).getByRole('button', { name: '닫기' }).click();
    await expect(setup(main)).toHaveCount(0);
    const stored = JSON.parse(readFileSync(join(kiosk.userData, 'kiosk-config.json'), 'utf8'));
    expect(stored.kioskId).toBe('W009');
  } finally {
    await kiosk.close();
  }
});

test('opening the shortcut while the kiosk runs shows the screen in the running app', async () => {
  const kiosk = await launchKiosk({ site: 'W004', apiBase: api.url });
  try {
    const { main } = kiosk;
    await expect(main.locator('#root > *').first()).toBeVisible({ timeout: 30_000 });
    await expect(setup(main)).toHaveCount(0);
    // What Windows does when the shortcut starts a second instance.
    await kiosk.app.evaluate(({ app }) => {
      app.emit('second-instance', {}, ['kiosk.exe', '--setup'], process.cwd());
    });
    await expect(setup(main)).toBeVisible();
    await setup(main).getByRole('button', { name: '닫기' }).click();
    await expect(setup(main)).toHaveCount(0);
  } finally {
    await kiosk.close();
  }
});
