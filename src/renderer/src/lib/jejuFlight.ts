/**
 * 제주공항 (W006) 운항 정보 — the departure row shown on the home board, and the
 * status condition that decides how it is drawn.
 *
 * Figma draws the SAME board in three conditions (제주>홈 6212:48936 / 6217:96955
 * / 6217:97433). They differ in exactly two ways, and this module owns both:
 *
 *   1. 현황 colour + word   탑승 중 #005AB4 · 지연 #FF7F0F · 탑승최종 #2E7D32
 *   2. 출발시각 layout      one line, or the NEW time with the ORIGINAL struck
 *                          through beneath it
 *
 * The second is deliberately NOT keyed off the status word. A flight can be 지연
 * before a new time is published, and a re-timed flight can go 탑승 중 while
 * still showing the change. So the strike-through is driven by `estimatedTime`
 * differing from `scheduledTime` (see `hasTimeChange`), and the colour by the
 * status — two independent conditions, exactly as the design implies.
 *
 * TODO(제주 W006): `SAMPLE_DEPARTURES` is placeholder data. The kiosk has no
 * airport feed — ShopService/EventsService/WeatherService are the only ones —
 * so this ships the literal rows drawn in the Figma. `useJejuDepartures()` is
 * the ONE seam: swap its body for the real departures feed (한국공항공사 운항
 * 현황 or equivalent) and everything below keeps working, because the raw feed
 * strings already go through `normalizeFlightStatus`. A board showing a stale
 * 대한항공 16:05 to every traveller is worse than no board — wire it before this
 * goes live.
 */
import { useMemo } from 'react';
import type { Lang } from '@renderer/lib/i18n';

// ── Status ─────────────────────────────────────────────────────────────

/**
 * The 현황 column's condition. Only `boarding`/`delayed`/`final` are drawn in
 * the Figma; the rest are the states a real board cannot avoid and are given
 * the board's ordinary value colour so nothing visual is invented.
 */
export type FlightStatusId =
  | 'scheduled'
  | 'boarding'
  | 'final'
  | 'delayed'
  | 'departed'
  | 'arrived'
  | 'cancelled';

/** 현황 text colour per condition. */
const STATUS_COLOR: Record<FlightStatusId, string> = {
  // Pinned by the design.
  boarding: '#005ab4', // [화성휴게소] main 1 — home board 6212:48936
  final: '#2e7d32', // green 01 — home board 6217:97433
  delayed: '#ff7f0f', // [제주] main 01 — home board 6217:96955
  arrived: '#ff7f0f', // [제주] main 01 — 운항정보=도착 6219:98530
  // Not drawn anywhere. `scheduled`/`departed` are unremarkable, so they take
  // the same #333 every other cell uses. `cancelled` is a disruption like 지연
  // and reuses that token rather than introducing a colour of its own.
  scheduled: '#333',
  departed: '#333',
  cancelled: '#ff7f0f',
};

const STATUS_LABEL: Record<FlightStatusId, Partial<Record<Lang, string>>> = {
  scheduled: {
    ko: '출발예정', en: 'Scheduled', ja: '出発予定', zh: '预定起飞',
    vi: 'Dự kiến', th: 'ตามกำหนด', ru: 'По расписанию', id: 'Terjadwal',
  },
  boarding: {
    ko: '탑승 중', en: 'Boarding', ja: '搭乗中', zh: '登机中',
    vi: 'Đang lên máy bay', th: 'กำลังขึ้นเครื่อง', ru: 'Посадка', id: 'Boarding',
  },
  final: {
    ko: '탑승최종', en: 'Final Call', ja: '最終搭乗', zh: '最后登机',
    vi: 'Gọi lần cuối', th: 'เรียกครั้งสุดท้าย', ru: 'Последний вызов', id: 'Panggilan terakhir',
  },
  delayed: {
    ko: '지연', en: 'Delayed', ja: '遅延', zh: '延误',
    vi: 'Trễ chuyến', th: 'ล่าช้า', ru: 'Задержан', id: 'Tertunda',
  },
  departed: {
    ko: '출발', en: 'Departed', ja: '出発済', zh: '已起飞',
    vi: 'Đã khởi hành', th: 'ออกเดินทางแล้ว', ru: 'Вылетел', id: 'Berangkat',
  },
  arrived: {
    ko: '도착', en: 'Arrived', ja: '到着', zh: '已到达',
    vi: 'Đã đến', th: 'ถึงแล้ว', ru: 'Прибыл', id: 'Tiba',
  },
  cancelled: {
    ko: '결항', en: 'Cancelled', ja: '欠航', zh: '航班取消',
    vi: 'Đã hủy', th: 'ยกเลิกเที่ยวบิน', ru: 'Отменён', id: 'Dibatalkan',
  },
};

/**
 * Raw 현황 strings a departures feed emits → our condition. Korean first (that
 * is what 한국공항공사 returns), English second for feeds that localise. Matching
 * is on the whitespace-stripped, lower-cased string so '탑승 중' and '탑승중'
 * are the same key — the Figma writes it with a space, feeds usually do not.
 */
