import type {
  JejuSailingSnapshot,
  RawJejuSailing,
} from '@shared/types/jejuSailing';
import { createLogger } from '@main/core/logger';
import type { KioskService } from './KioskService';
import type { LocalCacheService } from './LocalCacheService';

const log = createLogger('sailing-service');

const REFRESH_MS = 5 * 60 * 1000;
const CACHE_KEY = 'jeju-sailings';
const PAGE_SIZE = 100;
const MAX_PAGES = 30;
const BASE_URL = 'https://mtisopenapi.komsa.or.kr/eopt/api';
const TERMINAL_KIOSK = 'W007';

/** Mainland / island counterparts that typically berth at 제주 국제여객터미널. */
const INTERNATIONAL_COUNTERPARTS = [
  '완도', '삼천포', '녹동', '여수', '부산', '포항', '진도', '인천',
] as const;
/** Counterparts that typically berth at 제주 연안여객터미널. */
const COASTAL_COUNTERPARTS = [
  '목포', '추자', '하추자', '상추자', '모슬포', '가파', '마라', '우도', '성산', '한림', '애월',
] as const;

type SailingListener = (snapshot: JejuSailingSnapshot) => void;

interface KomsaBody {
  items?: unknown;
  numOfRows?: number | string;
  pageNo?: number | string;
  totalCount?: number | string;
}

interface KomsaResponse {
  response?: {
    header?: { resultCode?: string | number; resultMsg?: string };
    body?: KomsaBody;
  };
}

interface RouteDuration {
  forward: string;
  reverse: string;
}

/**
 * Fetches 제주항 departures + arrivals from KOMSA MTIS 연안여객선 APIs
 * (`oprt-schd-info` + `oprt-rt-info`), caches them, and refreshes every five
 * minutes. Unlike the airport flight board, the full day's schedule is kept —
 * past sailings are not hidden by the current clock. Gated to W007.
 */
export class SailingService {
  private current: JejuSailingSnapshot | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cacheHydrated = false;
  private warnedNoKey = false;
  private routeDurations: Map<string, RouteDuration> | null = null;
  private readonly listeners = new Set<SailingListener>();

  constructor(
    private readonly cache: LocalCacheService,
    private readonly kiosk: KioskService,
  ) {}

  start(): void {
    if (!this.timer) {
      this.timer = setInterval(() => void this.tick(), REFRESH_MS);
    }
    void this.tick();
  }

  async refreshIfTerminal(): Promise<void> {
    if (this.kiosk.getConfig().kioskId !== TERMINAL_KIOSK) return;
    this.hydrateFromCacheOnce();
    await this.refresh();
  }

  private async tick(): Promise<void> {
    if (this.kiosk.getConfig().kioskId !== TERMINAL_KIOSK) return;
    this.hydrateFromCacheOnce();
    await this.refresh();
  }

