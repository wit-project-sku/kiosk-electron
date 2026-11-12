// 롯데 home (W011~W013): the button rows asked for on 2026-11-09, and every destination opens.
// Set LOTTE_SHOTS_DIR to also save a screenshot of each screen for review.
import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { startFakeApi, type FakeApi } from './support/fake-api';
import { appWindowErrors, launchKiosk } from './support/launch';

let api: FakeApi;
test.beforeAll(async () => {
  api = await startFakeApi({ mode: 'replay' });
});
test.afterAll(async () => api.close());

async function shot(main: Page, name: string): Promise<void> {
  const dir = process.env['LOTTE_SHOTS_DIR'];
  if (!dir) return;
  await main.waitForTimeout(500);
  await main.screenshot({ path: join(dir, `${name}.png`) });
}

const home = async (main: Page): Promise<void> => {
  await main.getByRole('button', { name: '홈' }).first().click();
  await expect(main.getByText("'롯데' 뭐하지", { exact: true })).toBeVisible();
};

test('home draws the requested rows and each destination opens', async () => {
  const kiosk = await launchKiosk({ site: 'W011', apiBase: api.url });
  try {
    const { main } = kiosk;
    for (const label of [
      "'롯데' 뭐하지",
      '위드마켓',
      '롯데 이벤트',
      "'롯데' 뭐먹지",
      "'롯데' 뭐사지",
      '(준비중)',
      '여기는 롯데',
      '안녕 롯데',
      '롯데 시설안내',
    ]) {
      await expect(main.getByText(label, { exact: true })).toBeVisible({ timeout: 30_000 });
    }
    // 숙박안내·제주큐랑 are not on this home.
    await expect(main.getByText('숙박안내')).toHaveCount(0);
    await expect(main.getByText('제주큐랑')).toHaveCount(0);
    await expect(main.getByText('롯데시네마', { exact: true }).first()).toBeVisible();

    // The third row is three buttons of one width.
    const third = await Promise.all(
      ['여기는 롯데', '안녕 롯데', '롯데 시설안내'].map((l) =>
        main.locator('button', { hasText: l }).first().boundingBox(),
      ),
    );
    expect(new Set(third.map((b) => Math.round(b!.width))).size).toBe(1);
    await shot(main, 'home');

    const open = async (label: string, title: string, name: string): Promise<void> => {
      await main.getByText(label, { exact: true }).first().click();
      await expect(main.getByRole('heading', { name: title })).toBeVisible();
      await shot(main, name);
    };

    await open("'롯데' 뭐먹지", "'롯데' 뭐먹지?", 'eat');
    await main.getByRole('button', { name: '한식', exact: true }).click();
    await shot(main, 'eat-filter');
    await main.getByRole('button', { name: /편백집/ }).click();
    await expect(main.getByRole('heading', { name: /편백집/ })).toBeVisible();
    await shot(main, 'detail');
    await home(main);

    await open("'롯데' 뭐사지", "'롯데' 뭐사지?", 'shop');
    await main.getByRole('button', { name: '뷰티', exact: true }).click();
    await shot(main, 'shop-beauty');
    await home(main);

    await open("'롯데' 뭐하지", "'롯데' 뭐하지", 'whattodo');
    await expect(main.getByRole('button', { name: '장소 추천받기' })).toBeDisabled();
    await main.getByRole('button', { name: '3 ~ 4명' }).click();
    await main.getByRole('button', { name: '2 ~ 3시간' }).click();
    await main.getByRole('button', { name: '맛집' }).click();
    await main.getByRole('button', { name: '뷰티' }).click();
    await main.getByRole('button', { name: '장소 추천받기' }).click();
    await expect(main.getByText('4곳', { exact: true })).toBeVisible();
    await shot(main, 'whattodo-result');
    await home(main);

    await open('롯데 이벤트', '롯데 이벤트', 'events');
    await home(main);
    await open('여기는 롯데', '여기는 롯데', 'about');
    await main.getByRole('button', { name: '주변 명소' }).click();
    await expect(main.getByText('콘텐츠 준비 중입니다')).toBeVisible();
    await shot(main, 'about-empty');
    await home(main);
    await open('안녕 롯데', '안녕 롯데', 'hello');
    await main.getByRole('button', { name: '취미생활' }).click();
    await shot(main, 'hello-hobby');
    await home(main);
    await open('롯데 시설안내', '롯데 시설안내', 'guide');
    await main.getByRole('button', { name: '고객서비스', exact: true }).click();
    await shot(main, 'guide-facilities');
    await home(main);

    await main.getByRole('button', { name: '화장실' }).click();
    await expect(main.getByRole('heading', { name: '화장실' })).toBeVisible();
    await shot(main, 'restroom');
    await home(main);

    await main.getByText('롯데시네마', { exact: true }).first().click();
    await expect(main.getByRole('heading', { name: '롯데시네마 상영 시간표' })).toBeVisible();
    await expect(main.getByText('롯데시네마 월드타워')).toBeVisible();
    await shot(main, 'cinema');
    await home(main);

    await main.getByRole('button', { name: '스마트 헬스케어' }).click();
    await shot(main, 'fillme');
    await main.getByRole('button', { name: '시작하기' }).click();
    await shot(main, 'fillme-2');
    await main.getByRole('button', { name: '홈' }).first().click();
    await main.waitForTimeout(500);

    await main.getByRole('button', { name: '사진촬영' }).click();
    await expect(main.getByRole('heading', { name: 'AR 한복체험' })).toBeVisible();
    await expect(main.getByText(/with '/)).toHaveCount(0);
    await shot(main, 'photo');
    await home(main);

    await main.getByRole('button', { name: '언어선택' }).click();
    await main.getByText('English', { exact: true }).click();
    await main.getByRole('button', { name: '홈' }).first().click();
    await expect(main.getByText('LOTTE To Do', { exact: true })).toBeVisible();
    await shot(main, 'home-en');

    // The FillMe nail camera is hardware this machine does not have; that error is the expected one.
    expect(appWindowErrors(kiosk.errors).filter((e) => !e.includes('hand-camera-missing'))).toEqual(
      [],
    );
  } finally {
    await kiosk.close();
  }
});

test('a department store lists its own shops and has no restroom data to guess from', async () => {
  const kiosk = await launchKiosk({ site: 'W012', apiBase: api.url });
  try {
    const { main } = kiosk;
    await expect(main.getByText('롯데 시설안내', { exact: true })).toBeVisible({ timeout: 30_000 });
    await shot(main, 'w012-home');
    await main.getByRole('button', { name: '화장실' }).click();
    await expect(main.getByText('층별 화장실 위치를 준비 중입니다')).toBeVisible();
    await shot(main, 'w012-restroom');
    await home(main);
    await main.getByText("'롯데' 뭐사지", { exact: true }).click();
    await expect(main.getByRole('button', { name: /메이시스/ }).first()).toBeVisible();
    await shot(main, 'w012-shop');
  } finally {
    await kiosk.close();
  }
});
