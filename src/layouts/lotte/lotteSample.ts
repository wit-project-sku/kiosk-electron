/**
 * PUBLISHING STAGE ONLY (2026-11-09): content for the 롯데 screens, so the layouts can be reviewed
 * before the server, events and 롯데시네마 feed exist. Stores come from the collected list
 * (docs/lotte-shop-data); everything named 예시 is made up. Replace each export with its real source.
 */
import type { Shop } from '@shared/types/shop';
import type { KioskId } from '@shared/types/kiosk';
import { LOTTE_SHOP_ROWS } from './lotteShops.generated';

export const LOTTE_EAT = '롯데 뭐먹지';
export const LOTTE_SHOP = '롯데 뭐사지';
export const LOTTE_FACILITY = '롯데 시설안내';
const SITE_FALLBACK = 'W011';

/** Collected store list as Shop rows; descriptions and translations come later. */
export function lotteShopsFor(kioskId: KioskId): Shop[] {
  const rows =
    LOTTE_SHOP_ROWS[kioskId as keyof typeof LOTTE_SHOP_ROWS] ?? LOTTE_SHOP_ROWS[SITE_FALLBACK];
  return rows.map(
    ([id, name, base, second, address, tel, open]) =>
      ({
        id,
        no: String(id),
        kioskId: 11,
        shopNameKr: name,
        baseCategoryKr: base,
        secondCategoryKr: second,
        aiCategoryKr: null,
        addressKr: address,
        hashTagKr: '',
        descriptionKr: '',
        shopNameEn: name,
        baseCategoryEn: base,
        secondCategoryEn: second,
        addressEn: address,
        hashTagEn: '',
        descriptionEn: '',
        shopNameJp: name,
        baseCategoryJp: base,
        secondCategoryJp: second,
        addressJp: address,
        hashTagJp: '',
        descriptionJp: '',
        shopNameCh: name,
        baseCategoryCh: base,
        secondCategoryCh: second,
        addressCh: address,
        hashTagCh: '',
        descriptionCh: '',
        openTime: open.replace(/^Open>\s*/, ''),
        tel,
        images: [],
      }) as unknown as Shop,
  );
}

/** The sheet keeps the floor as the address's last word. */
export const shopFloor = (shop: Pick<Shop, 'addressKr'>): string =>
  shop.addressKr.split(' ').at(-1) ?? '';
export const floorRank = (floor: string): number => {
  const basement = /^B(\d+)F$/.exec(floor);
  if (basement) return -Number(basement[1]);
  const upper = /^(\d+)F$/.exec(floor);
  return upper ? Number(upper[1]) : 999;
};

/**
 * List order: duty-free counts last (they need a passport and a flight, and 99 of them on one floor
 * would bury the mall), then top floor down, then name.
 */
export const isDutyFree = (shop: Pick<Shop, 'shopNameKr'>): boolean =>
  shop.shopNameKr.includes('면세점');
export const compareShops = (a: Shop, b: Shop): number =>
  Number(isDutyFree(a)) - Number(isDutyFree(b)) ||
  floorRank(shopFloor(b)) - floorRank(shopFloor(a)) ||
  a.shopNameKr.localeCompare(b.shopNameKr, 'ko');

export interface CinemaSession {
  start: string;
  end: string;
  screen: string;
  format: string;
  seatsLeft: number;
  seatsTotal: number;
}
export interface CinemaMovie {
  title: string;
  grade: '전체' | '12' | '15' | '19';
  runtimeMin: number;
  sessions: CinemaSession[];
}

const clock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Sample timetable with the fields the 롯데시네마 feed returns (name, start·end, screen, format, seats,
 * rating). Laid out from the current time so the screens can be reviewed at any hour.
 */
export function sampleCinema(now: Date): CinemaMovie[] {
  const base = Math.floor((now.getHours() * 60 + now.getMinutes()) / 5) * 5;
  const make = (
    title: string,
    grade: CinemaMovie['grade'],
    runtimeMin: number,
    offsets: number[],
    screen: string,
    format: string,
  ): CinemaMovie => ({
    title,
    grade,
    runtimeMin,
    sessions: offsets.map((o, i) => ({
      start: clock(base + o),
      end: clock(base + o + runtimeMin),
      screen,
      format,
      seatsLeft: Math.max(4, 180 - i * 57),
      seatsTotal: 220,
    })),
  });
  return [
    make('예시 영화 A', '12', 111, [15, 140, 265], '6관', '2D'),
    make('예시 영화 B', '15', 122, [25, 165, 300], '2관', '2D'),
    make('예시 영화 C', '전체', 98, [40, 150], '4관', '4D'),
    make('예시 영화 D', '19', 145, [70, 230], '19관', 'IMAX'),
    make('예시 영화 E', '15', 104, [95, 210, 330], '8관', '2D'),
  ];
}