const STATUS_ALIASES: Record<string, FlightStatusId> = {
  // scheduled
  '출발예정': 'scheduled', '예정': 'scheduled', '정상': 'scheduled', '수속중': 'scheduled',
  scheduled: 'scheduled', ontime: 'scheduled', checkin: 'scheduled',
  // boarding
  '탑승중': 'boarding', '탑승': 'boarding', boarding: 'boarding',
  // final call
  '탑승최종': 'final', '탑승마감': 'final', '최종탑승': 'final', '마감': 'final',
  finalcall: 'final', final: 'final', lastcall: 'final', gateclosing: 'final',
  // delayed
  '지연': 'delayed', delayed: 'delayed', delay: 'delayed',
  // departed
  '출발': 'departed', departed: 'departed', gone: 'departed',
  // arrived
  '도착': 'arrived', '착륙': 'arrived', arrived: 'arrived', landed: 'arrived',
  // cancelled
  '결항': 'cancelled', '취소': 'cancelled', cancelled: 'cancelled', canceled: 'cancelled',
};

/**
 * Feed string → condition.
 *
 * Two distinct "no condition" cases, and they are NOT the same:
 *  - nothing published → `undefined`, and the 현황 cell is left BLANK. The
 *    운항정보=도착 frame (6219:98493) does exactly this for every flight still
 *    en route — rows 4 onward have no 현황 text at all.
 *  - a word we do not recognise → `scheduled`. Showing a neutral 출발예정 for an
 *    unknown status is safe; guessing 결항 or 지연 for one is not.
 */
export function normalizeFlightStatus(raw: string | undefined): FlightStatusId | undefined {
  if (!raw || !raw.trim()) return undefined;
  const key = raw.replace(/\s+/g, '').toLowerCase();
  return STATUS_ALIASES[key] ?? 'scheduled';
}

export function flightStatusLabel(status: FlightStatusId, lang: Lang): string {
  const map = STATUS_LABEL[status];
  return map[lang] ?? map.ko ?? status;
}

export function flightStatusColor(status: FlightStatusId): string {
  return STATUS_COLOR[status];
}

// ── Departure row ──────────────────────────────────────────────────────

/** 구분 — the only enum-ish data column, so it is translated like a label. */
export type FlightKind = 'domestic' | 'international';

const KIND_LABEL: Record<FlightKind, Partial<Record<Lang, string>>> = {
  domestic: {
    ko: '국내선', en: 'Domestic', ja: '国内線', zh: '国内航班',
    vi: 'Nội địa', th: 'ในประเทศ', ru: 'Внутренний', id: 'Domestik',
  },
  international: {
    ko: '국제선', en: 'International', ja: '国際線', zh: '国际航班',
    vi: 'Quốc tế', th: 'ระหว่างประเทศ', ru: 'Международный', id: 'Internasional',
  },
};

export function flightKindLabel(kind: FlightKind, lang: Lang): string {
  const map = KIND_LABEL[kind];
  return map[lang] ?? map.ko ?? kind;
}

/** What every flight row carries, whichever direction it is going. */
export interface JejuFlightBase {
  /** Stable key. Flight number is unique per day on a board. */
  flightNo: string;
  /** Published time, `HH:mm`. Always the ORIGINAL — never overwrite it. */
  scheduledTime: string;
  /**
   * Revised time, `HH:mm`. Set only when the airport has re-timed the flight.
   * When it differs from `scheduledTime` the board leads with this and strikes
   * the original through beneath it.
   */
  estimatedTime?: string;
  airline: string;
  kind: FlightKind;
  /** Absent when the airport has published no 현황 yet — the cell stays blank. */
  status?: FlightStatusId;
}

/** 출발 — 목적지 / 탑승구. */
export interface JejuDeparture extends JejuFlightBase {
  destination: string;
  gate: string;
}

/** 도착 — 출발지 / 수하물수취대. */
export interface JejuArrival extends JejuFlightBase {
  origin: string;
  belt: string;
}

/** The rows as a feed hands them over, before normalisation. */
interface RawFlightBase {
  flightNo: string;
  scheduledTime: string;
  estimatedTime?: string;
  airline: string;
  kind?: string;
  status?: string;
}
export interface RawJejuDeparture extends RawFlightBase {
  destination: string;
  gate: string;
}
export interface RawJejuArrival extends RawFlightBase {
  origin: string;
  belt: string;
}

/**
 * True when the flight has been re-timed — the condition that adds the
 * struck-through original time under the leading one.
 */
export function hasTimeChange(f: JejuFlightBase): boolean {
  return !!f.estimatedTime && f.estimatedTime !== f.scheduledTime;
}

/** The time a board leads with: the revised one when there is one. */
export function displayTime(f: JejuFlightBase): string {
  return hasTimeChange(f) ? (f.estimatedTime as string) : f.scheduledTime;
}