  private hydrateFromCacheOnce(): void {
    if (this.cacheHydrated) return;
    this.cacheHydrated = true;

    const cached = this.cache.get(CACHE_KEY);
    const data = cached?.data as Partial<JejuSailingSnapshot> | undefined;
    if (data && Array.isArray(data.departures) && Array.isArray(data.arrivals)) {
      this.current = {
        fetchedAt: typeof data.fetchedAt === 'string' ? data.fetchedAt : '',
        departures: data.departures,
        arrivals: data.arrivals,
      };
      this.emit();
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getCurrent(): JejuSailingSnapshot | null {
    return this.current;
  }

  subscribe(listener: SailingListener): () => void {
    this.listeners.add(listener);
    if (this.current) listener(this.current);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    if (!this.current) return;
    for (const listener of this.listeners) listener(this.current);
  }

  private async refresh(): Promise<void> {
    const serviceKey = resolveServiceKey();
    if (!serviceKey) {
      if (!this.warnedNoKey) {
        log.warn('KOMSA_SERVICE_KEY not set; 제주 선박 운항정보 disabled. See .env.example');
        this.warnedNoKey = true;
      }
      return;
    }

    const today = seoulYmd();
    const yesterday = seoulYmdOffset(-1);

    try {
      const durations = await this.ensureRouteDurations(serviceKey);

      // Today first so the home board can paint; yesterday covers overnight arrivals.
      const todayItems = await this.fetchSchedulePages(serviceKey, today);
      const { departures, arrivals: todayArrivals } = partitionJeju(
        todayItems,
        today,
        durations,
      );

      this.current = {
        fetchedAt: new Date().toISOString(),
        departures,
        arrivals: todayArrivals,
      };
      this.cache.upsert(CACHE_KEY, this.current as unknown as Record<string, unknown>, 'komsa-sailings');
      this.emit();

      let arrivals = todayArrivals;
      try {
        const yesterdayItems = await this.fetchSchedulePages(serviceKey, yesterday);
        const fromYesterday = partitionJeju(yesterdayItems, today, durations).arrivals;
        arrivals = dedupeAndSort([...todayArrivals, ...fromYesterday]);
      } catch (error) {
        log.warn('KOMSA yesterday schedule fetch failed (keeping today arrivals)', error);
      }

      const snapshot: JejuSailingSnapshot = {
        fetchedAt: new Date().toISOString(),
        departures,
        arrivals,
      };
      this.current = snapshot;
      this.cache.upsert(CACHE_KEY, snapshot as unknown as Record<string, unknown>, 'komsa-sailings');
      this.emit();
      log.info('Jeju sailings updated (KOMSA)', {
        departures: departures.length,
        arrivals: arrivals.length,
      });
    } catch (error) {
      log.warn('Jeju sailing fetch failed (keeping last snapshot)', error);
    }
  }

  private async ensureRouteDurations(serviceKey: string): Promise<Map<string, RouteDuration>> {
    if (this.routeDurations) return this.routeDurations;

    const map = new Map<string, RouteDuration>();
    try {
      const items = await this.fetchAllPages('oprt-rt-info', serviceKey, {});
      for (const item of items) {
        const lcns = first(item, ['lcns_seawy_cd', 'lcnsSeawyCd']);
        const code = first(item, ['nvg_seawy_cd', 'nvgSeawyCd']);
        if (!lcns || !code) continue;
        // nvg_seawy_cd alone collides nationwide ("01" etc.) — key with license route.
        map.set(durationKey(lcns, code), {
          forward: minutesToHm(first(item, ['fwd_nvg_req_hr', 'fwdNvgReqHr'])),
          reverse: minutesToHm(first(item, ['rev_nvg_req_hr', 'revNvgReqHr'])),
        });
      }
      log.info('KOMSA route durations loaded', { routes: map.size });
    } catch (error) {
      log.warn('KOMSA oprt-rt-info failed (duration will be blank)', error);
    }

    this.routeDurations = map;
    return map;
  }

  private async fetchSchedulePages(
    serviceKey: string,
    ymd: string,
  ): Promise<Record<string, unknown>[]> {
    return this.fetchAllPages('oprt-schd-info', serviceKey, { rlvtYmd: ymd });
  }

  private async fetchAllPages(
    operation: string,
    serviceKey: string,
    extra: Record<string, string>,
  ): Promise<Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = [];
    let pageNo = 1;
    let total = Infinity;

    while (pageNo <= MAX_PAGES && (pageNo - 1) * PAGE_SIZE < total) {
      const body = await this.fetchOperation(operation, serviceKey, {
        ...extra,
        pageNo: String(pageNo),
      });
      const items = unwrapItems(body.items);
      total = Number(body.totalCount ?? items.length);
      if (!Number.isFinite(total)) total = items.length;
      rows.push(...items);
      if (items.length === 0) break;
      pageNo += 1;
    }

    return rows;
  }

  private async fetchOperation(
    operation: string,
    serviceKey: string,
    extra: Record<string, string>,
  ): Promise<KomsaBody> {
    const qs = new URLSearchParams({
      pageNo: extra['pageNo'] ?? '1',
      numOfRows: String(PAGE_SIZE),
      ...extra,
    });
    // Append serviceKey raw — portal keys are often already percent-encoded.
    const url = `${BASE_URL}/${operation}?serviceKey=${serviceKey}&${qs.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const json = await readKomsaJson(res);
    const header = json.response?.header;
    const code = String(header?.resultCode ?? '');
    // KOMSA uses HTTP-style 200 / NORMAL_SERVICE; some feeds also return 00/0000/0.
    const ok =
      !code ||
      code === '00' ||
      code === '0000' ||
      code === '0' ||
      code === '200';
    if (!ok) {
      throw new Error(`KOMSA ${operation} ${code}: ${header?.resultMsg ?? ''}`);
    }
    if (!json.response?.body && !res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return json.response?.body ?? {};
  }
}

function resolveServiceKey(): string | undefined {
  return process.env['KOMSA_SERVICE_KEY']?.trim() || undefined;
}

function partitionJeju(
  items: Record<string, unknown>[],
  boardYmd: string,
  durations: Map<string, RouteDuration>,
): { departures: RawJejuSailing[]; arrivals: RawJejuSailing[] } {
  const departures: RawJejuSailing[] = [];
  const arrivals: RawJejuSailing[] = [];

  for (const item of items) {
    const dep = mapScheduleItem(item, 'departure', boardYmd, durations);
    if (dep) departures.push(dep);
    const arr = mapScheduleItem(item, 'arrival', boardYmd, durations);
    if (arr) arrivals.push(arr);
  }

  return {
    departures: dedupeAndSort(departures),
    arrivals: dedupeAndSort(arrivals),
  };
}

function mapScheduleItem(
  item: Record<string, unknown>,
  direction: 'departure' | 'arrival',
  boardYmd: string,
  durations: Map<string, RouteDuration>,
): RawJejuSailing | null {
  const shipName = first(item, ['psnshp_nm', 'psnshpNm']);
  if (!shipName) return null;

  const origin = first(item, ['oport_nm', 'oportNm']);
  const destination = first(item, ['dest_nm', 'destNm']);
  const ymd = first(item, ['rlvt_ymd', 'rlvtYmd']) || boardYmd;
  const sailTm = toHm(rawField(item, ['sail_tm', 'sailTm']));
  if (!sailTm) return null;

  const fromJeju = isJejuPlace(origin);
  const toJeju = isJejuPlace(destination);

  if (direction === 'departure') {
    if (!fromJeju || ymd !== boardYmd) return null;
  } else if (!toJeju) {
    return null;
  }

  const routeCode = first(item, ['nvg_seawy_cd', 'nvgSeawyCd']);
  const licenseCode = first(item, ['lcns_seawy_cd', 'lcnsSeawyCd']);
  const drc = first(item, ['nvg_drc_cd', 'nvgDrcCd']);
  const routeName =
    first(item, ['nvg_seawy_nm', 'nvgSeawyNm']) ||
    first(item, ['lcns_seawy_nm', 'lcnsSeawyNm']) ||
    (origin && destination ? `${origin}-${destination}` : origin || destination);

  const duration = pickDuration(durations.get(durationKey(licenseCode, routeCode)), drc);
  const scheduledTime =
    direction === 'arrival'
      ? arrivalClock(ymd, sailTm, duration, boardYmd)
      : sailTm;
  if (!scheduledTime) return null;

  // Overnight: keep only arrivals that land on the board day.
  if (direction === 'arrival' && !landsOnBoardDay(ymd, sailTm, duration, boardYmd)) {
    return null;
  }

  const counterpart = direction === 'departure' ? destination : origin;
  const port = classifyPort(counterpart, routeName);
  const place = port === '연안항' ? '연안터미널' : '국제터미널';
  const { status, note } = mapStatus(item);
  const id = [
    direction,
    shipName,
    ymd,
    sailTm,
    origin,
    destination,
  ].join('-');

  return {
    id,
    scheduledTime,
    duration: duration || '--:--',
    shipName,
    route: routeName,
    place,
    port,
    status,
    note,
  };
}

function durationKey(licenseCode: string, routeCode: string): string {
  return `${licenseCode}|${routeCode}`;
}

function pickDuration(
  entry: RouteDuration | undefined,
  drc: string,
): string {
  if (!entry) return '';
  // 1 = 정방향, 2 = 역방향
  if (drc === '2') return entry.reverse || entry.forward;
  return entry.forward || entry.reverse;
}

/** KOMSA `fwd_nvg_req_hr` is total minutes as a digit string (e.g. "286" → 04:46). */
function minutesToHm(raw: string): string {
  if (!raw || !raw.trim()) return '';
  const trimmed = raw.trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [h = '0', m = '00'] = trimmed.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  const mins = Number(trimmed.replace(/\D/g, ''));
  if (!Number.isFinite(mins) || mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function arrivalClock(
  sailYmd: string,
  sailTm: string,
  duration: string,
  boardYmd: string,
): string | null {
  if (!duration) {
    // No duration: only show same-day sailings as a last resort (origin dep time).
    return sailYmd === boardYmd ? sailTm : null;
  }
  const land = addDurationToDate(sailYmd, sailTm, duration);
  if (!land) return sailYmd === boardYmd ? sailTm : null;
  return land.ymd === boardYmd ? land.hm : null;
}

function landsOnBoardDay(
  sailYmd: string,
  sailTm: string,
  duration: string,
  boardYmd: string,
): boolean {
  if (!duration) return sailYmd === boardYmd;
  const land = addDurationToDate(sailYmd, sailTm, duration);
  return land?.ymd === boardYmd;
}

function addDurationToDate(
  ymd: string,
  hm: string,
  duration: string,
): { ymd: string; hm: string } | null {
  if (!/^\d{8}$/.test(ymd)) return null;
  const start = timeToMin(hm);
  const dur = timeToMin(normalizeDuration(duration));
  if (!Number.isFinite(start) || !Number.isFinite(dur) || dur < 0) return null;

  const total = start + dur;
  const dayOffset = Math.floor(total / (24 * 60));
  const mins = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');

  const base = Date.UTC(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(4, 6)) - 1,
    Number(ymd.slice(6, 8)),
  );
  const landed = new Date(base + dayOffset * 86_400_000);
  const ly = landed.getUTCFullYear();
  const lm = String(landed.getUTCMonth() + 1).padStart(2, '0');
  const ld = String(landed.getUTCDate()).padStart(2, '0');
  return { ymd: `${ly}${lm}${ld}`, hm: `${hh}:${mm}` };
}

/**
 * KOMSA 운항구분 → board 현황. Prefer 운항구분 over 운항상태
 * (출항전/운항중/완료) because the kiosk board wants 정상운항·지연·결항.
 */
function mapStatus(item: Record<string, unknown>): { status?: string; note?: string } {
  const seCd = first(item, ['nvg_se_cd', 'nvgSeCd']);
  const seNm = first(item, ['nvg_se_nm', 'nvgSeNm']);
  const control = first(item, ['cntrl_rsn_nm', 'cntrlRsnNm']);
  const nonNav = first(item, ['nnavi_rsn_nm', 'nnaviRsnNm']);
  const etc = first(item, ['cnls_etc_rsn', 'cnlsEtcRsn']);
  const note = etc || control || nonNav || undefined;

  switch (seCd) {
    case '1':
    case '2':
    case '3':
      return { status: '정상운항' };
    case '6':
      return { status: '지연', note };
    case '4':
    case '5':
      return { status: '결항', note };
    default:
      break;
  }

  if (!seNm) return {};
  const key = seNm.replace(/\s+/g, '');
  if (key.includes('지연') || key.includes('대기')) return { status: '지연', note };
  if (key.includes('통제') || key.includes('비운항') || key.includes('결항')) {
    return { status: '결항', note };
  }
  if (key.includes('정상') || key.includes('증선') || key.includes('증회')) {
    return { status: '정상운항' };
  }
  return { status: seNm, note };
}

function classifyPort(counterpart: string, route: string): string {
  const blob = `${counterpart} ${route}`.replace(/\s+/g, '');
  if (blob.includes('국제') || blob.includes('7부두')) return '국제항';
  if (blob.includes('연안') || blob.includes('2부두')) return '연안항';

  for (const name of INTERNATIONAL_COUNTERPARTS) {
    if (blob.includes(name)) return '국제항';
  }
  for (const name of COASTAL_COUNTERPARTS) {
    if (blob.includes(name)) return '연안항';
  }
  // Default to the international terminal — this kiosk stands there.
  return '국제항';
}

function isJejuPlace(name: string): boolean {
  const compact = name.replace(/\s+/g, '');
  return compact.includes('제주');
}

function seoulYmd(): string {
  return seoulYmdOffset(0);
}

/** Seoul calendar date as `YYYYMMDD`, shifted by whole days. */
function seoulYmdOffset(dayOffset: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const grab = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? NaN);
  const y = grab('year');
  const m = grab('month');
  const d = grab('day');
  const utc = new Date(Date.UTC(y, m - 1, d + dayOffset));
  const ly = utc.getUTCFullYear();
  const lm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const ld = String(utc.getUTCDate()).padStart(2, '0');
  return `${ly}${lm}${ld}`;
}

function dedupeAndSort(rows: RawJejuSailing[]): RawJejuSailing[] {
  const seen = new Set<string>();
  const out: RawJejuSailing[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  out.sort((a, b) =>
    a.scheduledTime === b.scheduledTime
      ? a.shipName.localeCompare(b.shipName)
      : a.scheduledTime.localeCompare(b.scheduledTime),
  );
  return out;
}

function rawField(item: Record<string, unknown>, keys: string[]): string {
  return first(item, keys);
}

function first(obj: Record<string, unknown>, keys: string[]): string {
  const lower = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) lower.set(k.toLowerCase(), v);
  for (const key of keys) {
    const v = lower.get(key.toLowerCase());
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function normalizeDuration(raw: string): string {
  return minutesToHm(raw);
}

function timeToMin(hhmm: string): number {
  const parts = hhmm.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

function toHm(raw: string): string {
  if (!raw) return '';
  if (/^\d{1,2}:\d{2}$/.test(raw.trim())) {
    const [h = '0', m = '00'] = raw.trim().split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 12) {
    return `${digits.slice(-4, -2)}:${digits.slice(-2)}`;
  }
  if (digits.length === 4) {
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }
  if (digits.length === 3) {
    return `0${digits.slice(0, 1)}:${digits.slice(1)}`;
  }
  return '';
}

async function readKomsaJson(res: Response): Promise<KomsaResponse> {
  const text = await res.text();
  try {
    return JSON.parse(text) as KomsaResponse;
  } catch {
    throw new Error(`HTTP ${res.status} (not JSON)`);
  }
}

function unwrapItems(items: unknown): Record<string, unknown>[] {
  if (items == null) return [];
  if (Array.isArray(items)) return items.filter(isRecord);
  if (!isRecord(items)) return [];
  const inner = items['item'];
  if (inner == null) return [items];
  if (Array.isArray(inner)) return inner.filter(isRecord);
  if (isRecord(inner)) return [inner];
  return [];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
