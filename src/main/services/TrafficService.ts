import { createLogger } from '@main/core/logger';
import { witteriaApiBase } from '@main/core/apiBase';
import type { ExpresswayTrafficItem, ExpresswayTrafficSnapshot } from '@shared/types/traffic';

const log = createLogger('traffic-service');
/** Give up on a slow/offline network rather than hold the home board. */
const REQUEST_TIMEOUT_MS = 8000;
/** The server caches 3 minutes; asking more often than that only returns the same value. */
const MIN_REFETCH_MS = 60 * 1000;

interface TrafficApiResponse {
  success: boolean;
  code: number | string;
  message?: string;
  data?: { items?: unknown; fetchedAt?: unknown } | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function normalizeItem(raw: unknown): ExpresswayTrafficItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r['id']);
  if (!id) return null;
  return {
    id,
    scope: r['scope'] === 'NEARBY' ? 'NEARBY' : 'ROUTE',
    type: str(r['type']),
    typeName: str(r['typeName']),
    road: str(r['road']),
    direction: strOrNull(r['direction']),
    location: strOrNull(r['location']),
    closedLanes: Array.isArray(r['closedLanes'])
      ? r['closedLanes'].filter((n): n is number => typeof n === 'number')
      : [],
    shoulderClosed: r['shoulderClosed'] === true,
    congestionKm: numOrNull(r['congestionKm']),
    message: strOrNull(r['message']),
    distanceKm: numOrNull(r['distanceKm']),
    occurredAt: str(r['occurredAt']),
  };
}

/**
 * 화성휴게소 home board's 도로교통상황 — GET {WITTERIA_API_BASE}/api/traffic/expressway.
 *
 * The renderer polls this (only the 화성 home asks, so other kiosks never hit
 * the endpoint). The last good snapshot is kept, so a failed refresh or a 503
 * INFO5031 ("no value yet") answers with what the board already shows — or
 * null before the first success, which the board renders as its empty state.
 * Never throws: the board must not error over traffic.
 */
export class TrafficService {
  private last: ExpresswayTrafficSnapshot | null = null;
  private lastFetchMs = 0;
  private inflight: Promise<ExpresswayTrafficSnapshot | null> | null = null;

  async getExpressway(): Promise<ExpresswayTrafficSnapshot | null> {
    if (this.last && Date.now() - this.lastFetchMs < MIN_REFETCH_MS) return this.last;
    this.inflight ??= this.fetch().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async fetch(): Promise<ExpresswayTrafficSnapshot | null> {
    const url = `${witteriaApiBase()}/api/traffic/expressway`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const json = (await res.json().catch(() => null)) as TrafficApiResponse | null;
      if (!res.ok || !json?.success || !json.data) {
        // 503 INFO5031 = the server has no value at all yet; keep whatever we had.
        log.warn('Traffic fetch returned no data', { url, status: res.status, code: json?.code });
        return this.last;
      }
      const items = Array.isArray(json.data.items)
        ? json.data.items.map(normalizeItem).filter((i): i is ExpresswayTrafficItem => i !== null)
        : [];
      this.last = { items, fetchedAt: str(json.data.fetchedAt) };
      this.lastFetchMs = Date.now();
      return this.last;
    } catch (error) {
      log.warn('Traffic fetch failed', { url, error: error instanceof Error ? error.message : String(error) });
      return this.last;
    } finally {
      clearTimeout(timer);
    }
  }
}
