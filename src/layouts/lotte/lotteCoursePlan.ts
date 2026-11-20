/**
 * 영화 전후 코스 (C-01 → C-02) — places to visit before and/or after one 롯데시네마 session.
 *
 * Rules (화면정의서 규칙 카드 7, 2026-11-13):
 *  - 상영 전: from now until 10 minutes before the start (상영관 입장), only places open then.
 *  - 상영 후: from the end of the film; a place must be open on arrival and stay open until the
 *    visit ends.
 *  - A shop with no hours of its own takes its site's default hours.
 *  - Nothing open (a late session, say) → no stops; the screen says so.
 *
 * Distance is floors apart (one building, no walking route): 2 min + 1 per floor, at most 8.
 */
import type { Shop } from '@shared/types/shop';
import type { KioskId } from '@shared/types/kiosk';
import type { CinemaMovie, CinemaSession } from './lotteSample';
import {
  LOTTE_EAT,
  LOTTE_SHOP,
  compareShops,
  floorRank,
  isDutyFree,
  shopFloor,
} from './lotteSample';

export const WHEN_OPTIONS = [
  { id: 'before', label: '영화 보기 전' },
  { id: 'after', label: '영화 본 후' },
  { id: 'both', label: '둘 다' },
] as const;
export type CourseWhen = (typeof WHEN_OPTIONS)[number]['id'];

export const PARTY_OPTIONS = ['혼자', '2명', '3~4명', '5명 이상'] as const;
const LARGE_PARTY_FROM = 2; // 3~4명 and up linger longer at a table

/** Arrive this long before the start (상영관 입장). */
export const ENTER_BEFORE_MIN = 10;

interface Kind {
  id: 'cafe' | 'shop' | 'meal';
  minutes: number;
  matches: (s: Shop) => boolean;
}
const cat = (s: Shop): string => s.secondCategoryKr ?? '';
const KINDS: Record<Kind['id'], Kind> = {
  cafe: {
    id: 'cafe',
    minutes: 40,
    matches: (s) => s.baseCategoryKr === LOTTE_EAT && /카페|디저트|베이커리/.test(cat(s)),
  },
  shop: {
    id: 'shop',
    minutes: 25,
    matches: (s) =>
      s.baseCategoryKr === LOTTE_SHOP &&
      /여성|영패션|컨템|남성|패션잡화|뷰티|화장품|스포츠|레저|라이프|리빙|키즈|아동/.test(cat(s)),
  },
  meal: {
    id: 'meal',
    minutes: 50,
    matches: (s) =>
      s.baseCategoryKr === LOTTE_EAT && /한식|양식|일식|중식|아시안|캐주얼|식당가/.test(cat(s)),
  },
};
/** Before the film: a coffee, then browsing. After: a meal, then dessert. */
const BEFORE_ORDER: readonly Kind['id'][] = ['cafe', 'shop', 'shop', 'shop'];
const AFTER_ORDER: readonly Kind['id'][] = ['meal', 'cafe'];

/** Site default hours — for a shop without its own (규칙 카드 7). Minutes from midnight. */
const SITE_HOURS: Record<string, { open: number; close: number }> = {
  W011: { open: 630, close: 1320 },
  W012: { open: 630, close: 1200 },
  W013: { open: 630, close: 1200 },
};
/** Where the kiosk stands and where the cinema is. W013's cinema floor is not in the data yet. */
const SITE_FLOORS: Record<string, { kiosk: string; cinema: string | null }> = {
  W011: { kiosk: '1F', cinema: '5F' },
  W012: { kiosk: '1F', cinema: '7F' },
  W013: { kiosk: '1F', cinema: null },
};

