import https from 'node:https';
import type { ExchangeRate, ExchangeSnapshot } from '@shared/types/exchange';
import { createLogger } from '@main/core/logger';
import type { LocalCacheService } from './LocalCacheService';

const log = createLogger('exchange-service');

/**
 * GET JSON over HTTPS. The Eximbank host (oapi.koreaexim.go.kr) serves an
 * incomplete certificate chain that Node's TLS stack rejects even though curl
 * and browsers accept it, so we relax verification for this read-only public
 * API. The request still uses HTTPS; only chain verification is skipped.
 */
function fetchEximJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { rejectUnauthorized: false, timeout: 15000 }, (res) => {
      const status = res.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        res.resume();
        reject(new Error(`HTTP ${status}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error instanceof Error ? error : new Error('parse error'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

/** Korea Eximbank exchange-rate endpoint (AP01 = 환율). */
const BASE_URL = 'https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON';

/** Refresh every 6h. Rates change once per business day; the API caps ~1000/day. */
const REFRESH_MS = 6 * 60 * 60 * 1000;

/** local_cache key for offline-first persistence of the last snapshot. */
const CACHE_KEY = 'exchange';

/** How many days to walk back looking for a business day with data. */
const MAX_LOOKBACK_DAYS = 7;

type ExchangeListener = (snapshot: ExchangeSnapshot) => void;

/** Subset of the Eximbank row we consume. */
interface EximRow {
  result: number;
  cur_unit: string;
  cur_nm: string;
  deal_bas_r: string;
}

/** Format a Date as YYYYMMDD (kiosk runs in KST, so local date is correct). */
function yyyymmdd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Fetches FX rates from the Korea Eximbank open API, caches them locally, and
 * refreshes every 6 hours. All network lives here in the main process; the
 * renderer only ever reads the cached snapshot via IPC. The auth key is read
 * from `EXIM_API_KEY` (see `.env.example`). Weekends/holidays/early mornings
 * return no data, so we walk back up to a week to the last business day.
 */
export class ExchangeService {
  private current: ExchangeSnapshot | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private warnedNoKey = false;
  private readonly listeners = new Set<ExchangeListener>();

  constructor(private readonly cache: LocalCacheService) {}

  /** Hydrate from cache for an instant first paint, then begin polling. */
  start(): void {
    const cached = this.cache.get(CACHE_KEY);
    const data = cached?.data as Partial<ExchangeSnapshot> | undefined;
    if (data && Array.isArray(data.rates) && data.rates.length > 0) {
      this.current = data as ExchangeSnapshot;
    }
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getCurrent(): ExchangeSnapshot | null {
    return this.current;
  }

  subscribe(listener: ExchangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    if (!this.current) return;
    for (const listener of this.listeners) listener(this.current);
  }

  private async refresh(): Promise<void> {
    const apiKey = process.env['EXIM_API_KEY'];
    if (!apiKey) {
      if (!this.warnedNoKey) {
        log.warn('EXIM_API_KEY not set; exchange rates disabled. See .env.example');
        this.warnedNoKey = true;
      }
      return;
    }

    for (let back = 0; back < MAX_LOOKBACK_DAYS; back += 1) {
      const date = new Date();
      date.setDate(date.getDate() - back);
      const searchDate = yyyymmdd(date);
      const url = `${BASE_URL}?authkey=${apiKey}&searchdate=${searchDate}&data=AP01`;

      try {
        const json = (await fetchEximJson(url)) as EximRow[];
        // Empty array = no data for that date (weekend/holiday/too early).
        if (!Array.isArray(json) || json.length === 0) continue;

        const rates: ExchangeRate[] = json
          .filter((r) => r.result === 1 && r.deal_bas_r)
          .map((r) => ({
            code: r.cur_unit,
            name: r.cur_nm,
            rate: Number(r.deal_bas_r.replace(/,/g, '')),
            rateText: r.deal_bas_r,
          }));
        if (rates.length === 0) continue;

        this.current = { rates, searchDate, fetchedAt: new Date().toISOString() };
        this.cache.upsert(CACHE_KEY, this.current as unknown as Record<string, unknown>, 'exchange');
        this.emit();
        log.info('Exchange rates updated', { searchDate, count: rates.length });
        return;
      } catch (error) {
        log.warn('Exchange fetch failed', { searchDate, error });
      }
    }
    log.warn('Exchange refresh found no business day with data (keeping last snapshot)');
  }
}
