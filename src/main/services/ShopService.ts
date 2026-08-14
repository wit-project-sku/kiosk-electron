import type { Shop } from '@shared/types/shop';
import { getShopApiKioskId } from '@shared/config/kioskLocations';
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
 * The API kiosk id is per-machine from electron-store (shopApiKioskId) or, when
 * that is unset, authored per location in kioskLocations.ts — never from env.
 * See {@link ShopService.kioskNum}.
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

  /**
   * The `kioskId` this machine sends to the SHOP endpoint, in precedence order:
   *
   *   1. electron-store `shopApiKioskId` — the per-machine override written by
   *      `provision-kiosk.ps1 <id> -ShopId <n>`;
   *   2. the location's authored `shopApiKioskId` — for kiosks whose catalogue
   *      is filed under a different number than their W-code (제주 W006 → 7);
   *   3. the digits of the kiosk id itself (W003 → 3).
   *
   * Note this is NOT `KioskService.kioskNum()`: that one drives the per-kiosk
   * endpoints, which key off the W-code number even when shops do not.
   */
  private kioskNum(): number {
    const cfg = this.kiosk.getConfig();
    if (cfg.shopApiKioskId != null && Number.isFinite(cfg.shopApiKioskId) && cfg.shopApiKioskId > 0) {
      return cfg.shopApiKioskId;
    }
    const authored = getShopApiKioskId(cfg.kioskId);
    if (authored != null && Number.isFinite(authored) && authored > 0) return authored;

    const digits = (cfg.kioskId.match(/\d+/)?.[0] ?? '1').replace(/^0+/, '');
    const n = Number(digits || '1');
    return Number.isFinite(n) && n > 0 ? n : 1;
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
    const url = `${this.baseUrl()}?kioskId=${this.kioskNum()}`;
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
      const { shops } = normalizeShops(raw, `api kiosk=${this.kioskNum()}`);
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
