// What a visitor does most: open the "뭐먹지" (restaurants) tile, pick a shop from the list,
// read its detail, go home. Runs on the three layouts with a shop list and a detail page.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { getKioskRegion } from '@shared/config/kioskLocations';
import { FIXTURE_DIR, startFakeApi, type FakeApi } from './support/fake-api';
import { launchKiosk, type Site } from './support/launch';

interface FixtureShop {
  shopNameKr: string;
  baseCategoryKr: string | null;
}

/** Shops the fake backend will hand this site (from the recorded fixture). */
function fixtureShops(site: Site): FixtureShop[] {
  const key = `GET /api/shops/v2?region=${getKioskRegion(site)}`;
  for (const f of readdirSync(FIXTURE_DIR)) {
    const fx = JSON.parse(readFileSync(join(FIXTURE_DIR, f), 'utf8')) as {
      key: string;
      body: { data: FixtureShop[] };
    };
    if (fx.key === key) return fx.body.data;
  }
  throw new Error(`no shop fixture for ${site}`);
}

const visible = (page: Page, text: string | RegExp) =>
  page
    .getByText(text, { exact: typeof text === 'string' })
    .locator('visible=true')
    .first();

const CASES: { site: Site; tile: RegExp }[] = [
  { site: 'W001', tile: /뭐먹지/ },
  { site: 'W004', tile: /뭐먹지/ },
  { site: 'W006', tile: /뭐먹지/ },
];

let api: FakeApi;
test.beforeAll(async () => {
  api = await startFakeApi();
});
test.afterAll(async () => api.close());

for (const { site, tile } of CASES) {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the fixture object pattern
  test(`${site} restaurants: list → detail → home`, async ({}, testInfo) => {
    const shops = fixtureShops(site).filter((s) => s.baseCategoryKr?.includes('먹지'));
    expect(shops.length, 'fixture has restaurants').toBeGreaterThan(0);
    const kiosk = await launchKiosk({ site, apiBase: api.url });
    try {
      const { main } = kiosk;
      const tileButton = main.getByRole('button', { name: tile }).locator('visible=true');
      await tileButton.first().click();
      // We left home: the tile grid is gone (guards against matching names on a home board).
      await expect(tileButton).toHaveCount(0);

      // The list shows at least one recorded restaurant.
      const names = shops.map((s) => s.shopNameKr);
      const listed = main
        .getByText(new RegExp(`^(${names.map(escape).join('|')})$`))
        .locator('visible=true');
      await expect(listed.first()).toBeVisible();
      const picked = (await listed.first().innerText()).trim();
      await main.screenshot({ path: testInfo.outputPath(`${site}-1-list.png`) });

      await listed.first().click();
      // Detail: the shop name stays on screen and the list's other rows are gone.
      await expect(visible(main, picked)).toBeVisible();
      const others = names.filter((n) => n !== picked).slice(0, 3);
      for (const n of others) await expect(visible(main, n)).toHaveCount(0);
      await main.screenshot({ path: testInfo.outputPath(`${site}-2-detail.png`) });

      await main
        .getByRole('button', { name: /^(홈|홈으로)$/ })
        .locator('visible=true')
        .first()
        .click();
      await expect(
        main.getByRole('button', { name: tile }).locator('visible=true').first(),
      ).toBeVisible();

      expect(kiosk.errors.filter((e) => e.includes('pageerror'))).toEqual([]);
    } finally {
      await kiosk.close();
    }
  });
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
