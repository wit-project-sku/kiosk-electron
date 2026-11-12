// 지점 설정 (shared/config/kioskSetup.ts): a fresh PC chooses its site in an ordinary
// window instead of through provision-kiosk, and the desktop shortcut (--setup) opens
// the same window over a running kiosk.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { startFakeApi, type FakeApi } from './support/fake-api';
import { appWindowErrors, findWindow, launchKiosk, removeDir } from './support/launch';

let api: FakeApi;
test.beforeAll(async () => {
  api = await startFakeApi({ mode: 'replay' });
});
test.afterAll(async () => api.close());

/** Answer the system confirm box: 0 = change and restart, 1 = cancel. */
async function answerConfirm(app: ElectronApplication, response: 0 | 1): Promise<void> {
  await app.evaluate(({ dialog }, r) => {
    dialog.showMessageBox = (async () => ({ response: r, checkboxChecked: false })) as never;
  }, response);
}

const site = (setup: Page, name: RegExp) => setup.getByRole('radio').and(setup.getByLabel(name));
// '저장' over a running kiosk, '저장하고 실행' with the app off or on a fresh PC.
const save = (setup: Page) => setup.getByRole('button', { name: /^저장/ });
const hasWindow = (app: ElectronApplication, file: string): boolean =>
  app.windows().some((w) => w.url().endsWith(file));
const openWindows = (app: ElectronApplication): Promise<number> =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);

test('a fresh PC opens only the setup window and becomes the site it confirms', async () => {
  const kiosk = await launchKiosk({
    site: 'W001',
    apiBase: api.url,
    fresh: true,
    keepUserData: true,
  });
  try {
    const { main: setup, app } = kiosk;
    await expect(setup.getByText('고르기 전에는 키오스크 화면이 열리지 않습니다')).toBeVisible();
    expect(hasWindow(app, 'index.html')).toBe(false);
    // Nothing is "current" on a machine that is no kiosk yet, and nothing is chosen.
    await expect(setup.getByText('현재', { exact: true })).toHaveCount(0);
    await expect(save(setup)).toBeDisabled();
    // No number to type: the site brings its own.
    await expect(setup.getByRole('textbox')).toHaveCount(0);

    await site(setup, /오색시장/).check();
    await answerConfirm(app, 1);
    await save(setup).click();
    await expect(save(setup)).toBeEnabled();
    expect(hasWindow(app, 'index.html')).toBe(false);

    await answerConfirm(app, 0);
    await save(setup).click();

    // Unpackaged, the app stays up (a packaged build restarts) and opens as W004.
    const main = await findWindow(app, 'index.html');
    await expect(main.locator('#root > *').first()).toBeVisible();
    await expect.poll(() => hasWindow(app, 'setup.html')).toBe(false);
    const stored = JSON.parse(readFileSync(join(kiosk.userData, 'kiosk-config.json'), 'utf8'));
    expect(stored).toMatchObject({ kioskId: 'W004', jejuIdShift202610: true });
    expect(stored.previewSite).toBeUndefined();
    expect(stored.setupPending).toBeUndefined();
    expect(appWindowErrors(kiosk.errors).filter((e) => e.startsWith('[setup.html]'))).toEqual([]);
  } finally {
    await kiosk.close();
    removeDir(kiosk.userData);
  }
});

test('a fresh PC closed without choosing asks again on its next launch', async () => {
  const first = await launchKiosk({
    site: 'W001',
    apiBase: api.url,
    fresh: true,
    keepUserData: true,
  });
  await first.main.getByRole('button', { name: '나중에 하기' }).click();
  await first.close();

  const second = await launchKiosk({
    site: 'W001',
    apiBase: api.url,
    fresh: true,
    userData: first.userData,
  });
  try {
    await expect(second.main.getByText('고르기 전에는')).toBeVisible();
    expect(hasWindow(second.app, 'index.html')).toBe(false);
  } finally {
    await second.close();
  }
});

