import type {
  JejuFlightSnapshot,
  RawJejuArrival,
  RawJejuDeparture,
} from '@shared/types/jejuFlight';
import { createLogger } from '@main/core/logger';
import type { KioskService } from './KioskService';
import type { LocalCacheService } from './LocalCacheService';

const log = createLogger('flight-service');

/** 2 min — see the 5,000/day quota discussion; two calls per cycle. */
const REFRESH_MS = 2 * 60 * 1000;
const CACHE_KEY = 'jeju-flights';
const AIRPORT_KIOSK = 'W006';
const AIRPORT_CODE = 'CJU';
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

/** 15158625 GW: 출발 오퍼레이션은 루트(`/flight-status`)가 아니라 `/depart`. */
const DEP_URL = 'https://apis.data.go.kr/B551178/flight-status/depart';
const ARR_URL = 'https://apis.data.go.kr/B551178/flight-status/arrival';
/** 15158946 GW: 제주 주기장 — `gate` / `baggageClaim` (탑승구·수하물수취대). */
const APRON_URL = 'https://apis.data.go.kr/B551178/flight-apron-status/cju';
/** Apron paginates ~24 pages/day; refresh less often than the status feed. */
const APRON_REFRESH_MS = 10 * 60 * 1000;
const MAX_APRON_PAGES = 15;

interface ApronMaps {
  ymd: string;
  fetchedAt: number;
  gates: Map<string, string>;
  belts: Map<string, string>;
}

type FlightListener = (snapshot: JejuFlightSnapshot) => void;

interface PortalBody {
  items?: unknown;
  numOfRows?: number | string;
  pageNo?: number | string;
  totalCount?: number | string;
}

interface PortalResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: PortalBody;
  };
}

/**
 * Fetches 제주 (CJU) departures + arrivals from KAC's real-time board API,
 * caches them, and refreshes every two minutes. Network stays in main; the
 * renderer only reads the snapshot over IPC. Gated to W006 (제주공항) so the
 * passenger terminal kiosk does not spend the shared 5,000/day quota.
 */
export class FlightService {
  private current: JejuFlightSnapshot | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cacheHydrated = false;
  private warnedNoKey = false;
  private apronMaps: ApronMaps | null = null;
  private readonly listeners = new Set<FlightListener>();

  constructor(
    private readonly cache: LocalCacheService,
    private readonly kiosk: KioskService,
  ) {}

  /**
   * Starts the polling loop. Each tick checks the *current* kiosk layout so a
   * dev-mode switch to W006 can begin fetching without restarting main.
   */
  start(): void {
    if (!this.timer) {
      this.timer = setInterval(() => void this.tick(), REFRESH_MS);
    }
    void this.tick();
  }

  /** Dev kiosk switch: fetch now so the reloaded renderer's first `get()` hits data. */
  async refreshIfJeju(): Promise<void> {
    if (this.kiosk.getConfig().kioskId !== AIRPORT_KIOSK) return;
    this.hydrateFromCacheOnce();
    await this.refresh();
  }

  private async tick(): Promise<void> {
    if (this.kiosk.getConfig().kioskId !== AIRPORT_KIOSK) return;
    this.hydrateFromCacheOnce();
    await this.refresh();
  }

