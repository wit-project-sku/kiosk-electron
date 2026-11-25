// 롯데 home (W011~W013): the 화면정의서 (2026-11-13) home, and every destination opens.
// Set LOTTE_SHOTS_DIR to also save a screenshot of each screen for review.
import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE_DIR, startFakeApi, type FakeApi } from './support/fake-api';
import { appWindowErrors, launchKiosk } from './support/launch';

let api: FakeApi;
test.beforeAll(async () => {
  api = await startFakeApi({ mode: 'replay' });
});
test.afterAll(async () => api.close());

/**
 * Names of the recorded shops in one base (롯데 뭐먹지 / 롯데 뭐사지) for a region. The lists read
 * the server catalogue (tests/e2e/fixtures/api), so the steps pick from it instead of naming a shop.
 */
function fixtureShopNames(region: string, base: string): string[] {
  const key = `GET /api/shops/v2?region=${region}`;
  for (const f of readdirSync(FIXTURE_DIR)) {
    const fx = JSON.parse(readFileSync(join(FIXTURE_DIR, f), 'utf8')) as {
      key: string;
      body: { data: Array<{ baseCategoryKr?: string; shopNameKr: string }> };
    };
    if (fx.key === key) return fx.body.data.filter((x) => x.baseCategoryKr === base).map((x) => x.shopNameKr);
  }
  throw new Error(`no shop fixture for ${region}`);
}
const escape = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const anyOf = (names: string[]): RegExp => new RegExp(names.map(escape).join('|'));

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

