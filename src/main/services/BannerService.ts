import type { KioskBanner } from '@shared/types/banner';
import { createLogger } from '@main/core/logger';
import type { LocalCacheService } from '@main/services/LocalCacheService';
import type { KioskService } from '@main/services/KioskService';

const log = createLogger('banner-service');
const CACHE_KEY = 'banners';
const DEFAULT_API_BASE = 'https://api-v3.witteria.com';

/**
 * Fetches the bottom promo banners from the witteria API and caches them in
 * SQLite so the kiosk reads them instantly and works offline. Refreshed on
 * launch AND during the nightly sync — banners are promo content that rotates
 * on date windows, so a running kiosk should pick up a same-day CMS change at
 * the 02:00 sync without waiting for the next reboot.
 *
 * The renderer shows each banner's remote `imageUrl` directly (Chromium's disk
 * cache keeps it offline after first paint, exactly as the shop images do),
 * filtered to the active date window and ordered by `sortOrder`.
 *
 * Env:
 *   BANNERS_API_URL     — full endpoint override (wins if set)
 *   WITTERIA_API_BASE   — shared API base, default https://api-v3.witteria.com
 *
 * The API kiosk id is read per-machine from electron-store (shopApiKioskId),
 * set via provision-kiosk.ps1 — see KioskService.kioskNum().
 */
export class BannerService {
  constructor(
    private readonly cache: LocalCacheService,
    private readonly kiosk: KioskService,
  ) {}

  private baseUrl(): string {
    if (process.env['BANNERS_API_URL']) return process.env['BANNERS_API_URL'];
    const base = (process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE).replace(/\/+$/, '');
    return `${base}/api/kiosks`;
  }
  /** Cached banners (from the last successful refresh). Empty until first sync. */
  list(): KioskBanner[] {
    const cached = this.cache.get(CACHE_KEY);
    const banners = cached?.data?.['banners'];
    return Array.isArray(banners) ? (banners as KioskBanner[]) : [];
  }

  /** Pull the banner list for this kiosk and cache it. */
  async refresh(): Promise<number> {
    const kioskNum = this.kiosk.kioskNum();
    const url = `${this.baseUrl()}/${kioskNum}/banners`;
    log.info('Fetching banners from API', {
      url,
      kioskId: this.kiosk.getConfig().kioskId,
      kioskNum,
    });
    try {
      const res = await fetch(url);
      log.info('Banners API responded', { status: res.status, ok: res.ok });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data?: any[] };
      const rawBanners = Array.isArray(json.data) ? json.data : [];
      
      if (rawBanners.length > 0) {
        log.info('Banners API keys sample', { keys: Object.keys(rawBanners[0]) });
      }

      const banners = rawBanners.map((b) => normalizeBanner(b as Record<string, unknown>));
      log.info(
        'Banners API rows',
        banners
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((b) => ({
            bannerId: b.bannerId,
            sortOrder: b.sortOrder,
            startDate: b.startDate,
            endDate: b.endDate,
            hasImageUrl: Boolean(b.imageUrl),
          })),
      );
      if (banners.length > 0) {
        this.cache.upsert(CACHE_KEY, { banners }, 'banners_api');
        log.info('Banners cached from API', { count: banners.length });
      } else {
        log.warn('Banners API returned no rows', { url });
      }
      return banners.length;
    } catch (error) {
      log.warn('Banners refresh failed (using cached)', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.list().length;
    }
  }
}

/**
 * Normalises a raw API banner object into a {@link KioskBanner}.
 *
 * The witteria API may return either snake_case (`image_url`, `sort_order`,
 * `start_date`, `end_date`) or camelCase (`imageUrl`, `sortOrder`, …). Reading
 * both conventions defensively means the banner set is never silently empty
 * due to a field-name mismatch. `sortOrder` defaults to 0 so a missing value
 * still produces a stable (if arbitrary) order.
 */
function normalizeBanner(raw: Record<string, unknown>): KioskBanner {
  return {
    bannerId:  Number(raw['bannerId']  ?? raw['banner_id']  ?? raw['id'] ?? 0),
    imageUrl:  String(raw['imageUrl']  ?? raw['image_url']  ?? ''),
    sortOrder: Number(raw['sortOrder'] ?? raw['sort_order'] ?? 0),
    startDate: String(raw['startDate'] ?? raw['start_date'] ?? ''),
    endDate:   String(raw['endDate']   ?? raw['end_date']   ?? ''),
  };
}