  private hydrateFromCacheOnce(): void {
    if (this.cacheHydrated) return;
    this.cacheHydrated = true;

    const cached = this.cache.get(CACHE_KEY);
    const data = cached?.data as Partial<JejuFlightSnapshot> | undefined;
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

  getCurrent(): JejuFlightSnapshot | null {
    return this.current;
  }

  subscribe(listener: FlightListener): () => void {
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
    const serviceKey = process.env['DATA_GO_KR_SERVICE_KEY'];
    if (!serviceKey) {
      if (!this.warnedNoKey) {
        log.warn('DATA_GO_KR_SERVICE_KEY not set; 제주 운항정보 disabled. See .env.example');
        this.warnedNoKey = true;
      }
      return;
    }

    const { ymd, fromHm, toHm } = seoulWindow();

    try {
      const apronPromise = this.ensureApronMaps(serviceKey, ymd);
      const [depResult, arrResult] = await Promise.allSettled([
        this.fetchList(DEP_URL, serviceKey, ymd, fromHm, toHm, mapDeparture),
        this.fetchList(ARR_URL, serviceKey, ymd, fromHm, toHm, mapArrival),
        apronPromise,
      ]);
      if (depResult.status === 'rejected') {
        log.warn('Jeju departures fetch failed', depResult.reason);
      }
      if (arrResult.status === 'rejected') {
        log.warn('Jeju arrivals fetch failed', arrResult.reason);
      }
      let departures =
        depResult.status === 'fulfilled'
          ? depResult.value
          : (this.current?.departures ?? []);
      let arrivals =
        arrResult.status === 'fulfilled'
          ? arrResult.value
          : (this.current?.arrivals ?? []);
      if (depResult.status === 'rejected' && arrResult.status === 'rejected') {
        throw depResult.reason;
      }
      if (this.apronMaps?.ymd === ymd) {
        departures = mergeGate(departures, this.apronMaps.gates);
        arrivals = mergeBelt(arrivals, this.apronMaps.belts);
      } else if (!this.apronMaps) {
        log.warn('Jeju apron index missing — gates/belts will be empty until apron fetch succeeds');
      }
      const snapshot: JejuFlightSnapshot = {
        fetchedAt: new Date().toISOString(),
        departures,
        arrivals,
      };
      this.current = snapshot;
      this.cache.upsert(CACHE_KEY, snapshot as unknown as Record<string, unknown>, 'kac-flights');
      this.emit();
      const withGate = departures.filter((d) => d.gate).length;
      const withBelt = arrivals.filter((a) => a.belt).length;
      log.info('Jeju flights updated', {
        departures: departures.length,
        arrivals: arrivals.length,
        apronGates: this.apronMaps?.gates.size ?? 0,
        apronBelts: this.apronMaps?.belts.size ?? 0,
        matchedGates: withGate,
        matchedBelts: withBelt,
      });
    } catch (error) {
      log.warn('Jeju flight fetch failed (keeping last snapshot)', error);
    }
  }

  private async fetchList<T extends { id: string; scheduledTime: string; flightNo: string }>(
    base: string,
    serviceKey: string,
    searchday: string,
    fromTime: string,
    toTime: string,
    mapItem: (item: Record<string, unknown>) => T | null,
  ): Promise<T[]> {
    const rows: T[] = [];
    let pageNo = 1;
    let total = Infinity;

    while (pageNo <= MAX_PAGES && (pageNo - 1) * PAGE_SIZE < total) {
      const body = await this.fetchPage(base, serviceKey, {
        searchday,
        from_time: fromTime,
        to_time: toTime,
        pageNo: String(pageNo),
      });
      const items = unwrapItems(body.items);
      total = Number(body.totalCount ?? items.length);
      if (!Number.isFinite(total)) total = items.length;

      for (const item of items) {
        const mapped = mapItem(item);
        if (mapped) rows.push(mapped);
      }
      if (items.length > 0 && rows.length === 0) {
        log.warn('KAC flight items did not map — check field names', {
          sampleKeys: Object.keys(items[0] ?? {}),
        });
      }

      if (items.length === 0) break;
      pageNo += 1;
    }

    // KAC sometimes repeats the same fid+편명+시각 (pagination / codeshare).
    // Drop duplicates so React list keys stay unique and the board shows one row.
    const unique = dedupeById(rows);
    unique.sort((a, b) =>
      a.scheduledTime === b.scheduledTime
        ? a.flightNo.localeCompare(b.flightNo)
        : a.scheduledTime.localeCompare(b.scheduledTime),
    );
    return unique;
  }

  private async fetchPage(
    base: string,
    serviceKey: string,
    extra: Record<string, string>,
  ): Promise<PortalBody> {
    const qs = new URLSearchParams({
      pageNo: extra['pageNo'] ?? '1',
      numOfRows: String(PAGE_SIZE),
      airport_code: AIRPORT_CODE,
      searchday: extra['searchday'] ?? '',
      from_time: extra['from_time'] ?? '',
      to_time: extra['to_time'] ?? '',
      type: 'json',
    });
    // Portal keys are often already percent-encoded; URLSearchParams would
    // double-encode them and the gateway returns "SERVICE KEY IS NOT REGISTERED".
    const url = `${base}?serviceKey=${serviceKey}&${qs.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const json = await readPortalJson(res);
    const header = json.response?.header;
    const code = String(header?.resultCode ?? '');
    if (code && code !== '00' && code !== '0000') {
      throw new Error(`KAC ${code}: ${header?.resultMsg ?? ''}`);
    }
    if (!json.response?.body && !res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return json.response?.body ?? {};
  }

  /** Paginate 제주 주기장 (I/O 각각) and index gate/belt by 편명+시각. */
  private async ensureApronMaps(serviceKey: string, ymd: string): Promise<void> {
    const now = Date.now();
    if (
      this.apronMaps &&
      this.apronMaps.ymd === ymd &&
      now - this.apronMaps.fetchedAt < APRON_REFRESH_MS
    ) {
      return;
    }

    try {
      const gates = new Map<string, string>();
      const belts = new Map<string, string>();

      for (const io of ['I', 'O'] as const) {
        let pageNo = 1;
        let total = Infinity;
        while (pageNo <= MAX_APRON_PAGES && (pageNo - 1) * PAGE_SIZE < total) {
          const body = await this.fetchApronPage(serviceKey, ymd, pageNo, io);
          const items = unwrapItems(body.items);
          total = Number(body.totalCount ?? items.length);
          if (!Number.isFinite(total)) total = items.length;

          for (const item of items) {
            indexApronItem(item, gates, belts);
          }

          if (items.length === 0) break;
          pageNo += 1;
        }
      }

      this.apronMaps = { ymd, fetchedAt: now, gates, belts };
      log.info('Jeju apron indexed', { gates: gates.size, belts: belts.size });
    } catch (error) {
      log.warn('Jeju apron fetch failed (keeping last gate index)', error);
    }
  }

  private async fetchApronPage(
    serviceKey: string,
    flightdate: string,
    pageNo: number,
    io: 'I' | 'O',
  ): Promise<PortalBody> {
    const qs = new URLSearchParams({
      pageNo: String(pageNo),
      numOfRows: String(PAGE_SIZE),
      flightdate,
      io,
      type: 'json',
    });
    const url = `${APRON_URL}?serviceKey=${serviceKey}&${qs.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const json = await readPortalJson(res);
    const header = json.response?.header;
    const code = String(header?.resultCode ?? '');
    if (code && code !== '00' && code !== '0000') {
      throw new Error(`KAC apron ${code}: ${header?.resultMsg ?? ''}`);
    }
    if (!json.response?.body && !res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return json.response?.body ?? {};
  }
}

/** 오늘(서울) 기준, 예정시각 from_time ~ 23:59 — 지난 편은 30분 버퍼로 제외. */
function seoulWindow(): { ymd: string; fromHm: string; toHm: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const grab = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const ymd = `${grab('year')}${grab('month')}${grab('day')}`;
  const hour = Number(grab('hour'));
  const minute = Number(grab('minute'));
  const fromMin = Math.max(0, hour * 60 + minute - 30);
  const fromH = String(Math.floor(fromMin / 60)).padStart(2, '0');
  const fromM = String(fromMin % 60).padStart(2, '0');
  return { ymd, fromHm: `${fromH}${fromM}`, toHm: '2359' };
}

async function readPortalJson(res: Response): Promise<PortalResponse> {
  const text = await res.text();
  try {
    return JSON.parse(text) as PortalResponse;
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

function first(obj: Record<string, unknown>, keys: string[]): string {
  const lower = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) lower.set(k.toLowerCase(), v);
  for (const key of keys) {
    const v = lower.get(key.toLowerCase());
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function toHm(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 12) {
    return `${digits.slice(-4, -2)}:${digits.slice(-2)}`;
  }
  if (digits.length === 4) {
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }
  return '';
}

function mapKind(raw: string): string | undefined {
  if (!raw) return undefined;
  const k = raw.replace(/\s+/g, '').toUpperCase();
  if (k === 'I' || k.includes('국제')) return '국제선';
  if (k === 'D' || k.includes('국내')) return '국내선';
  return raw;
}

function mapBase(item: Record<string, unknown>): {
  id: string;
  flightNo: string;
  scheduledTime: string;
  estimatedTime?: string;
  airline: string;
  kind?: string;
  status?: string;
} | null {
  const flightNo = first(item, [
    'flight_id', 'flightid', 'flightId', 'airFln', 'airfln', 'flightNo',
  ]);
  if (!flightNo) return null;
  const scheduledTime = toHm(
    first(item, [
      'scheduledatetime', 'scheduleDateTime', 'std', 'sta', 'scheduletime',
    ]),
  );
  if (!scheduledTime) return null;
  const estimatedRaw = toHm(
    first(item, ['estimateddatetime', 'estimatedDateTime', 'etd', 'eta', 'chgTime']),
  );
  const estimatedTime =
    estimatedRaw && estimatedRaw !== scheduledTime ? estimatedRaw : undefined;
  const fid = first(item, ['fid', 'f_id', 'fId']);
  const status = first(item, ['rmkKor', 'rmkkor']);
  return {
    id: `${fid || flightNo}-${flightNo}-${scheduledTime}`,
    flightNo,
    scheduledTime,
    estimatedTime,
    airline: first(item, ['airlineKorean', 'airline', 'airlineEnglish', 'airlineEng']),
    kind: mapKind(first(item, ['line'])),
    status: status || undefined,
  };
}

/** Keep first row per `id` (fid + flightNo + scheduledTime). */
function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function mapDeparture(item: Record<string, unknown>): RawJejuDeparture | null {
  const base = mapBase(item);
  if (!base) return null;
  const master = normalizeFlightNo(
    first(item, ['masterflightid', 'masterFlightId', 'masterflight']),
  );
  const masterFlightNo =
    master && master !== normalizeFlightNo(base.flightNo) ? master : undefined;
  return {
    ...base,
    destination: first(item, ['arr_airport', 'arrAirport', 'arrvairport', 'arrvAirport']),
    gate: first(item, ['gate', 'gatenumber']),
    masterFlightNo,
  };
}

function mapArrival(item: Record<string, unknown>): RawJejuArrival | null {
  const base = mapBase(item);
  if (!base) return null;
  const master = normalizeFlightNo(
    first(item, ['masterflightid', 'masterFlightId', 'masterflight']),
  );
  const masterFlightNo =
    master && master !== normalizeFlightNo(base.flightNo) ? master : undefined;
  return {
    ...base,
    origin: first(item, ['dep_airport', 'depAirport', 'depairport']),
    belt: first(item, ['baggageClaim', 'carousel', 'chkinrange', 'baggageclaim']),
    masterFlightNo,
  };
}

function normalizeFlightNo(flightNo: string): string {
  return flightNo.replace(/\s+/g, '').toUpperCase();
}

/** Join key shared by flight-status rows and apron rows. */
function flightRowKey(flightNo: string, scheduledTime: string): string {
  return `${normalizeFlightNo(flightNo)}-${scheduledTime}`;
}

function stdToHm(std: string): string {
  const digits = std.replace(/\D/g, '');
  if (digits.length >= 4) {
    const hm = digits.slice(-4);
    return `${hm.slice(0, 2)}:${hm.slice(2)}`;
  }
  return '';
}

function isJeju(label: string): boolean {
  return label.replace(/\s+/g, '').includes('제주');
}

/** Keep a non-empty value; apron often emits a blank row and a filled row for the same flight. */
function preferFilled(map: Map<string, string>, key: string, value: string): void {
  if (!value) return;
  if (!map.has(key)) map.set(key, value);
}

/** Index one apron record into gate/belt maps when it belongs to CJU depart/arrive. */
function indexApronItem(
  item: Record<string, unknown>,
  gates: Map<string, string>,
  belts: Map<string, string>,
): void {
  const flightNo = first(item, ['airfln', 'airFln', 'flight_id', 'flightid']);
  const scheduledTime = stdToHm(first(item, ['std', 'scheduledatetime']));
  if (!flightNo || !scheduledTime) return;

  const key = flightRowKey(flightNo, scheduledTime);
  const boarding = first(item, ['boardingkor', 'boardingKor']);
  const arrived = first(item, ['arrivedkor', 'arrivedKor']);
  const gate = first(item, ['gate', 'gatenumber']);
  const belt = first(item, ['baggageclaim', 'baggageClaim', 'carousel']);

  // /cju apron also lists other airports' legs; only keep Jeju-boarding departures
  // and Jeju-arriving belts. Empty boarding/arrived is ignored (ambiguous).
  if (gate && isJeju(boarding)) preferFilled(gates, key, gate);
  if (belt && isJeju(arrived)) preferFilled(belts, key, belt);
}

function lookupStand(
  map: Map<string, string>,
  flightNo: string,
  scheduledTime: string,
  masterFlightNo?: string,
): string {
  const direct = map.get(flightRowKey(flightNo, scheduledTime));
  if (direct) return direct;
  if (masterFlightNo) {
    const viaMaster = map.get(flightRowKey(masterFlightNo, scheduledTime));
    if (viaMaster) return viaMaster;
  }
  return '';
}

function mergeGate(departures: RawJejuDeparture[], gates: Map<string, string>): RawJejuDeparture[] {
  return departures.map((row) => {
    if (row.gate) return row;
    const gate = lookupStand(gates, row.flightNo, row.scheduledTime, row.masterFlightNo);
    return gate ? { ...row, gate } : row;
  });
}

function mergeBelt(arrivals: RawJejuArrival[], belts: Map<string, string>): RawJejuArrival[] {
  return arrivals.map((row) => {
    if (row.belt) return row;
    const belt = lookupStand(belts, row.flightNo, row.scheduledTime, row.masterFlightNo);
    return belt ? { ...row, belt } : row;
  });
}