test('home draws the 화면정의서 rows and each destination opens', async () => {
  const kiosk = await launchKiosk({ site: 'W011', apiBase: api.url });
  try {
    const { main } = kiosk;
    // A-01 (2026-11-13): 3 cards · 롯데시네마 · 영화 나눔 · 뭐먹지 · 뭐사지 · 3 cards · 건물 단추.
    for (const label of [
      "'롯데' 뭐하지",
      '영화 전후 코스',
      '위드마켓',
      '롯데 이벤트',
      '영화 나눔',
      "'롯데' 뭐먹지",
      "'롯데' 뭐사지",
      '여기는 롯데',
      "안녕 '로씨'", // Localization_Lotte MainButton_Greeting
      '오늘의 사연',
      '상영 시간표',
      '상영 정보 더보기',
    ]) {
      await expect(main.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    }
    // Gone from the home in this round.
    for (const label of ['(준비중)', '롯데 시설안내', '숙박안내', '제주큐랑']) {
      await expect(main.getByText(label, { exact: true })).toHaveCount(0);
    }
    // Building_Btn_*@W011 rows of the 롯데 sheet.
    for (const b of ['롯데월드', '롯데백화점', '롯데월드타워', '롯데월드몰']) {
      await expect(main.getByRole('button', { name: `${b} ›` })).toBeVisible();
    }
    // The third row is three buttons of one width.
    const third = await Promise.all(
      ['여기는 롯데', "안녕 '로씨'", '오늘의 사연'].map((l) =>
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
    const eat = fixtureShopNames('LOTTE_WORLD_MALL', '롯데 뭐먹지');
    const row = main.getByRole('button', { name: anyOf(eat) }).first();
    const rowText = (await row.textContent()) ?? '';
    const picked = eat.find((n) => rowText.includes(n))!;
    await row.click();
    await expect(main.getByRole('heading', { name: picked })).toBeVisible();
    await shot(main, 'detail');
    await home(main);

    await open("'롯데' 뭐사지", "'롯데' 뭐사지?", 'shop');
    await home(main);

    // C-01 → C-02: 영화 전후 코스.
    await open("'롯데' 뭐하지", "'롯데' 뭐하지", 'course');
    await expect(main.getByRole('button', { name: '코스 추천받기' })).toBeDisabled();
    await main.getByRole('button', { name: /^\d\d:\d\d$/ }).first().click();
    await main.getByRole('button', { name: '2명', exact: true }).click();
    await main.getByRole('button', { name: '코스 추천받기' }).click();
    await expect(main.getByText('지금 여기', { exact: true })).toBeVisible();
    await expect(main.getByText('상영관 입장', { exact: true })).toBeVisible();
    await shot(main, 'course-result');
    await main.getByRole('button', { name: '다시 고르기' }).click();
    await expect(main.getByText('보실 영화와 시간', { exact: true })).toBeVisible();
    await home(main);

    await open('영화 나눔', '영화 나눔', 'movie-share');
    await expect(main.getByText('필름 5칸이 모이면 영화 1편 나눔', { exact: true })).toBeVisible();
    await home(main);

    // C-06: GET /api/stories has no answer here, and there are no sample stories (they would
    // read as real visitors'), so the screen is 사연 없음 with the 사연 보내기 QR.
    await open('오늘의 사연', '오늘의 사연', 'stories');
    await expect(main.getByText('아직 사연이 없습니다', { exact: true })).toBeVisible();
    await expect(main.getByText('앱으로 사연 보내기', { exact: true })).toBeVisible();
    await home(main);

    // C-04 · A-07: a 건물 단추 opens 건물 안내 on that building.
    await main.getByRole('button', { name: '롯데월드타워 ›' }).click();
    await expect(main.getByRole('heading', { name: '롯데월드몰' })).toBeVisible();
    await expect(main.getByText('예시 전망대 야경 이벤트', { exact: true })).toBeVisible();
    await main.getByRole('button', { name: '롯데월드몰', exact: true }).click();
    await shot(main, 'building-events');
    await main.getByRole('button', { name: '핫스팟', exact: true }).click();
    await expect(main.getByText('롯데월드 아쿠아리움', { exact: true })).toBeVisible();
    await shot(main, 'building-hotspots');
    await home(main);

    await open('롯데 이벤트', '롯데 이벤트', 'events');
    await home(main);
    await open('여기는 롯데', '여기는 롯데', 'about');
    await home(main);

    await main.getByRole('button', { name: '화장실' }).click();
    await expect(main.getByRole('heading', { name: '화장실' })).toBeVisible();
    await home(main);

    // A-06: the tile and the strip's 더보기 both open the timetable.
    await main.getByText('롯데시네마', { exact: true }).first().click();
    await expect(main.getByRole('heading', { name: '롯데시네마' })).toBeVisible();
    await expect(main.getByText('롯데시네마 월드타워')).toBeVisible();
    await shot(main, 'cinema');
    await home(main);
    await main.getByRole('button', { name: '상영 정보 더보기' }).click();
    await expect(main.getByText('롯데시네마 월드타워')).toBeVisible();
    await home(main);

    await main.getByRole('button', { name: '스마트 헬스케어' }).click();
    await shot(main, 'fillme');
    await main.getByRole('button', { name: '홈' }).first().click();
    await main.waitForTimeout(500);

    await main.getByRole('button', { name: '사진촬영' }).click();
    await expect(main.getByRole('heading', { name: 'AR 한복체험' })).toBeVisible();
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
    await expect(main.getByText('오늘의 사연', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(main.getByText('롯데백화점 청량리점 건물 그림 자리')).toBeVisible();
    await shot(main, 'w012-home');
    // One building: no chips, and 핫스팟 opens with the 지점 소개 card.
    await main.getByRole('button', { name: '청량리점 안내 ›' } /* Building_Btn@W012 */).click();
    await expect(main.getByRole('heading', { name: '롯데백화점 청량리점' })).toBeVisible();
    await main.getByRole('button', { name: '핫스팟', exact: true }).click();
    await expect(main.getByText('쇼핑몰 10:30 ~ 22:00 · 백화점 10:30 ~ 20:00')).toBeVisible();
    await expect(main.getByText('킨더라운지', { exact: true })).toBeVisible();
    await shot(main, 'w012-hotspots');
    await home(main);
    await main.getByRole('button', { name: '화장실' }).click();
    await expect(main.getByText('층별 화장실 위치를 준비 중입니다')).toBeVisible();
    await shot(main, 'w012-restroom');
    await home(main);
    await main.getByText("'롯데' 뭐사지", { exact: true }).click();
    // 청량리's own catalogue, not 월드몰's.
    await expect(
      main.getByRole('button', { name: anyOf(fixtureShopNames('LOTTE_CHEONGNYANGNI', '롯데 뭐사지')) }).first(),
    ).toBeVisible();
    await shot(main, 'w012-shop');
  } finally {
    await kiosk.close();
  }
});
