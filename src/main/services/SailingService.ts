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
const MAX_PAGES = 10;
const BASE_URL = 'https://apis.data.go.kr/1613000/DmstcShipNvgInfo';
const TERMINAL_KIOSK = 'W007';
/** Major mainland / island origins that sail into 제주 — resolved once via GetPortList. */
const ORIGIN_PORT_SEARCH = [
  '목포', '완도', '삼천포', '여수', '진도', '녹동', '포항', '하추자',
] as const;
const MAX_ORIGIN_NODES = 24;

type SailingListener = (snapshot: JejuSailingSnapshot) => void;

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
 * Fetches 제주항 departures + arrivals from TAGO 국내선박운항정보, caches them,
 * and refreshes every five minutes. Unlike the airport flight board, the full
 * day's schedule is kept — past sailings are not hidden by the current clock.
 * Gated to W007 so the airport kiosk does not spend the shared data.go.kr quota.
 */
export class SailingService {
  private current: JejuSailingSnapshot | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cacheHydrated = false;
  private warnedNoKey = false;
  private jejuNodeIds: string[] | null = null;
  private originNodeIds: string[] | null = null;
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
    const serviceKey = process.env['DATA_GO_KR_SERVICE_KEY'];
    if (!serviceKey) {
      if (!this.warnedNoKey) {
        log.warn('DATA_GO_KR_SERVICE_KEY not set; 제주 선박 운항정보 disabled. See .env.example');
        this.warnedNoKey = true;
      }
      return;
    }

    const ymd = seoulYmd();

