import { describe, expect, it } from 'vitest';
import type { Shop } from '../../../src/shared/types/shop';
import {
  ENTER_BEFORE_MIN,
  planCourse,
  shopHours,
  toMin,
} from '../../../src/layouts/lotte/lotteCoursePlan';

/** Minimal Shop rows — only the fields the planner reads. */
const shop = (
  id: number,
  name: string,
  base: string,
  second: string,
  floor: string,
  openTime = '',
): Shop =>
  ({
    id,
    shopNameKr: name,
    baseCategoryKr: base,
    secondCategoryKr: second,
    addressKr: `서울 롯데월드몰 ${floor}`,
    openTime,
  }) as unknown as Shop;

const SHOPS: Shop[] = [
  shop(1, '예시 카페', '롯데 뭐먹지', '7-카페·베이커리', 'B1', 'Open> 10:30~22:00'),
  shop(2, '예시 매장', '롯데 뭐사지', '2-컨템포러리', '2F', 'Open> Mon~Sun 10:30-20:00'),
  shop(3, '예시 식당', '롯데 뭐먹지', '1-한식', '6F', 'Open> 10:30~23:00'),
  shop(4, '늦게 여는 바', '롯데 뭐먹지', '1-한식', '6F', 'Open> 18:00~02:00'),
];

const MOVIE = { title: '예시 영화 B', runtimeMin: 122 };
const at = (hm: string): Date => {
  const d = new Date(2026, 10, 18);
  d.setHours(Number(hm.slice(0, 2)), Number(hm.slice(3)));
  return d;
};

describe('shopHours', () => {
  it('reads both hour formats in the collected data', () => {
    expect(shopHours({ openTime: 'Open> 10:30~22:00' }, 'W011')).toEqual({ open: 630, close: 1320 });
    expect(shopHours({ openTime: 'Open> Mon~Sun 10:30-20:00' }, 'W012')).toEqual({ open: 630, close: 1200 });
    expect(shopHours({ openTime: 'Open> 10:30~20:00 (금,토,일 30분 연장영업)' }, 'W011').close).toBe(1200);
  });

  it("falls back to the site's own hours when a shop has none", () => {
    expect(shopHours({ openTime: '' }, 'W011')).toEqual({ open: 630, close: 1320 });
    expect(shopHours({ openTime: null }, 'W013')).toEqual({ open: 630, close: 1200 });
  });
});

describe('planCourse', () => {
  const session = { start: '19:15', end: '21:17', screen: '2관', format: '2D', seatsLeft: 10, seatsTotal: 220 };

  it('fits the before-stops between now and 상영관 입장, then the film, then dinner', () => {
    const c = planCourse({ shops: SHOPS, kioskId: 'W011', movie: MOVIE, session, when: 'both', party: 1, now: at('17:40') });
    const kinds = c.stops.map((s) => s.kind);
    expect(kinds[0]).toBe('here');
    expect(kinds).toContain('enter');
    expect(kinds.indexOf('movie')).toBe(kinds.indexOf('enter') + 1);
    const enter = c.stops.find((s) => s.kind === 'enter')!;
    expect(enter.at).toBe(toMin('19:15') - ENTER_BEFORE_MIN);
    // every before-stop ends before the walk to the cinema
    for (const s of c.stops.slice(1, kinds.indexOf('enter'))) expect(s.at).toBeLessThan(enter.at);
    expect(c.stops.at(-1)!.open).toMatch(/^상영 후에도 영업/);
  });

  it('only suggests places that are open when the visitor arrives', () => {
    const c = planCourse({ shops: SHOPS, kioskId: 'W011', movie: MOVIE, session, when: 'both', party: 1, now: at('17:40') });
    for (const s of c.stops.filter((x) => x.kind === 'place')) {
      const h = shopHours(s.shop!, 'W011');
      expect(s.at).toBeGreaterThanOrEqual(h.open);
    }
  });

  it('leaves the after half empty when nothing is open after a late film', () => {
    const late = { ...session, start: '22:30', end: '00:32' };
    const c = planCourse({ shops: SHOPS.slice(0, 3), kioskId: 'W011', movie: MOVIE, session: late, when: 'after', party: 1, now: at('22:00') });
    expect(c.emptyAfter).toBe(true);
    expect(c.stops.some((s) => s.kind === 'place')).toBe(false);
  });

  it('gives a 3~4명 party longer at the table', () => {
    const solo = planCourse({ shops: SHOPS, kioskId: 'W011', movie: MOVIE, session, when: 'after', party: 0, now: at('17:40') });
    const group = planCourse({ shops: SHOPS, kioskId: 'W011', movie: MOVIE, session, when: 'after', party: 2, now: at('17:40') });
    expect(group.afterMinutes).toBeGreaterThan(solo.afterMinutes);
  });
});
