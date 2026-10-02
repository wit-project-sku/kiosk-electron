import type { Shop } from '@shared/types/shop';
import { createLogger } from '@main/core/logger';
import type { LocalCacheService } from '@main/services/LocalCacheService';
import type { KioskService } from '@main/services/KioskService';
import { normalizeShops } from '@main/services/normalizeShop';

const log = createLogger('shop-service');
const CACHE_KEY = 'shops';
const DEFAULT_API_BASE = 'https://api-v3.witteria.com';

/**
 * Fetches the shop catalogue from the witteria API and caches it in SQLite so
 * the kiosk reads it instantly and works offline. Refreshed on launch + nightly.
 *
 * Env:
 *   SHOP_API_URL        — full endpoint override (wins if set)
 *   WITTERIA_API_BASE   — shared API base, default https://api-v3.witteria.com
 *
 * v2 is keyed by content branch (`?region=HWASEONG`), authored per location in
 * kioskLocations.ts — never from env. It replaced the v1 `?kioskId=` param, and
 * with it the per-machine `shopApiKioskId` override, which v2 ignores.
 */
export class ShopService {
  constructor(
    private readonly cache: LocalCacheService,
    private readonly kiosk: KioskService,
  ) {}

  private baseUrl(): string {
    if (process.env['SHOP_API_URL']) return process.env['SHOP_API_URL'];
    const base = (process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE).replace(/\/+$/, '');
    return `${base}/api/shops/v2`;
  }

  /**
   * Cached shops (from the last successful refresh). Empty until first sync.
   *
   * Normalized on the way out as well as on the way in: a kiosk that is offline
   * (or hasn't synced since this guard was added) is serving rows that were
   * cached RAW, and those are exactly the ones that crash a detail page. Quiet,
   * because `refresh()` already logged the same payload's defects.
   */
  list(): Shop[] {
    const cached = this.cache.get(CACHE_KEY);
    const shops = cached?.data?.['shops'];
    if (!Array.isArray(shops)) return [];
    return normalizeShops(shops, 'cache', true).shops;
  }

  /** Pull the full catalogue and cache it. (Pagination removed from the API.) */
  async refresh(): Promise<number> {
    const region = this.kiosk.region();
    if (!region) return this.list().length;
    const url = `${this.baseUrl()}?region=${region}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data?: unknown[] | { content?: unknown[] } };
      // The API now returns `data` as a plain array (post-pagination); keep the
      // old `data.content` path as a fallback so either shape works.
      const data = json.data;
      const raw: unknown[] = Array.isArray(data) ? data : (data?.content ?? []);
      // Coerce BEFORE caching so the bad shape is never persisted — see
      // normalizeShop.ts for what the API actually sends versus what Shop claims.
      const { shops } = normalizeShops(raw, `api region=${region}`);
      if (shops.length > 0) {
        this.cache.upsert(CACHE_KEY, { shops }, 'shop_api');
        log.info('Shops cached from API', { count: shops.length });
      } else {
        log.warn('Shops API returned no rows', { url });
      }
      return shops.length;
    } catch (error) {
      log.warn('Shops refresh failed (using cached)', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.list().length;
    }
  }
}
