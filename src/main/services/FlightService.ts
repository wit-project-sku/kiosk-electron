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
/**
 * Same GW as depart/arrival — `/info` carries `gate` (incl. KE). `/depart` does not.
 * Queried with schAirCode=CJU × schIOType × schLineType.
 */
const INFO_URL = 'https://apis.data.go.kr/B551178/flight-status/info';
/**
 * Same GW — `/detail` carries `BAGGAGE_CLAIM` (incl. KE). Nationwide feed; we
 * keep only AIRPORT=CJU and cache like the apron (no airport filter on the API).
 */
const DETAIL_URL = 'https://apis.data.go.kr/B551178/flight-status/detail';
/** 15158946 GW: 제주 주기장 — `gate` / `baggageClaim` (탑승구·수하물수취대). */
const APRON_URL = 'https://apis.data.go.kr/B551178/flight-apron-status/cju';
/** Apron paginates ~24 pages/day; refresh less often than the status feed. */
const APRON_REFRESH_MS = 10 * 60 * 1000;
/** Cover a full day (~24×100) with a little headroom for peak days. */
const MAX_APRON_PAGES = 30;
/** `/info` is small (~3 pages/combo); refresh with the board, not the slow apron. */
const INFO_REFRESH_MS = REFRESH_MS;
const MAX_INFO_PAGES = 5;
/** `/detail` is ~50×100 nationwide; refresh with the apron cadence. */
const DETAIL_REFRESH_MS = APRON_REFRESH_MS;
const MAX_DETAIL_PAGES = 55;