/** Sessions in start order across movies — what the home board steps through. */
export const upcomingSessions = (
  movies: CinemaMovie[],
): (CinemaSession & Pick<CinemaMovie, 'title' | 'grade'>)[] =>
  movies
    .flatMap((m) => m.sessions.map((s) => ({ ...s, title: m.title, grade: m.grade })))
    .sort((x, y) => x.start.localeCompare(y.start));

export type SampleEventCategory = 'ALL' | 'SHOW' | 'EXHIBITION' | 'ETC';

export const LOTTE_SAMPLE_EVENTS: ReadonlyArray<{
  id: number;
  title: string;
  location: string;
  category: Exclude<SampleEventCategory, 'ALL'>;
}> = [
  { id: 1, title: '예시 시즌 팝업', location: '1F 아트리움', category: 'ETC' },
  { id: 2, title: '예시 브랜드 위크', location: '2F 행사장', category: 'ETC' },
  { id: 3, title: '예시 미니 콘서트', location: '5F 광장', category: 'SHOW' },
  { id: 4, title: '예시 가족 공연', location: '4F 문화홀', category: 'SHOW' },
  { id: 5, title: '예시 작가 전시', location: '6F 갤러리', category: 'EXHIBITION' },
  { id: 6, title: '예시 사진 전시', location: 'B1 전시 공간', category: 'EXHIBITION' },
];

export type AboutTab = 'facility' | 'sights' | 'nearby';
export interface AboutItem {
  tab: AboutTab;
  name: string;
  /** Where it is, read from the collected list. The introductions come with the content. */
  place: string;
}

const ABOUT: Record<string, readonly AboutItem[]> = {
  W011: [
    { tab: 'facility', name: '서울스카이', place: '롯데월드타워' },
    { tab: 'facility', name: '롯데시네마', place: '롯데월드몰 5F' },
    { tab: 'facility', name: '롯데월드 아쿠아리움', place: '롯데월드몰 B1F' },
    { tab: 'facility', name: '롯데콘서트홀', place: '롯데월드몰' },
    { tab: 'sights', name: '아레나광장', place: '롯데월드몰 1F' },
    { tab: 'sights', name: '롯데뮤지엄', place: '에비뉴엘' },
  ],
  W012: [
    { tab: 'facility', name: '롯데문화센터', place: '롯데백화점 청량리점' },
    { tab: 'facility', name: '샤롯데가든', place: '롯데백화점 청량리점 9F' },
    { tab: 'sights', name: '테라스가든', place: '롯데백화점 청량리점' },
  ],
  W013: [
    { tab: 'facility', name: '롯데문화센터', place: '롯데백화점 건대스타시티점' },
    { tab: 'facility', name: '롯데웨딩센터', place: '롯데백화점 건대스타시티점' },
  ],
};
export const lotteAbout = (kioskId: KioskId): readonly AboutItem[] =>
  ABOUT[kioskId] ?? ABOUT[SITE_FALLBACK]!;

export interface LotteSiteInfo {
  short: string;
  cinema: string;
  notice: string;
  /** Name on the 화장실 building tab for the main building. */
  branch: string;
  /** Captions under the home's building art; only 롯데월드몰 has art so far. */
  buildings: readonly string[];
  art: string | null;
}

const SITE: Record<string, LotteSiteInfo> = {
  W011: {
    short: 'LOTTE WORLD MALL',
    cinema: '월드타워',
    notice: '롯데월드몰에 오신 것을 환영합니다.',
    branch: '월드몰',
    buildings: ['롯데월드', '롯데백화점', '롯데타워', '롯데월드몰'],
    art: 'home-skyline',
  },
  W012: {
    short: 'LOTTE CHEONGNYANGNI',
    cinema: '청량리',
    notice: '롯데백화점 청량리점에 오신 것을 환영합니다.',
    branch: '청량리점',
    buildings: ['롯데백화점 청량리점'],
    art: null,
  },
  W013: {
    short: 'LOTTE STAR CITY',
    cinema: '건대입구',
    notice: '롯데백화점 건대스타시티점에 오신 것을 환영합니다.',
    branch: '건대스타시티점',
    buildings: ['롯데백화점 건대스타시티점'],
    art: null,
  },
};

export const lotteSite = (kioskId: KioskId): LotteSiteInfo => SITE[kioskId] ?? SITE[SITE_FALLBACK]!;
