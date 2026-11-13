import { describe, expect, it } from 'vitest';
import type { Shop } from '@shared/types/shop';
import { interestsFor, planVisit, STAY_OPTIONS } from '../../../src/layouts/lotte/lotteVisitPlan';
import { LOTTE_EAT, LOTTE_SHOP } from '../../../src/layouts/lotte/lotteSample';

const shop = (id: number, name: string, base: string, second: string, floor: string): Shop =>
  ({
    id,
    shopNameKr: name,
    baseCategoryKr: base,
    secondCategoryKr: second,
    addressKr: `서울 어딘가 ${floor}`,
  }) as unknown as Shop;

const CATALOGUE: Shop[] = [
  shop(1, '가', LOTTE_EAT, '1-한식', '9F'),
  shop(2, '나', LOTTE_EAT, '1-한식', 'B1F'),
  shop(3, '다', LOTTE_SHOP, '6-뷰티', '1F'),
  shop(4, '라', LOTTE_SHOP, '6-뷰티', '8F'),
  shop(5, '마', LOTTE_SHOP, '6-화장품', 'B1F'),
  shop(6, '바', LOTTE_EAT, '1-식당가', '5F'),
  shop(7, '면세 사', LOTTE_SHOP, '6-뷰티', '1F'),
];
const dutyFree = CATALOGUE[6]!;
(dutyFree as unknown as { shopNameKr: string }).shopNameKr = '면세점 사';

describe('planVisit', () => {
  it('머무는 시간 decides how many places', () => {
    STAY_OPTIONS.forEach((o, i) => {
      const stops = planVisit(CATALOGUE, ['food', 'beauty'], i, 0);
      expect(stops.length).toBe(Math.min(o.places, 6));
    });
  });

  it('takes the picks in turn and moves to the nearest floor', () => {
    const stops = planVisit(CATALOGUE, ['food', 'beauty'], 0, 0);
    expect(stops.map((s) => s.shop.shopNameKr)).toEqual(['가', '라']); // 9F first, then 8F beauty
    expect(stops[0]!.walkMinutes).toBe(3);
    expect(stops[1]!.walkMinutes).toBeNull();
  });

  it('never repeats a shop or recommends duty-free, and stops when a venue runs out', () => {
    const stops = planVisit(CATALOGUE, ['beauty'], 3, 0);
    const names = stops.map((s) => s.shop.shopNameKr);
    expect(new Set(names).size).toBe(names.length);
    expect(names).not.toContain('면세점 사');
    expect(names.length).toBe(3);
  });

  it('a bigger party gets longer at the table only', () => {
    const [meal, other] = planVisit(CATALOGUE, ['food', 'beauty'], 0, 2);
    expect(meal!.minutes).toBe(50);
    expect(other!.minutes).toBe(20);
  });

  it('draws no plan without a pick', () => {
    expect(planVisit(CATALOGUE, [], 1, 0)).toEqual([]);
  });
});

describe('interestsFor', () => {
  it('offers only what this venue has', () => {
    expect(interestsFor(CATALOGUE).map((i) => i.id)).toEqual(['food', 'beauty']);
  });
});
