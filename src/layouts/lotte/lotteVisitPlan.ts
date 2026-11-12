/**
 * 롯데 뭐하지 — who is coming, how long they stay and what they like become a short list of places.
 * One building has no route to plan, so this keeps the walk short instead: each next stop is the
 * unused shop on the nearest floor. 머무는 시간 decides how many places (2~5).
 */
import type { Shop } from '@shared/types/shop';
import {
  LOTTE_EAT,
  LOTTE_FACILITY,
  LOTTE_SHOP,
  floorRank,
  isDutyFree,
  shopFloor,
  compareShops,
} from './lotteSample';

export const PARTY_OPTIONS = ['혼자', '2명', '3 ~ 4명', '5명 이상'] as const;
/** A mall visit runs from a quick errand to half a day; more time, more places. */
export const STAY_OPTIONS = [
  { label: '1시간 이내', places: 2 },
  { label: '1 ~ 2시간', places: 3 },
  { label: '2 ~ 3시간', places: 4 },
  { label: '3시간 이상', places: 5 },
] as const;
const LARGE_PARTY_FROM = 2; // index in PARTY_OPTIONS: 3 ~ 4명 and up take longer at a table
export const MAX_PICKS = 3;

export interface VisitInterest {
  id: string;
  label: string;
  minutes: number;
  meal?: boolean;
  matches: (shop: Shop) => boolean;
}

const inCategory =
  (base: string, second: RegExp) =>
  (s: Shop): boolean =>
    s.baseCategoryKr === base && second.test(s.secondCategoryKr ?? '');

export const VISIT_INTERESTS: readonly VisitInterest[] = [
  {
    id: 'food',
    label: '맛집',
    minutes: 40,
    meal: true,
    matches: inCategory(LOTTE_EAT, /한식|양식|일식|중식|아시안|캐주얼|식당가/),
  },
  {
    id: 'cafe',
    label: '카페·디저트',
    minutes: 30,
    meal: true,
    matches: inCategory(LOTTE_EAT, /카페|디저트|베이커리/),
  },
  { id: 'grocery', label: '장보기', minutes: 20, matches: inCategory(LOTTE_EAT, /식품|델리/) },
  {
    id: 'women',
    label: '여성패션',
    minutes: 20,
    matches: inCategory(LOTTE_SHOP, /여성|컨템|영패션|럭셔리|해외패션/),
  },
  { id: 'men', label: '남성패션', minutes: 20, matches: inCategory(LOTTE_SHOP, /남성/) },
  { id: 'goods', label: '패션잡화', minutes: 20, matches: inCategory(LOTTE_SHOP, /패션잡화/) },
  { id: 'beauty', label: '뷰티', minutes: 20, matches: inCategory(LOTTE_SHOP, /뷰티|화장품/) },
  { id: 'sports', label: '스포츠', minutes: 20, matches: inCategory(LOTTE_SHOP, /스포츠|레저/) },
  { id: 'kids', label: '키즈', minutes: 20, matches: inCategory(LOTTE_SHOP, /키즈|아동/) },
  { id: 'living', label: '리빙', minutes: 20, matches: inCategory(LOTTE_SHOP, /라이프|리빙/) },
  { id: 'movie', label: '영화', minutes: 120, matches: (s) => /시네마|영화/.test(s.shopNameKr) },
  {
    id: 'culture',
    label: '문화',
    minutes: 40,
    matches: (s) =>
      s.baseCategoryKr === LOTTE_FACILITY &&
      /아쿠아리움|아레나|갤러리|문화센터|뮤지엄|콘서트/.test(s.shopNameKr),
  },
];

/** Only what this venue can actually recommend gets a button. */
export const interestsFor = (shops: readonly Shop[]): VisitInterest[] =>
  VISIT_INTERESTS.filter((i) => shops.some(i.matches));

export interface VisitStop {
  shop: Shop;
  interest: VisitInterest;
  minutes: number;
  /** Walk to the next stop; null on the last one. */
  walkMinutes: number | null;
}

const distance = (a: Shop, b: Shop): number =>
  Math.abs(floorRank(shopFloor(a)) - floorRank(shopFloor(b)));
const walk = (a: Shop, b: Shop): number => Math.min(2 + distance(a, b), 8);

export function planVisit(
  shops: readonly Shop[],
  pickIds: readonly string[],
  stayIndex: number,
  partyIndex: number,
): VisitStop[] {
  const places = STAY_OPTIONS[stayIndex]?.places ?? 0;
  const picks = pickIds
    .map((id) => VISIT_INTERESTS.find((i) => i.id === id))
    .filter((i): i is VisitInterest => !!i);
  if (picks.length === 0 || places === 0) return [];
  const pools = new Map(
    picks.map((i) => [
      i.id,
      shops.filter((s) => i.matches(s) && !isDutyFree(s)).sort(compareShops),
    ]),
  );
  const used = new Set<Shop['id']>();
  const chosen: { shop: Shop; interest: VisitInterest }[] = [];
  let misses = 0;
  for (let turn = 0; chosen.length < places && misses < picks.length; turn++) {
    const interest = picks[turn % picks.length]!;
    const free = pools.get(interest.id)!.filter((s) => !used.has(s.id));
    if (free.length === 0) {
      misses++;
      continue;
    }
    misses = 0;
    const last = chosen.at(-1)?.shop;
    const shop = last
      ? free.reduce((best, s) => (distance(s, last) < distance(best, last) ? s : best))
      : free[0]!;
    used.add(shop.id);
    chosen.push({ shop, interest });
  }
  return chosen.map(({ shop, interest }, i) => {
    const next = chosen[i + 1]?.shop;
    return {
      shop,
      interest,
      minutes: interest.minutes + (interest.meal && partyIndex >= LARGE_PARTY_FROM ? 10 : 0),
      walkMinutes: next ? walk(shop, next) : null,
    };
  });
}