interface StandMaps {
  ymd: string;
  fetchedAt: number;
  /** Primary index: `편명-HH:mm` → gate / belt. */
  gates: Map<string, string>;
  belts: Map<string, string>;
  /**
   * Flight-number-only fallback when the time key misses. Only kept when a
   * 편명 maps to a single stand value that day (codeshare / time-skew cases).
   */
  gatesByFlight: Map<string, string>;
  beltsByFlight: Map<string, string>;
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
  private apronMaps: StandMaps | null = null;
  /** `/info` gate index — fills KE (and others) that the apron feed omits. */
  private infoMaps: StandMaps | null = null;
  /** `/detail` belt index — fills KE (and others) that the apron feed omits. */
  private detailMaps: StandMaps | null = null;
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
      const infoPromise = this.ensureInfoMaps(serviceKey, ymd);
      const detailPromise = this.ensureDetailMaps(serviceKey, ymd);
      const apronPromise = this.ensureApronMaps(serviceKey, ymd);
      const [depResult, arrResult] = await Promise.allSettled([
        this.fetchList(DEP_URL, serviceKey, ymd, fromHm, toHm, mapDeparture),
        this.fetchList(ARR_URL, serviceKey, ymd, fromHm, toHm, mapArrival),
        infoPromise,
        detailPromise,
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
      // `/info` first — it carries KE gates the apron feed mostly lacks.
      if (this.infoMaps?.ymd === ymd) {
        departures = mergeGate(departures, this.infoMaps.gates, this.infoMaps.gatesByFlight);
      } else if (!this.infoMaps) {
        log.warn('Jeju /info gate index missing — KE gates may stay empty');
      }

      // `/detail` first for belts — same KE gap as gates had on the apron feed.
      if (this.detailMaps?.ymd === ymd) {
        arrivals = mergeBelt(arrivals, this.detailMaps.belts, this.detailMaps.beltsByFlight);
      } else if (!this.detailMaps) {
        log.warn('Jeju /detail belt index missing — KE belts may stay empty');
      }

      if (this.apronMaps?.ymd === ymd) {
        departures = mergeGate(departures, this.apronMaps.gates, this.apronMaps.gatesByFlight);
        arrivals = mergeBelt(arrivals, this.apronMaps.belts, this.apronMaps.beltsByFlight);
      } else if (!this.apronMaps) {
        log.warn('Jeju apron index missing — remaining stands wait on apron fetch');
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
        infoGates: this.infoMaps?.gates.size ?? 0,
        detailBelts: this.detailMaps?.belts.size ?? 0,
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

    // What KAC actually returned, at two levels of detail.
    //
    // The summary is `info` so it survives into the packaged kiosk's log file
    // (file level is `info` there) — enough to tell "the feed is answering and
    // returning 43 rows" from "the feed is answering with nothing", which is
    // the question worth asking remotely.
    //
    // The whole body is `debug`, which the console prints in dev and the
    // packaged build drops. 100 rows every two minutes would otherwise churn
    // through the 10MB file rotation for data nobody is reading.
    //
    // Note `base` and `qs`, never `url` — that one carries the service key.
    const items = json.response?.body?.items;
    log.info('KAC flight response', {
      endpoint: base,
      query: Object.fromEntries(qs),
      httpStatus: res.status,
      resultCode: code || '(none)',
      resultMsg: header?.resultMsg ?? '',
      totalCount: json.response?.body?.totalCount ?? '(none)',
      itemCount: Array.isArray(items) ? items.length : items ? 1 : 0,
    });
    log.debug('KAC flight response body', json.response?.body);

    if (code && code !== '00' && code !== '0000') {
      throw new Error(`KAC ${code}: ${header?.resultMsg ?? ''}`);
    }
    if (!json.response?.body && !res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return json.response?.body ?? {};
  }

  /** Paginate `/flight-status/info` (CJU × O/I × D/I) into a gate index. */
  private async ensureInfoMaps(serviceKey: string, ymd: string): Promise<void> {
    const now = Date.now();
    if (
      this.infoMaps &&
      this.infoMaps.ymd === ymd &&
      now - this.infoMaps.fetchedAt < INFO_REFRESH_MS
    ) {
      return;
    }

    try {
      const gates = new Map<string, string>();
      const gatesByFlight = new Map<string, string>();
      const ambiguousGates = new Set<string>();

      for (const io of ['O', 'I'] as const) {
        for (const line of ['D', 'I'] as const) {
          let pageNo = 1;
          let total = Infinity;
          while (pageNo <= MAX_INFO_PAGES && (pageNo - 1) * PAGE_SIZE < total) {
            const body = await this.fetchInfoPage(serviceKey, pageNo, io, line);
            const items = unwrapItems(body.items);
            total = Number(body.totalCount ?? items.length);
            if (!Number.isFinite(total)) total = items.length;

            for (const item of items) {
              indexInfoItem(item, io, gates, gatesByFlight, ambiguousGates);
            }

            if (items.length === 0) break;
            pageNo += 1;
          }
        }
      }

      this.infoMaps = {
        ymd,
        fetchedAt: now,
        gates,
        belts: new Map(),
        gatesByFlight,
        beltsByFlight: new Map(),
      };
      log.info('Jeju /info gates indexed', {
        gates: gates.size,
        gatesByFlight: gatesByFlight.size,
      });
    } catch (error) {
      log.warn('Jeju /info gate fetch failed (keeping last index)', error);
    }
  }

  private async fetchInfoPage(
    serviceKey: string,
    pageNo: number,
    io: 'I' | 'O',
    line: 'D' | 'I',
  ): Promise<PortalBody> {
    const qs = new URLSearchParams({
      pageNo: String(pageNo),
      numOfRows: String(PAGE_SIZE),
      schAirCode: AIRPORT_CODE,
      schIOType: io,
      schLineType: line,
      schStTime: '0000',
      schEdTime: '2359',
      type: 'json',
    });
    const url = `${INFO_URL}?serviceKey=${serviceKey}&${qs.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const json = await readPortalJson(res);
    const header = json.response?.header;
    const code = String(header?.resultCode ?? '');
    if (code && code !== '00' && code !== '0000') {
      throw new Error(`KAC info ${code}: ${header?.resultMsg ?? ''}`);
    }
    if (!json.response?.body && !res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return json.response?.body ?? {};
  }

  /**
   * Paginate `/flight-status/detail` nationwide and index CJU arrival belts.
   * No airport filter on the API — client-side AIRPORT=CJU only.
   */
  private async ensureDetailMaps(serviceKey: string, ymd: string): Promise<void> {
    const now = Date.now();
    if (
      this.detailMaps &&
      this.detailMaps.ymd === ymd &&
      now - this.detailMaps.fetchedAt < DETAIL_REFRESH_MS
    ) {
      return;
    }

    try {
      const belts = new Map<string, string>();
      const beltsByFlight = new Map<string, string>();
      const ambiguousBelts = new Set<string>();
      let pageNo = 1;
      let total = Infinity;
      let cjuRows = 0;

      while (pageNo <= MAX_DETAIL_PAGES && (pageNo - 1) * PAGE_SIZE < total) {
        const body = await this.fetchDetailPage(serviceKey, pageNo);
        const items = unwrapItems(body.items);
        total = Number(body.totalCount ?? items.length);
        if (!Number.isFinite(total)) total = items.length;

        for (const item of items) {
          if (indexDetailBeltItem(item, belts, beltsByFlight, ambiguousBelts)) {
            cjuRows += 1;
          }
        }

        if (items.length === 0) break;
        pageNo += 1;
      }

      this.detailMaps = {
        ymd,
        fetchedAt: now,
        gates: new Map(),
        belts,
        gatesByFlight: new Map(),
        beltsByFlight,
      };
      log.info('Jeju /detail belts indexed', {
        pages: pageNo - 1,
        cjuInboundRows: cjuRows,
        belts: belts.size,
        beltsByFlight: beltsByFlight.size,
      });
    } catch (error) {
      log.warn('Jeju /detail belt fetch failed (keeping last index)', error);
    }
  }

  private async fetchDetailPage(serviceKey: string, pageNo: number): Promise<PortalBody> {
    const qs = new URLSearchParams({
      pageNo: String(pageNo),
      numOfRows: String(PAGE_SIZE),
      type: 'json',
    });
    const url = `${DETAIL_URL}?serviceKey=${serviceKey}&${qs.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const json = await readPortalJson(res);
    const header = json.response?.header;
    const code = String(header?.resultCode ?? '');
    if (code && code !== '00' && code !== '0000') {
      throw new Error(`KAC detail ${code}: ${header?.resultMsg ?? ''}`);
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
      const gatesByFlight = new Map<string, string>();
      const beltsByFlight = new Map<string, string>();
      const ambiguousGates = new Set<string>();
      const ambiguousBelts = new Set<string>();

      for (const io of ['I', 'O'] as const) {
        let pageNo = 1;
        let total = Infinity;
        while (pageNo <= MAX_APRON_PAGES && (pageNo - 1) * PAGE_SIZE < total) {
          const body = await this.fetchApronPage(serviceKey, ymd, pageNo, io);
          const items = unwrapItems(body.items);
          total = Number(body.totalCount ?? items.length);
          if (!Number.isFinite(total)) total = items.length;

          for (const item of items) {
            indexApronItem(item, io, gates, belts, gatesByFlight, beltsByFlight, ambiguousGates, ambiguousBelts);
          }

          if (items.length === 0) break;
          pageNo += 1;
        }
      }

      this.apronMaps = { ymd, fetchedAt: now, gates, belts, gatesByFlight, beltsByFlight };
      log.info('Jeju apron indexed', {
        gates: gates.size,
        belts: belts.size,
        gatesByFlight: gatesByFlight.size,
        beltsByFlight: beltsByFlight.size,
      });
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

function flightDigits(flightNo: string): string {
  return normalizeFlightNo(flightNo).replace(/\D/g, '');
}

function apronFlightNo(key: string): string {
  const i = key.lastIndexOf('-');
  return i >= 0 ? key.slice(0, i) : key;
}

function apronFlightTime(key: string): string {
  const i = key.lastIndexOf('-');
  return i >= 0 ? key.slice(i + 1) : '';
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

/** Korean / English / IATA forms of Jeju used on apron rows. */
function isJejuAirport(kor: string, eng = ''): boolean {
  const k = kor.replace(/\s+/g, '');
  if (k.includes('제주')) return true;
  const e = eng.replace(/\s+/g, '').toUpperCase();
  return e.includes('JEJU') || e === 'CJU';
}

/**
 * Outbound (/cju `io=O`): keep when boarding is Jeju, or when boarding is blank
 * (feed often omits it for CJU departures). Inbound belts use the same rule on
 * arrivedKor / arrivedEng.
 */
function isJejuLeg(kor: string, eng: string, io: 'I' | 'O', expectIo: 'I' | 'O'): boolean {
  if (io !== expectIo) return false;
  if (isJejuAirport(kor, eng)) return true;
  return !kor.trim() && !eng.trim();
}

/** Keep a non-empty value; apron often emits a blank row and a filled row for the same flight. */
function preferFilled(map: Map<string, string>, key: string, value: string): void {
  if (!value) return;
  if (!map.has(key)) map.set(key, value);
}

/**
 * Flight-number-only index: keep the stand only while every row for that 편명
 * agrees. Conflicting gates/belts (same 편명, different stands) are dropped so
 * a wrong stand is never applied via the loose fallback.
 */
function preferFilledByFlight(
  map: Map<string, string>,
  ambiguous: Set<string>,
  flightNo: string,
  value: string,
): void {
  if (!value) return;
  const key = normalizeFlightNo(flightNo);
  if (!key || ambiguous.has(key)) return;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, value);
    return;
  }
  if (existing !== value) {
    map.delete(key);
    ambiguous.add(key);
  }
}

/** Index std + etd keys so a re-timed status row can still hit the apron stand. */
function indexStandKeys(
  map: Map<string, string>,
  byFlight: Map<string, string>,
  ambiguous: Set<string>,
  flightNo: string,
  scheduledTime: string,
  estimatedTime: string,
  value: string,
): void {
  preferFilled(map, flightRowKey(flightNo, scheduledTime), value);
  if (estimatedTime && estimatedTime !== scheduledTime) {
    preferFilled(map, flightRowKey(flightNo, estimatedTime), value);
  }
  preferFilledByFlight(byFlight, ambiguous, flightNo, value);
}

/** Index `/info` gate rows for Jeju departures (outbound only). */
function indexInfoItem(
  item: Record<string, unknown>,
  io: 'I' | 'O',
  gates: Map<string, string>,
  gatesByFlight: Map<string, string>,
  ambiguousGates: Set<string>,
): void {
  // Inbound `/info` also has a `gate` field, but the arrival board needs
  // baggage claim (apron), not the origin gate — skip I.
  if (io !== 'O') return;

  const flightNo = first(item, ['airfln', 'airFln', 'flight_id', 'flightid']);
  const scheduledTime = stdToHm(first(item, ['std', 'scheduledatetime']));
  if (!flightNo || !scheduledTime) return;

  const estimatedTime = stdToHm(first(item, ['etd', 'estimateddatetime', 'estimatedDateTime']));
  const boardingKor = first(item, ['boardingkor', 'boardingKor']);
  const boardingEng = first(item, ['boardingeng', 'boardingEng']);
  const gate = first(item, ['gate', 'gatenumber']);
  if (!gate) return;

  // schAirCode=CJU outbound is already Jeju-scoped; still require Jeju boarding
  // (or blank) so a stray non-Jeju leg cannot pollute the index.
  if (!isJejuLeg(boardingKor, boardingEng, io, 'O')) return;

  indexStandKeys(gates, gatesByFlight, ambiguousGates, flightNo, scheduledTime, estimatedTime, gate);
}

/**
 * Index one `/detail` row into the belt map when it is a CJU inbound with a
 * published baggage claim. Returns true when the row was a CJU inbound (belt
 * may still be empty — used only for fetch diagnostics).
 */
function indexDetailBeltItem(
  item: Record<string, unknown>,
  belts: Map<string, string>,
  beltsByFlight: Map<string, string>,
  ambiguousBelts: Set<string>,
): boolean {
  const airport = first(item, ['airport', 'AIRPORT']).toUpperCase();
  if (airport !== AIRPORT_CODE) return false;

  const io = first(item, ['io', 'IO']).toUpperCase();
  if (io !== 'I') return false;

  const arrivedKor = first(item, ['arrived_kor', 'ARRIVED_KOR', 'arrivedKor']);
  const arrivedEng = first(item, ['arrived_eng', 'ARRIVED_ENG', 'arrivedEng']);
  // Require Jeju arrival when the field is present; blank is rare on /detail.
  if (arrivedKor || arrivedEng) {
    if (!isJejuAirport(arrivedKor, arrivedEng)) return true;
  }

  const flightNo = first(item, ['air_fln', 'AIR_FLN', 'airFln', 'airfln']);
  const scheduledTime = stdToHm(first(item, ['std', 'STD', 'scheduledatetime']));
  if (!flightNo || !scheduledTime) return true;

  const estimatedTime = stdToHm(first(item, ['etd', 'ETD', 'estimateddatetime']));
  const belt = first(item, ['baggage_claim', 'BAGGAGE_CLAIM', 'baggageClaim', 'baggageclaim']);
  if (!belt) return true;

  indexStandKeys(belts, beltsByFlight, ambiguousBelts, flightNo, scheduledTime, estimatedTime, belt);
  return true;
}

/** Index one apron record into gate/belt maps when it belongs to CJU depart/arrive. */
function indexApronItem(
  item: Record<string, unknown>,
  io: 'I' | 'O',
  gates: Map<string, string>,
  belts: Map<string, string>,
  gatesByFlight: Map<string, string>,
  beltsByFlight: Map<string, string>,
  ambiguousGates: Set<string>,
  ambiguousBelts: Set<string>,
): void {
  const flightNo = first(item, ['airfln', 'airFln', 'flight_id', 'flightid']);
  const scheduledTime = stdToHm(first(item, ['std', 'scheduledatetime']));
  if (!flightNo || !scheduledTime) return;

  const estimatedTime = stdToHm(first(item, ['etd', 'estimateddatetime', 'estimatedDateTime']));
  const boardingKor = first(item, ['boardingkor', 'boardingKor']);
  const boardingEng = first(item, ['boardingeng', 'boardingEng']);
  const arrivedKor = first(item, ['arrivedkor', 'arrivedKor']);
  const arrivedEng = first(item, ['arrivedeng', 'arrivedEng']);
  const gate = first(item, ['gate', 'gatenumber']);
  const belt = first(item, ['baggageclaim', 'baggageClaim', 'carousel']);

  // /cju also lists other airports' legs — keep Jeju departures (gate) and
  // Jeju arrivals (belt). Blank kor/eng on the matching io is treated as Jeju.
  if (gate && isJejuLeg(boardingKor, boardingEng, io, 'O')) {
    indexStandKeys(gates, gatesByFlight, ambiguousGates, flightNo, scheduledTime, estimatedTime, gate);
  }
  if (belt && isJejuLeg(arrivedKor, arrivedEng, io, 'I')) {
    indexStandKeys(belts, beltsByFlight, ambiguousBelts, flightNo, scheduledTime, estimatedTime, belt);
  }
}

function lookupStand(
  map: Map<string, string>,
  byFlight: Map<string, string>,
  flightNo: string,
  scheduledTime: string,
  masterFlightNo?: string,
  estimatedTime?: string,
): string {
  const times = [scheduledTime, estimatedTime].filter(
    (t): t is string => !!t && t.length > 0,
  );
  // De-dupe while preserving order (scheduled first).
  const uniqueTimes = [...new Set(times)];

  for (const time of uniqueTimes) {
    const direct = map.get(flightRowKey(flightNo, time));
    if (direct) return direct;
    if (masterFlightNo) {
      const viaMaster = map.get(flightRowKey(masterFlightNo, time));
      if (viaMaster) return viaMaster;
    }
  }

  const byNo = byFlight.get(normalizeFlightNo(flightNo));
  if (byNo) return byNo;
  if (masterFlightNo) {
    const viaMasterNo = byFlight.get(normalizeFlightNo(masterFlightNo));
    if (viaMasterNo) return viaMasterNo;
  }

  // Codeshare: status shows marketing 편명 (KE…) while apron has the operating
  // carrier (BX/OZ…). Only accept when digits + scheduled/estimated time agree
  // on a single stand — never guess across different times.
  const viaDigits = lookupStandByDigits(map, flightNo, uniqueTimes);
  if (viaDigits) return viaDigits;
  if (masterFlightNo) {
    const viaMasterDigits = lookupStandByDigits(map, masterFlightNo, uniqueTimes);
    if (viaMasterDigits) return viaMasterDigits;
  }
  return '';
}

/**
 * Match apron rows that share the numeric 편명 and one of the candidate times,
 * ignoring the airline prefix. Ambiguous (two different stands) → empty.
 */
function lookupStandByDigits(
  map: Map<string, string>,
  flightNo: string,
  times: string[],
): string {
  const digits = flightDigits(flightNo);
  if (digits.length < 3 || times.length === 0) return '';

  const stands = new Set<string>();
  for (const [key, stand] of map) {
    if (flightDigits(apronFlightNo(key)) !== digits) continue;
    if (!times.includes(apronFlightTime(key))) continue;
    stands.add(stand);
    if (stands.size > 1) return '';
  }
  return stands.size === 1 ? [...stands][0]! : '';
}

function mergeGate(
  departures: RawJejuDeparture[],
  gates: Map<string, string>,
  gatesByFlight: Map<string, string>,
): RawJejuDeparture[] {
  return departures.map((row) => {
    if (row.gate) return row;
    const gate = lookupStand(
      gates,
      gatesByFlight,
      row.flightNo,
      row.scheduledTime,
      row.masterFlightNo,
      row.estimatedTime,
    );
    return gate ? { ...row, gate } : row;
  });
}

function mergeBelt(
  arrivals: RawJejuArrival[],
  belts: Map<string, string>,
  beltsByFlight: Map<string, string>,
): RawJejuArrival[] {
  return arrivals.map((row) => {
    if (row.belt) return row;
    const belt = lookupStand(
      belts,
      beltsByFlight,
      row.flightNo,
      row.scheduledTime,
      row.masterFlightNo,
      row.estimatedTime,
    );
    return belt ? { ...row, belt } : row;
  });
}
