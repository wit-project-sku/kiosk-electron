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
/** Same feed as http://jeju.ferry.or.kr/ (haewoon terminal board). */
const TERMINAL_BOARD_URL = 'http://company.haewoon.co.kr/CompanySite/getJSONData.aspx';
const TERMINAL_KIOSK = 'W007';

type SailingListener = (snapshot: JejuSailingSnapshot) => void;

/** Row from the 제주항 terminal homepage board (`MAINDEPARTURE`). */
interface TerminalBoardRow {
  INOUT: 'IN' | 'OUT';
  DISPLAYTIME: string;
  TIME: string;
  REQUIREDTIME: string;
  VESSEL: string;
  FPORT: string;
  TPORT: string;
  RealPortCode: string;
  IsCancel: string;
  DelayTime?: string;
}

/**
 * Fetches 제주항 departures + arrivals from the jeju.ferry.or.kr terminal board.
 * Berth (국제/연안), times, durations, and ship names match the public homepage.
 * Gated to W007.
 */
export class SailingService {
  private current: JejuSailingSnapshot | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private cacheHydrated = false;
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
    try {
      const board = await this.fetchTerminalBoard();
      const { departures, arrivals } = partitionTerminalBoard(board);

      const snapshot: JejuSailingSnapshot = {
        fetchedAt: new Date().toISOString(),
        departures,
        arrivals,
      };
      this.current = snapshot;
      this.cache.upsert(
        CACHE_KEY,
        snapshot as unknown as Record<string, unknown>,
        'terminal-sailings',
      );
      this.emit();
      log.info('Jeju sailings updated (terminal board)', {
        departures: departures.length,
        arrivals: arrivals.length,
      });
    } catch (error) {
      log.warn('Jeju sailing fetch failed (keeping last snapshot)', error);
    }
  }

  private async fetchTerminalBoard(): Promise<TerminalBoardRow[]> {
    const res = await fetch(TERMINAL_BOARD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'Method=MAINDEPARTURE&CompanyID=JEJU&Date=',
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json()) as { item?: TerminalBoardRow[] };
    return Array.isArray(json.item) ? json.item : [];
  }
}

function partitionTerminalBoard(
  board: TerminalBoardRow[],
): Pick<JejuSailingSnapshot, 'departures' | 'arrivals'> {
  const departures: RawJejuSailing[] = [];
  const arrivals: RawJejuSailing[] = [];

  for (const entry of board) {
    const row = terminalBoardRowToRaw(entry);
    if (entry.INOUT === 'OUT') departures.push(row);
    else if (entry.INOUT === 'IN') arrivals.push(row);
  }

  return {
    departures: dedupeAndSort(departures),
    arrivals: dedupeAndSort(arrivals),
  };
}

function terminalBoardRowToRaw(entry: TerminalBoardRow): RawJejuSailing {
  const port = entry.RealPortCode === 'NAT' ? '연안항' : '국제항';
  const route = `${entry.FPORT}-${entry.TPORT}`.replace(/--+/g, '-');

  let scheduledTime = entry.DISPLAYTIME;
  let estimatedTime: string | undefined;

  if (entry.INOUT === 'OUT') {
    scheduledTime = entry.TIME || entry.DISPLAYTIME;
    if (entry.DISPLAYTIME && entry.TIME && entry.DISPLAYTIME !== entry.TIME) {
      estimatedTime = entry.DISPLAYTIME;
    } else if (entry.DelayTime && entry.DelayTime !== '-') {
      estimatedTime = entry.DelayTime;
    }
  } else if (entry.DelayTime && entry.DelayTime !== '-') {
    estimatedTime = entry.DelayTime;
  }

  return {
    id: sailingRowKey(entry.VESSEL, scheduledTime, route, port),
    scheduledTime,
    estimatedTime,
    duration: entry.REQUIREDTIME || '--:--',
    shipName: entry.VESSEL,
    route,
    place: port === '연안항' ? '연안터미널' : '국제터미널',
    port,
    status: entry.IsCancel === '정상운항' ? '정상운항' : entry.IsCancel,
  };
}

function sailingRowKey(
  shipName: string,
  scheduledTime: string,
  route: string,
  port: string,
): string {
  return [shipName, scheduledTime, route, port].join('|');
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
