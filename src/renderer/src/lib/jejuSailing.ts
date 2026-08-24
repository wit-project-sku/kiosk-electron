/**
 * 제주국제여객터미널 (W007) 운항정보 — one ferry sailing and the status condition
 * that decides how it is drawn.
 *
 * The terminal's counterpart to {@link jejuFlight}: same shape of problem, same
 * two independent conditions, deliberately NOT merged with it. A sailing has
 * 소요시간 / 선박명 / 항로 and a 국제항·연안항 berth; a flight has 항공사·편명 /
 * 구분 / 탑승구. Only the 현황 column and the re-timing rule are alike, and those
 * are ten lines each — sharing a module would mean a union type whose fields are
 * half-absent on both sides.
 *
 * Figma 여객터미널 > 운항정보 - 출발 (6420:23807) and - 도착 (6420:23892).
 * The two frames differ ONLY in two column labels (출발시각/도착시각,
 * 출발장소/도착장소) and which sailings they list; every column axis, the row
 * step and the chrome are identical.
 *
 * Two conditions drive a row, and they are independent:
 *   1. 현황 colour + word   정상운항 #005AB4 · 지연 #FF7F0F · 결항 #FF7F0F
 *   2. 출발시각 layout      one line, or the NEW time with the ORIGINAL struck
 *                          through beneath it
 * A sailing can be 지연 before a new time is published, so the strike-through is
 * driven by `estimatedTime` differing from `scheduledTime` (see `hasTimeChange`)
 * and never by the status word.
 *
 * `note` is the third: the small orange line under 현황 saying WHY (기상악화 on
 * the 결항 row). It is free text from the operator, not an enum — the design
 * shows one value but a real feed publishes many (기상악화, 정비, 결측).
 *
 * TODO(제주 W007): `SAMPLE_*` remains as fallback when the TAGO feed has not
 * landed yet. `useJejuDepartureSailings()` / `useJejuArrivalSailings()` read
 * the IPC snapshot from {@link useSailingStore} and fall back to samples when
 * empty.
 *
 * TODO(제주 W007): the 연안항 tab has NO authored rows. Both Figma frames draw
 * the 국제항 tab only (every row's 출발장소 reads 국제터미널), so inventing
 * coastal sailings here would put fabricated departure times in front of
 * travellers. The tab therefore shows the designed empty state until the feed
 * lands, which is the honest reading of a design that does not specify it.
 */
import { useMemo } from 'react';
import type { Lang } from '@renderer/lib/i18n';
import type { RawJejuSailing } from '@shared/types/jejuSailing';
import { useSailingStore } from '@renderer/store/sailingStore';

// ── Status ─────────────────────────────────────────────────────────────

/**
 * The 현황 column's condition. Only `normal`/`delayed`/`cancelled` are drawn in
 * the Figma; the rest are states a real board cannot avoid and take the board's
 * ordinary value colour so nothing visual is invented.
 */
export type SailingStatusId =
  | 'normal'
  | 'delayed'
  | 'cancelled'
  | 'boarding'
  | 'departed'
  | 'arrived';

/** 현황 text colour per condition. */
const STATUS_COLOR: Record<SailingStatusId, string> = {
  // Pinned by the design (6420:23864 / 23856 / 23848).
  normal: '#005ab4', // [화성휴게소] main 1 — the same blue the airport board uses for 탑승 중
  delayed: '#ff7f0f', // [제주] main 01
  cancelled: '#ff7f0f', // [제주] main 01 — 결항 is drawn in the same orange as 지연
  // Not drawn anywhere. Unremarkable states take the same #333 every other cell
  // uses rather than introducing a colour of their own.
  boarding: '#005ab4',
  departed: '#333',
  arrived: '#333',
};

const STATUS_LABEL: Record<SailingStatusId, Partial<Record<Lang, string>>> = {
  normal: {
    ko: '정상운항', en: 'On Time', ja: '通常運航', zh: '正常运航',
    vi: 'Đúng giờ', th: 'ตรงเวลา', ru: 'По расписанию', id: 'Tepat Waktu',
  },
  delayed: {
    ko: '지연', en: 'Delayed', ja: '遅延', zh: '延误',
    vi: 'Trễ chuyến', th: 'ล่าช้า', ru: 'Задержан', id: 'Tertunda',
  },
  cancelled: {
    ko: '결항', en: 'Cancelled', ja: '欠航', zh: '停航',
    vi: 'Đã hủy', th: 'ยกเลิกเดินเรือ', ru: 'Отменён', id: 'Dibatalkan',
  },
  boarding: {
    ko: '승선 중', en: 'Boarding', ja: '乗船中', zh: '登船中',
    vi: 'Đang lên tàu', th: 'กำลังขึ้นเรือ', ru: 'Посадка', id: 'Boarding',
  },
  departed: {
    ko: '출항', en: 'Departed', ja: '出港済', zh: '已出港',
    vi: 'Đã rời bến', th: 'ออกจากท่าแล้ว', ru: 'Отправился', id: 'Berangkat',
  },
  arrived: {
    ko: '입항', en: 'Arrived', ja: '入港済', zh: '已入港',
    vi: 'Đã cập bến', th: 'ถึงท่าแล้ว', ru: 'Прибыл', id: 'Tiba',
  },
};