test('with the app off, the shortcut opens only the setup window and closing leaves it off', async () => {
  const kiosk = await launchKiosk({ site: 'W009', apiBase: api.url, args: ['--setup'] });
  try {
    const { main: setup, app } = kiosk;
    await expect(setup.getByText(/현재 이 PC는 제주국제여객터미널\(009번\)/)).toBeVisible();
    expect(hasWindow(app, 'index.html')).toBe(false);
    // This PC's own site is marked and cannot be picked again.
    await expect(site(setup, /제주국제여객터미널/)).toBeDisabled();

    await setup.getByRole('button', { name: '닫기' }).click();
    await expect.poll(() => openWindows(app)).toBe(0);
    const stored = JSON.parse(readFileSync(join(kiosk.userData, 'kiosk-config.json'), 'utf8'));
    expect(stored.kioskId).toBe('W009');
  } finally {
    await kiosk.close();
  }
});

test('with the app off, 앱 실행 starts the kiosk as it is, and choosing a site turns it into 저장하고 실행', async () => {
  const kiosk = await launchKiosk({ site: 'W009', apiBase: api.url, args: ['--setup'] });
  try {
    const { main: setup, app } = kiosk;
    const launch = setup.getByRole('button', { name: '앱 실행' });
    await expect(launch).toBeEnabled();
    expect(hasWindow(app, 'index.html')).toBe(false);

    // Picking another site swaps the button; it would save, not just launch.
    await site(setup, /오색시장/).check();
    await expect(launch).toHaveCount(0);
    await expect(setup.getByRole('button', { name: '저장하고 실행' })).toBeEnabled();
    await setup.reload();
    await expect(launch).toBeEnabled();

    await launch.click();
    // Unpackaged, the app stays up (a packaged build restarts) and opens as the same site.
    const main = await findWindow(app, 'index.html');
    await expect(main.locator('#root > *').first()).toBeVisible();
    await expect.poll(() => hasWindow(app, 'setup.html')).toBe(false);
    const stored = JSON.parse(readFileSync(join(kiosk.userData, 'kiosk-config.json'), 'utf8'));
    expect(stored.kioskId).toBe('W009');
    expect(appWindowErrors(kiosk.errors).filter((e) => e.startsWith('[setup.html]'))).toEqual([]);
  } finally {
    await kiosk.close();
  }
});

test('the list has column names and no per-site details', async () => {
  const kiosk = await launchKiosk({ site: 'W009', apiBase: api.url, args: ['--setup'] });
  try {
    const { main: setup } = kiosk;
    await expect(setup.getByRole('columnheader')).toHaveText(['', 'ID', '키오스크 이름', '상태']);
    const own = setup.getByRole('row', { name: /제주국제여객터미널/ });
    await expect(own.getByRole('cell')).toHaveText(['', '009', '제주국제여객터미널', '현재']);
    await expect(setup.getByText(/카드단말기|기부|영상 \d+개|미리보기/)).toHaveCount(0);
    // A whole row selects, not just its radio button.
    await setup.getByText('화성휴게소', { exact: true }).click();
    await expect(site(setup, /화성휴게소/)).toBeChecked();
  } finally {
    await kiosk.close();
  }
});

test('with the kiosk running, the shortcut opens one window and closing it leaves the kiosk up', async () => {
  const kiosk = await launchKiosk({ site: 'W004', apiBase: api.url });
  try {
    const { app, main } = kiosk;
    await expect(main.locator('#root > *').first()).toBeVisible({ timeout: 30_000 });
    expect(hasWindow(app, 'setup.html')).toBe(false);

    // What Windows does when the shortcut starts a second instance, twice.
    const secondInstance = (): Promise<void> =>
      app.evaluate(({ app: electronApp }) => {
        electronApp.emit('second-instance', {}, ['kiosk.exe', '--setup'], process.cwd());
      });
    await secondInstance();
    let setup = await findWindow(app, 'setup.html');
    await secondInstance();
    expect(app.windows().filter((w) => w.url().endsWith('setup.html'))).toHaveLength(1);

    await setup.getByRole('button', { name: '닫기' }).click();
    await expect.poll(() => hasWindow(app, 'setup.html')).toBe(false);
    await expect(main.locator('#root > *').first()).toBeVisible();

    await secondInstance();
    setup = await findWindow(app, 'setup.html');
    await site(setup, /사무실 테스트기/).check();
    await answerConfirm(app, 0);
    await save(setup).click();
    await expect.poll(() => hasWindow(app, 'setup.html')).toBe(false);
    const stored = JSON.parse(readFileSync(join(kiosk.userData, 'kiosk-config.json'), 'utf8'));
    expect(stored.kioskId).toBe('W200');
  } finally {
    await kiosk.close();
  }
});