function normalizeBase(raw: RawFlightBase): JejuFlightBase {
  return {
    flightNo: raw.flightNo,
    scheduledTime: raw.scheduledTime,
    estimatedTime: raw.estimatedTime,
    airline: raw.airline,
    kind: raw.kind === '국제선' || raw.kind === 'international' ? 'international' : 'domestic',
    status: normalizeFlightStatus(raw.status),
  };
}

export function normalizeDeparture(raw: RawJejuDeparture): JejuDeparture {
  return { ...normalizeBase(raw), destination: raw.destination, gate: raw.gate };
}

export function normalizeArrival(raw: RawJejuArrival): JejuArrival {
  return { ...normalizeBase(raw), origin: raw.origin, belt: raw.belt };
}

// ── Source ─────────────────────────────────────────────────────────────

/**
 * Placeholder departures — see the TODO at the top of this file.
 *
 * These are written as RAW feed rows on purpose: they go through
 * `normalizeDeparture` exactly like live data would, so the status mapping is
 * exercised on every render instead of being untested code waiting for an API.
 *
 * The three rows are the three Figma conditions, in order, so all of them are
 * reachable on a running kiosk: the board leads with the first and 운항 정보
 * 더보기 reveals the rest.
 */
const SAMPLE_DEPARTURES: RawJejuDeparture[] = [
  {
    flightNo: 'KE1141', scheduledTime: '16:05', airline: '대한항공',
    destination: '김해/부산', kind: '국내선', gate: '7', status: '탑승중',
  },
  {
    flightNo: 'OZ8942', scheduledTime: '16:05', estimatedTime: '16:15',
    airline: '아시아나항공', destination: '김포/서울', kind: '국내선', gate: '4', status: '지연',
  },
  {
    flightNo: '7C512', scheduledTime: '16:15', airline: '제주항공',
    destination: '인천/서울', kind: '국제선', gate: '2', status: '탑승마감',
  },
  { flightNo: 'LJ304', scheduledTime: '16:30', airline: '진에어', destination: '서울/김포', kind: '국내선', gate: '5', status: '탑승마감' },
  { flightNo: 'TW702', scheduledTime: '16:40', airline: '티웨이항공', destination: '대구', kind: '국내선', gate: '9', status: '탑승마감' },
  { flightNo: 'BX8814', scheduledTime: '16:50', airline: '에어부산', destination: '부산/김해', kind: '국내선', gate: '3', status: '출발예정' },
  { flightNo: 'RS902', scheduledTime: '17:00', airline: '에어서울', destination: '오사카/간사이', kind: '국제선', gate: '11', status: '출발예정' },
  { flightNo: 'KE1156', scheduledTime: '17:10', airline: '대한항공', destination: '서울/김포', kind: '국내선', gate: '7' },
];

/**
 * Placeholder arrivals — 운항정보=도착 (6219:98493). Rows past the third carry
 * NO 현황 in the design, so their `status` is omitted rather than set to a
 * guess; `normalizeFlightStatus` turns that into a blank cell.
 */
const SAMPLE_ARRIVALS: RawJejuArrival[] = [
  {
    flightNo: 'KE1141', scheduledTime: '16:05', estimatedTime: '16:15',
    airline: '대한항공', origin: '서울/김포', kind: '국내선', belt: '7', status: '도착',
  },
  {
    flightNo: 'OZ8942', scheduledTime: '16:15', airline: '아시아나항공',
    origin: '오사카/간사이', kind: '국제선', belt: '7', status: '도착',
  },
  {
    flightNo: '7C512', scheduledTime: '16:25', airline: '제주항공',
    origin: '서울/김포', kind: '국내선', belt: '7', status: '도착',
  },
  { flightNo: 'LJ304', scheduledTime: '16:35', airline: '진에어', origin: '서울/김포', kind: '국내선', belt: '7' },
  { flightNo: 'TW702', scheduledTime: '16:45', airline: '티웨이항공', origin: '서울/김포', kind: '국내선', belt: '7' },
  { flightNo: 'BX8814', scheduledTime: '16:55', airline: '에어부산', origin: '부산/김해', kind: '국내선', belt: '6' },
  { flightNo: 'RS902', scheduledTime: '17:05', airline: '에어서울', origin: '서울/김포', kind: '국내선', belt: '6' },
];

/**
 * The departures the home board leads with and the 운항정보 page lists,
 * most imminent first.
 *
 * THE seam: replace the body with the real feed (a store fed over IPC,
 * mirroring `useWeatherStore`) and map each row through `normalizeDeparture`.
 * Everything downstream — colours, the strike-through condition, the page's
 * two tabs — is already driven by the normalised shape.
 */
export function useJejuDepartures(): JejuDeparture[] {
  return useMemo(() => SAMPLE_DEPARTURES.map(normalizeDeparture), []);
}

/** The arrivals behind the 운항정보 page's 도착 tab. Same seam as above. */
export function useJejuArrivals(): JejuArrival[] {
  return useMemo(() => SAMPLE_ARRIVALS.map(normalizeArrival), []);
}
