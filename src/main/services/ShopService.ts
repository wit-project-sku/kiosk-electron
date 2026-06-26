import type { Shop } from '@shared/types/shop';
import { createLogger } from '@main/core/logger';
import type { LocalCacheService } from '@main/services/LocalCacheService';
import type { KioskService } from '@main/services/KioskService';

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
 * The API kiosk id is read per-machine from electron-store (shopApiKioskId),
 * set via provision-kiosk.ps1 — never from env.
 */
export class ShopService {
  constructor(
    private readonly cache: LocalCacheService,
    private readonly kiosk: KioskService,
  ) {}

  private baseUrl(): string {
    if (process.env['SHOP_API_URL']) return process.env['SHOP_API_URL'];
    const base = (process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE).replace(/\/+$/, '');
    return `${base}/api/shops`;
  }

  private kioskNum(): number {
    const cfg = this.kiosk.getConfig();
    // The API kiosk id is read from electron-store, set per machine via
    // provision-kiosk.ps1 (shopApiKioskId). If it isn't provisioned, derive it
    // from the kiosk id itself (W003 → 3).
    if (cfg.shopApiKioskId != null && Number.isFinite(cfg.shopApiKioskId) && cfg.shopApiKioskId > 0) {
      return cfg.shopApiKioskId;
    }
    const digits = (cfg.kioskId.match(/\d+/)?.[0] ?? '1').replace(/^0+/, '');
    const n = Number(digits || '1');
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  /** Cached shops (from the last successful refresh). Empty until first sync. */
  list(): Shop[] {
    const cached = this.cache.get(CACHE_KEY);
    const shops = cached?.data?.['shops'];
    return Array.isArray(shops) ? (shops as Shop[]) : [];
  }

  /** Pull the full catalogue and cache it. (Pagination removed from the API.) */
  async refresh(): Promise<number> {
    const url = `${this.baseUrl()}?kioskId=${this.kioskNum()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data?: Shop[] | { content?: Shop[] } };
      // The API now returns `data` as a plain array (post-pagination); keep the
      // old `data.content` path as a fallback so either shape works.
      const data = json.data;
      const shops: Shop[] = Array.isArray(data) ? data : (data?.content ?? []);
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