    try {
      const nodeIds = await this.ensureJejuNodes(serviceKey);
      if (nodeIds.length === 0) {
        log.warn('No 제주 port nodes found in TAGO GetPortList');
        return;
      }

      const depResults = await Promise.allSettled(
        nodeIds.map((nodeId) =>
          this.fetchList(serviceKey, nodeId, ymd, 'departure'),
        ),
      );

      let departures: RawJejuSailing[] = [];
      for (const result of depResults) {
        if (result.status === 'fulfilled') departures.push(...result.value);
        else log.warn('Jeju sailing departures fetch failed', result.reason);
      }

      if (depResults.every((r) => r.status === 'rejected')) {
        throw depResults[0]?.status === 'rejected' ? depResults[0].reason : new Error('All departure fetches failed');
      }

      departures = dedupeAndSort(departures);

      // Publish departures immediately so the home board does not wait for the
      // slower mainland-origin arrival sweep (~24 nodes).
      this.current = {
        fetchedAt: new Date().toISOString(),
        departures,
        arrivals: this.current?.arrivals ?? [],
      };
      this.cache.upsert(CACHE_KEY, this.current as unknown as Record<string, unknown>, 'tago-sailings');
      this.emit();

      let arrivals: RawJejuSailing[] = [];
      try {
        const originIds = await this.ensureOriginNodes(serviceKey);
        const arrResults = await Promise.allSettled(
          originIds.map((nodeId) =>
            this.fetchList(serviceKey, nodeId, ymd, 'arrival'),
          ),
        );
        for (const result of arrResults) {
          if (result.status === 'fulfilled') arrivals.push(...result.value);
          else log.warn('Jeju sailing arrivals fetch failed', result.reason);
        }
      } catch (error) {
        log.warn('Jeju sailing arrival port lookup failed (keeping departures)', error);
      }

      arrivals = dedupeAndSort(arrivals);

      const snapshot: JejuSailingSnapshot = {
        fetchedAt: new Date().toISOString(),
        departures,
        arrivals,
      };
      this.current = snapshot;
      this.cache.upsert(CACHE_KEY, snapshot as unknown as Record<string, unknown>, 'tago-sailings');
      this.emit();
      log.info('Jeju sailings updated', {
        departures: departures.length,
        arrivals: arrivals.length,
        nodes: nodeIds.length,
      });
    } catch (error) {
      log.warn('Jeju sailing fetch failed (keeping last snapshot)', error);
    }
  }

  private async ensureJejuNodes(serviceKey: string): Promise<string[]> {
    if (this.jejuNodeIds) return this.jejuNodeIds;

    const rows: Record<string, unknown>[] = [];
    let pageNo = 1;
    let total = Infinity;

    while (pageNo <= MAX_PAGES && (pageNo - 1) * PAGE_SIZE < total) {
      const body = await this.fetchOperation('GetPortList', serviceKey, {
        pageNo: String(pageNo),
        nodeNm: '제주',
      });
      const items = unwrapItems(body.items);
      total = Number(body.totalCount ?? items.length);
      if (!Number.isFinite(total)) total = items.length;
      rows.push(...items);
      if (items.length === 0) break;
      pageNo += 1;
    }

    const ids = rows
      .map((row) => ({
        id: first(row, ['nodeid', 'nodeId', 'portCode', 'portcode']),
        name: first(row, ['nodenm', 'nodeNm', 'portNm', 'portnm']),
      }))
      .filter((row) => row.id && isJejuPort(row.name))
      .map((row) => row.id);

    this.jejuNodeIds = [...new Set(ids)];
    if (this.jejuNodeIds.length === 0 && rows.length > 0) {
      log.warn('GetPortList returned rows but none matched 제주 — check field names', {
        sampleKeys: Object.keys(rows[0] ?? {}),
      });
    }
    return this.jejuNodeIds;
  }

  private async ensureOriginNodes(serviceKey: string): Promise<string[]> {
    if (this.originNodeIds) return this.originNodeIds;

    const ids = new Set<string>();
    for (const term of ORIGIN_PORT_SEARCH) {
      try {
        const body = await this.fetchOperation('GetPortList', serviceKey, {
          pageNo: '1',
          nodeNm: term,
        });
        for (const row of unwrapItems(body.items)) {
          const id = first(row, ['nodeid', 'nodeId']);
          const name = first(row, ['nodenm', 'nodeNm']);
          if (id && name && !isJejuPort(name)) ids.add(id);
        }
      } catch (error) {
        log.warn('Origin port lookup failed', { term, error });
      }
    }

    this.originNodeIds = [...ids].slice(0, MAX_ORIGIN_NODES);
    return this.originNodeIds;
  }

  private async fetchList(
    serviceKey: string,
    nodeId: string,
    ymd: string,
    direction: 'departure' | 'arrival',
  ): Promise<RawJejuSailing[]> {
    const rows: RawJejuSailing[] = [];
    let pageNo = 1;
    let total = Infinity;

    while (pageNo <= MAX_PAGES && (pageNo - 1) * PAGE_SIZE < total) {
      const body = await this.fetchOperation('GetShipOpratInfoList', serviceKey, {
        pageNo: String(pageNo),
        depNodeId: nodeId,
        ioType: 'O',
        depPlandTime: ymd,
      });
      const items = unwrapItems(body.items);
      total = Number(body.totalCount ?? items.length);
      if (!Number.isFinite(total)) total = items.length;

      for (const item of items) {
        const mapped = mapSailing(item, direction);
        if (mapped) rows.push(mapped);
      }

      if (items.length === 0) break;
      pageNo += 1;
    }

    if (rows.length === 0 && pageNo === 2) {
      log.warn('TAGO sailing items did not map — check field names', { direction, nodeId });
    }

    return rows;
  }

  private async fetchOperation(
    operation: string,
    serviceKey: string,
    extra: Record<string, string>,
  ): Promise<PortalBody> {
    const qs = new URLSearchParams({
      pageNo: extra['pageNo'] ?? '1',
      numOfRows: String(PAGE_SIZE),
      _type: 'json',
      ...extra,
    });
    const url = `${BASE_URL}/${operation}?serviceKey=${serviceKey}&${qs.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const json = await readPortalJson(res);
    const header = json.response?.header;
    const code = String(header?.resultCode ?? '');
    if (code && code !== '00' && code !== '0000') {
      throw new Error(`TAGO ${operation} ${code}: ${header?.resultMsg ?? ''}`);
    }
    if (!json.response?.body && !res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return json.response?.body ?? {};
  }
}

function seoulYmd(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const grab = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${grab('year')}${grab('month')}${grab('day')}`;
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

function mapSailing(
  item: Record<string, unknown>,
  direction: 'departure' | 'arrival',
): RawJejuSailing | null {
  const shipName = first(item, [
    'vihiclenm', 'vihicleNm', 'shipname', 'shipName', 'shipnm', 'shipNm', 'vslnm', 'vslNm',
  ]);
  if (!shipName) return null;

  const depPlace = first(item, ['depplacenm', 'depPlaceNm']);
  const arrPlace = first(item, ['arrplacenm', 'arrPlaceNm']);
  const depTime = toHm(rawField(item, ['depplandtime', 'depPlandTime']));
  const arrTime = toHm(rawField(item, ['arrplandtime', 'arrPlandTime']));

  if (direction === 'departure') {
    if (!depPlace.includes('제주')) return null;
  } else if (!arrPlace.includes('제주')) {
    return null;
  }

  const scheduledTime = direction === 'departure' ? depTime : arrTime;
  if (!scheduledTime) return null;

  const estimatedRaw = toHm(
    rawField(item, [
      'updatedtime', 'updatedTime', 'chgtime', 'chgTime',
      'revisedtime', 'revisedTime', 'etdtime', 'etdTime',
    ]),
  );
  const estimatedTime =
    estimatedRaw && estimatedRaw !== scheduledTime ? estimatedRaw : undefined;

  const route = depPlace && arrPlace ? `${depPlace}-${arrPlace}` : depPlace || arrPlace;
  const place = direction === 'departure' ? depPlace : arrPlace;
  const duration = formatDuration('', '', '', depTime, arrTime);
  const id = `${direction}-${shipName}-${scheduledTime}-${place || route}`;

  return {
    id,
    scheduledTime,
    estimatedTime,
    duration,
    shipName,
    route,
    place,
    port: classifyPort(depPlace, route, place),
    status: undefined,
    note: undefined,
  };
}

function rawField(item: Record<string, unknown>, keys: string[]): string {
  const lower = new Map<string, unknown>();
  for (const [k, v] of Object.entries(item)) lower.set(k.toLowerCase(), v);
  for (const key of keys) {
    const v = lower.get(key.toLowerCase());
    if (v != null && String(v).trim()) return String(v);
  }
  return '';
}

function classifyPort(depPlace: string, route: string, place: string): string {
  const blob = `${depPlace} ${route} ${place}`.replace(/\s+/g, '');
  if (blob.includes('국제') || blob.includes('7부두')) return '국제항';
  if (blob.includes('연안') || blob.includes('2부두')) return '연안항';
  if (depPlace === '제주국제' || place === '제주국제') return '국제항';
  if (depPlace.includes('제주') || place.includes('제주')) return '연안항';
  return '국제항';
}

function formatDuration(
  hourRaw: string,
  minRaw: string,
  durationRaw: string,
  depTime: string,
  arrTime: string,
): string {
  if (durationRaw) {
    const digits = durationRaw.replace(/\D/g, '');
    if (digits.length === 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    if (durationRaw.includes(':')) return durationRaw;
  }
  const h = Number(hourRaw.replace(/\D/g, '') || '0');
  const m = Number(minRaw.replace(/\D/g, '') || '0');
  if (h > 0 || m > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (depTime && arrTime) {
    const diff = timeToMin(arrTime) - timeToMin(depTime);
    if (diff > 0) {
      const total = diff;
      return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }
  }
  return '--:--';
}

function timeToMin(hhmm: string): number {
  const parts = hhmm.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function isJejuPort(name: string): boolean {
  return name.replace(/\s+/g, '').includes('제주');
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
  if (!raw) return '';
  if (/^\d{1,2}:\d{2}$/.test(raw.trim())) return raw.trim();
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