export const toMin = (hm: string): number => {
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
export const toHm = (min: number): string =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** '10:30~22:00', 'Mon~Sun 10:30-20:00', '10:30~20:00 (금,토,일 …)' → minutes; else the site's. */
export function shopHours(shop: Pick<Shop, 'openTime'>, kioskId: KioskId): { open: number; close: number } {
  const m = /(\d{1,2}:\d{2})\s*[~-]\s*(\d{1,2}:\d{2})/.exec(shop.openTime ?? '');
  if (m) return { open: toMin(m[1]!), close: toMin(m[2]!) };
  return SITE_HOURS[kioskId] ?? SITE_HOURS.W011!;
}

export const siteFloors = (kioskId: KioskId): { kiosk: string; cinema: string | null } =>
  SITE_FLOORS[kioskId] ?? SITE_FLOORS.W011!;

const walkBetween = (a: string, b: string): number =>
  Math.min(2 + Math.abs(floorRank(a) - floorRank(b)), 8);

export interface CourseStop {
  kind: 'here' | 'place' | 'enter' | 'movie';
  /** Arrival time, minutes from midnight. */
  at: number;
  floor: string | null;
  name: string;
  /** '카페·디저트 · 40분' / '2관 · 상영 10분 전 도착' / '19:15 ~ 21:17 · 122분' */
  detail: string;
  /** Green line on a place: '영업 중 · 22:00 까지'. */
  open?: string;
  /** Walk from the previous row. */
  walk?: number;
  shop?: Shop;
}

export interface Course {
  stops: CourseStop[];
  beforeMinutes: number;
  afterMinutes: number;
  /** True when a requested half found no open place. */
  emptyBefore: boolean;
  emptyAfter: boolean;
}

const label = (s: Shop): string => cat(s).replace(/^\d+-/, '');

export function planCourse(args: {
  shops: readonly Shop[];
  kioskId: KioskId;
  movie: Pick<CinemaMovie, 'title' | 'runtimeMin'>;
  session: CinemaSession;
  when: CourseWhen;
  party: number;
  now: Date;
}): Course {
  const { shops, kioskId, movie, session, when, party, now } = args;
  const floors = siteFloors(kioskId);
  const start = toMin(session.start);
  const end = start + movie.runtimeMin;
  const enterAt = start - ENTER_BEFORE_MIN;
  const nowMin = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5;
  const cinemaFloor = floors.cinema ?? floors.kiosk;
  const used = new Set<Shop['id']>();
  const pool = (k: Kind): Shop[] =>
    shops.filter((s) => k.matches(s) && !isDutyFree(s) && !used.has(s.id)).sort(compareShops);
  const stay = (k: Kind): number =>
    k.minutes + (k.id === 'meal' && party >= LARGE_PARTY_FROM ? 10 : 0);

  /** The nearest open shop of this kind that fits [arrive, arrive + stay] and still leaves time. */
  const pick = (
    k: Kind,
    from: string,
    leaveBy: (s: Shop, arrive: number, minutes: number) => boolean,
    t: number,
  ): { shop: Shop; arrive: number; minutes: number; walk: number } | null => {
    let best: { shop: Shop; arrive: number; minutes: number; walk: number } | null = null;
    for (const s of pool(k)) {
      const walk = walkBetween(from, shopFloor(s));
      const arrive = t + walk;
      const minutes = stay(k);
      const h = shopHours(s, kioskId);
      if (arrive < h.open || arrive + minutes > h.close) continue;
      if (!leaveBy(s, arrive, minutes)) continue;
      if (!best || walk < best.walk) best = { shop: s, arrive, minutes, walk };
    }
    return best;
  };

  const place = (
    p: { shop: Shop; arrive: number; minutes: number; walk: number },
    k: Kind,
    after: boolean,
  ): CourseStop => {
    const close = toHm(shopHours(p.shop, kioskId).close);
    const meal = k.id === 'meal' ? `${p.arrive >= 17 * 60 ? '저녁' : '식사'} ` : '';
    return {
      kind: 'place',
      at: p.arrive,
      floor: shopFloor(p.shop),
      name: p.shop.shopNameKr,
      detail: `${label(p.shop)} · ${meal}${p.minutes}분`,
      open: after ? `상영 후에도 영업 · ${close} 까지` : `영업 중 · ${close} 까지`,
      walk: p.walk,
      shop: p.shop,
    };
  };

  const stops: CourseStop[] = [
    { kind: 'here', at: nowMin, floor: floors.kiosk, name: '지금 여기', detail: `키오스크 · ${floors.kiosk}` },
  ];

  let emptyBefore = false;
  let t = nowMin;
  let at = floors.kiosk;
  if (when !== 'after') {
    for (const id of BEFORE_ORDER) {
      const k = KINDS[id];
      const p = pick(
        k,
        at,
        (s, arrive, minutes) => arrive + minutes + walkBetween(shopFloor(s), cinemaFloor) <= enterAt,
        t,
      );
      if (!p) break;
      used.add(p.shop.id);
      stops.push(place(p, k, false));
      t = p.arrive + p.minutes;
      at = shopFloor(p.shop);
    }
    emptyBefore = stops.length === 1;
  }
  stops.push({
    kind: 'enter',
    at: enterAt,
    floor: floors.cinema,
    name: '상영관 입장',
    detail: `${session.screen} · 상영 ${ENTER_BEFORE_MIN}분 전 도착`,
    walk: walkBetween(at, cinemaFloor),
  });
  stops.push({
    kind: 'movie',
    at: start,
    floor: null,
    name: movie.title,
    detail: `${session.start} ~ ${toHm(end)} · ${movie.runtimeMin}분`,
  });

  let emptyAfter = false;
  let afterMinutes = 0;
  if (when !== 'before') {
    let t2 = end;
    let at2 = cinemaFloor;
    const before = stops.length;
    for (const id of AFTER_ORDER) {
      const k = KINDS[id];
      const p = pick(k, at2, () => true, t2);
      if (!p) break;
      used.add(p.shop.id);
      stops.push(place(p, k, true));
      t2 = p.arrive + p.minutes;
      at2 = shopFloor(p.shop);
    }
    afterMinutes = t2 - end;
    emptyAfter = stops.length === before;
  }

  return {
    stops,
    beforeMinutes: when === 'after' ? 0 : Math.max(0, enterAt - nowMin),
    afterMinutes,
    emptyBefore,
    emptyAfter,
  };
}

/** '1시간 20분' / '50분' */
export const spanLabel = (min: number): string =>
  min >= 60 ? `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ''}` : `${min}분`;