/**
 * Raw 현황 strings a sailing feed emits → our condition. Korean first (that is
 * what the Korean maritime feeds return), English second. Matching is on the
 * whitespace-stripped, lower-cased string so '승선 중' and '승선중' are one key.
 */
const STATUS_ALIASES: Record<string, SailingStatusId> = {
  // normal
  '정상운항': 'normal', '정상': 'normal', '운항': 'normal', '운항예정': 'normal', '예정': 'normal',
  normal: 'normal', ontime: 'normal', scheduled: 'normal',
  // delayed
  '지연': 'delayed', '지연운항': 'delayed', delayed: 'delayed', delay: 'delayed',
  // cancelled
  '결항': 'cancelled', '취소': 'cancelled', '운항중단': 'cancelled',
  cancelled: 'cancelled', canceled: 'cancelled',
  // boarding
  '승선중': 'boarding', '승선': 'boarding', boarding: 'boarding',
  // departed / arrived
  '출항': 'departed', '출항완료': 'departed', departed: 'departed',
  '입항': 'arrived', '입항완료': 'arrived', '도착': 'arrived', arrived: 'arrived',
};

/**
 * Feed string → condition.
 *
 * Two distinct "no condition" cases, and they are NOT the same:
 *  - nothing published → `undefined`, and the 현황 cell is left BLANK;
 *  - a word we do not recognise → `normal`. Showing a neutral 정상운항 for an
 *    unknown status is safe; guessing 결항 or 지연 for one is not.
 */
export function normalizeSailingStatus(raw: string | undefined): SailingStatusId | undefined {
  if (!raw || !raw.trim()) return undefined;
  const key = raw.replace(/\s+/g, '').toLowerCase();
  return STATUS_ALIASES[key] ?? 'normal';
}

export function sailingStatusLabel(status: SailingStatusId, lang: Lang): string {
  const map = STATUS_LABEL[status];
  return map[lang] ?? map.ko ?? status;
}

export function sailingStatusColor(status: SailingStatusId): string {
  return STATUS_COLOR[status];
}

// ── Sailing row ────────────────────────────────────────────────────────

/**
 * Which berth the sailing uses — the page's 국제항 ㅣ 연안항 sub-tab.
 *
 * 제주항 has two passenger terminals and this kiosk stands in the international
 * one: 국제여객터미널 (long-haul and overseas) and 연안여객터미널 (the coastal
 * island runs). It is the BERTH, not the flag of the route — 제주국제-삼천포신항
 * is a domestic sailing that still leaves from the international terminal.
 */
export type SailingPort = 'international' | 'coastal';

/** What every sailing row carries, whichever direction it is going. */
export interface JejuSailing {
  /** Stable key. A ship can run the same route twice a day, so the time is part of it. */
  id: string;
  /** Published time, `HH:mm`. Always the ORIGINAL — never overwrite it. */
  scheduledTime: string;
  /**
   * Revised time, `HH:mm`. Set only when the operator has re-timed the sailing.
   * When it differs from `scheduledTime` the board leads with this and strikes
   * the original through beneath it.
   */
  estimatedTime?: string;
  /** 소요시간 — passage length as `HH:mm`, not a clock time. */
  duration: string;
  /** 선박명. */
  shipName: string;
  /** 항로 — `출발지-도착지`, as the operator publishes it. */
  route: string;
  /** 출발장소 / 도착장소 — the terminal, e.g. 국제터미널. */
  place: string;
  port: SailingPort;
  /** Absent when the operator has published no 현황 yet — the cell stays blank. */
  status?: SailingStatusId;
  /** Reason line under 현황 (기상악화). Free operator text; absent on most rows. */
  note?: string;
}

/**
 * True when the sailing has been re-timed — the condition that adds the
 * struck-through original time under the leading one.
 */
export function hasTimeChange(s: JejuSailing): boolean {
  return !!s.estimatedTime && s.estimatedTime !== s.scheduledTime;
}

/** The time a board leads with: the revised one when there is one. */
export function displaySailingTime(s: JejuSailing): string {
  return hasTimeChange(s) ? (s.estimatedTime as string) : s.scheduledTime;
}

