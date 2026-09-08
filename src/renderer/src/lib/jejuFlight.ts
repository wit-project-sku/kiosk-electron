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
 * `useJejuDepartures()` / `useJejuArrivals()` read the IPC snapshot from
 * `useFlightStore` (filled by FlightService from 한국공항공사 실시간 운항정보).
 * Raw feed strings go through `normalizeFlightStatus` so the board colours and
 * strike-through stay independent of the transport.
 */
import { useMemo } from 'react';
import type { Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { useFlightStore } from '@renderer/store/flightStore';
import type { RawJejuArrival, RawJejuDeparture } from '@shared/types/jejuFlight';

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
  final: '#2e7d32', // green 01 — home board 6217:97433 / 도착 현황
  delayed: '#ff7f0f', // [제주] main 01 — home board 6217:96955
  arrived: '#2e7d32', // 탑승최종과 동일 — 운항정보=도착
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
    ko: '탑승중', en: 'Boarding', ja: '搭乗中', zh: '登机中',
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
  // cancelled — 한국공항공사 also emits 사전결항 (advance cancel) on arrivals
  '결항': 'cancelled', '사전결항': 'cancelled', '취소': 'cancelled',
  cancelled: 'cancelled', canceled: 'cancelled',
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
 *
 * Exception: any feed string that contains 결항 (사전결항, 기상결항, …) is
 * cancelled even when it is not an exact alias — falling through to 출발예정
 * would hide a real disruption.
 */
export function normalizeFlightStatus(raw: string | undefined): FlightStatusId | undefined {
  if (!raw || !raw.trim()) return undefined;
  const key = raw.replace(/\s+/g, '').toLowerCase();
  const exact = STATUS_ALIASES[key];
  if (exact) return exact;
  if (key.includes('결항') || key.includes('cancel')) return 'cancelled';
  return 'scheduled';
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
  const key = kind === 'international' ? 'Help_International' : 'Help_Domestic';
  return sheetText(key, lang, KIND_LABEL[kind]);
}

/** What every flight row carries, whichever direction it is going. */
export interface JejuFlightBase {
  /** Stable key. Fid + 편명 + 시각 — codeshares share a flight number. */
  id: string;
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
export type { RawJejuArrival, RawJejuDeparture };

function normalizeBase(raw: RawJejuDeparture | RawJejuArrival): JejuFlightBase {
  return {
    id: raw.id || raw.flightNo,
    flightNo: raw.flightNo,
    scheduledTime: raw.scheduledTime,
    estimatedTime: raw.estimatedTime,
    airline: raw.airline,
    kind: raw.kind === '국제선' || raw.kind === 'international' ? 'international' : 'domestic',
    status: normalizeFlightStatus(raw.status),
  };
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

/** Empty/null board cells (탑승구 · 수하물수취대 · 현황) read as "-". */
export function dashIfEmpty(value: string | undefined): string {
  if (value?.trim()) return value.trim();
  return '-';
}

/** 탑승구 — empty/null from the apron feed reads as "-". */
export function formatGate(gate: string | undefined): string {
  return dashIfEmpty(gate);
}

export function normalizeDeparture(raw: RawJejuDeparture): JejuDeparture {
  return { ...normalizeBase(raw), destination: raw.destination, gate: raw.gate };
}

export function normalizeArrival(raw: RawJejuArrival): JejuArrival {
  return { ...normalizeBase(raw), origin: raw.origin, belt: raw.belt };
}

export function useJejuDepartures(): JejuDeparture[] {
  const rows = useFlightStore((s) => s.snapshot?.departures);
  return useMemo(() => (rows ?? []).map(normalizeDeparture), [rows]);
}

export function useJejuArrivals(): JejuArrival[] {
  const rows = useFlightStore((s) => s.snapshot?.arrivals);
  return useMemo(() => (rows ?? []).map(normalizeArrival), [rows]);
}