export function normalizeSailing(raw: RawJejuSailing): JejuSailing {
  return {
    id: raw.id,
    scheduledTime: raw.scheduledTime,
    estimatedTime: raw.estimatedTime,
    duration: raw.duration,
    shipName: raw.shipName,
    route: raw.route,
    place: raw.place,
    port: raw.port === '연안항' || raw.port === 'coastal' ? 'coastal' : 'international',
    status: normalizeSailingStatus(raw.status),
    note: raw.note,
  };
}

// ── Source ─────────────────────────────────────────────────────────────

/**
 * Placeholder departures — the six rows 6420:23807 draws, in order, written as
 * RAW feed rows on purpose so the status mapping is exercised on every render
 * instead of being untested code waiting for an API.
 *
 * Row 1 is the 결항 + 기상악화 condition and row 2 the re-timed 지연 (16:05 →
 * 16:15, struck through); the rest are 정상운항, so every drawn condition is
 * reachable on a running kiosk.
 */
const SAMPLE_DEPARTURES: RawJejuSailing[] = [
  {
    id: 'dep-goldstella-1615', scheduledTime: '16:15', duration: '02:40',
    shipName: '골드스텔라', route: '제주국제-삼천포신항', place: '국제터미널',
    port: '국제항', status: '결항', note: '기상악화',
  },
  {
    id: 'dep-queenjenuvia2-1605', scheduledTime: '16:05', estimatedTime: '16:15', duration: '02:40',
    shipName: '퀸제누비아2', route: '제주도-하추자도', place: '국제터미널',
    port: '국제항', status: '지연',
  },
  {
    id: 'dep-queenjenuvia2-1615', scheduledTime: '16:15', duration: '02:40',
    shipName: '퀸제누비아2', route: '제주도-하추자도', place: '국제터미널',
    port: '국제항', status: '정상운항',
  },
  {
    id: 'dep-queenjenuvia2-1715', scheduledTime: '17:15', duration: '02:40',
    shipName: '퀸제누비아2', route: '제주도-하추자도', place: '국제터미널',
    port: '국제항', status: '정상운항',
  },
  {
    id: 'dep-queenjenuvia2-1815', scheduledTime: '18:15', duration: '02:40',
    shipName: '퀸제누비아2', route: '제주도-하추자도', place: '국제터미널',
    port: '국제항', status: '정상운항',
  },
  {
    id: 'dep-queenjenuvia2-1915', scheduledTime: '19:15', duration: '02:40',
    shipName: '퀸제누비아2', route: '제주도-하추자도', place: '국제터미널',
    port: '국제항', status: '정상운항',
  },
];

/**
 * Placeholder arrivals — the three rows 6420:23892 draws. That frame lists
 * fewer sailings than 출발 and leads with the 지연 condition; both are the
 * design, not an omission.
 */
const SAMPLE_ARRIVALS: RawJejuSailing[] = [
  {
    id: 'arr-queenjenuvia2-1615', scheduledTime: '16:15', duration: '02:40',
    shipName: '퀸제누비아2', route: '제주도-하추자도', place: '국제터미널',
    port: '국제항', status: '지연',
  },
  {
    id: 'arr-queenjenuvia2-1715', scheduledTime: '17:15', duration: '02:40',
    shipName: '퀸제누비아2', route: '제주도-하추자도', place: '국제터미널',
    port: '국제항', status: '정상운항',
  },
  {
    id: 'arr-queenjenuvia2-1815', scheduledTime: '18:15', duration: '02:40',
    shipName: '퀸제누비아2', route: '제주도-하추자도', place: '국제터미널',
    port: '국제항', status: '정상운항',
  },
];

/**
 * The sailings behind the 운항정보 page's 출발 tab.
 *
 * THE seam: replace the body with the real feed (a store fed over IPC,
 * mirroring `useWeatherStore`) and map each row through `normalizeSailing`.
 * Everything downstream — colours, the strike-through condition, the page's two
 * tabs and its 국제항/연안항 filter — is already driven by the normalised shape.
 */
export function useJejuDepartureSailings(): JejuSailing[] {
  const snapshot = useSailingStore((s) => s.snapshot);
  const rows = snapshot?.departures;
  return useMemo(() => {
    if (snapshot) return (rows ?? []).map(normalizeSailing);
    return SAMPLE_DEPARTURES.map(normalizeSailing);
  }, [snapshot, rows]);
}

/** The sailings behind the 도착 tab. Same seam as above. */
export function useJejuArrivalSailings(): JejuSailing[] {
  const snapshot = useSailingStore((s) => s.snapshot);
  const rows = snapshot?.arrivals;
  return useMemo(() => {
    if (snapshot) return (rows ?? []).map(normalizeSailing);
    return SAMPLE_ARRIVALS.map(normalizeSailing);
  }, [snapshot, rows]);
}
