import type { KioskBackground } from '@shared/types/background';
import { createLogger } from '@main/core/logger';
import type { LocalCacheService } from '@main/services/LocalCacheService';
import type { KioskService } from '@main/services/KioskService';
import type { RemoteImageCache } from '@main/services/RemoteImageCache';

const log = createLogger('background-service');
const CACHE_KEY = 'backgrounds';
const DEFAULT_API_BASE = 'https://api-v3.witteria.com';

/**
 * Fetches the AR 배경 테마 set from the witteria API and caches it in SQLite so
 * the 제주 AR 한복체험 outfit screen reads it instantly and works offline.
 * Refreshed on launch AND during the nightly sync — the assigned set is CMS
 * content that an operator can swap mid-day, exactly like the promo banners.
 *
 * The renderer shows each background's `imageUrl` directly, already ordered by
 * `sortOrder`, and hands the chosen `backgroundId` onward — the compositing
 * itself happens on a separate server.
 *
 * That url is rewritten to a LOCAL `media://remote/` one when RemoteImageCache
 * holds a copy. This used to claim "Chromium's disk cache keeps it offline after
 * first paint", which was a bet on a `Cache-Control` header the witteria API
 * owns: when it does not send a useful one, every remount of the 배경 테마 tiles
 * costs a round trip, and an offline kiosk shows nothing at all. Mirroring the
 * bytes is what makes the offline promise above actually hold — see
 * RemoteImageCache.
 *
 * ── An empty list is DATA, not a failure ──────────────────────────────
 * A branch that does not use backgrounds gets `data: []` (not a 404), so an
 * empty successful response is cached like any other: it is how a background
 * set is retired. That is the one place this service deliberately differs from
 * {@link BannerService}, which keeps its previous rows on an empty response.
 * A network/HTTP failure still falls back to the cache, so nothing is lost when
 * the API is merely unreachable.
 *
 * Env:
 *   BACKGROUNDS_API_URL — full endpoint override (wins if set; the `{kioskNum}`
 *                         segment is still appended)
 *   WITTERIA_API_BASE   — shared API base, default https://api-v3.witteria.com
 *
 * The per-kiosk endpoint id comes from KioskService.kioskNum() (W006 → 6), NOT
 * from the shop-only `shopApiKioskId` — see the note there.
 */
export class BackgroundService {
  constructor(
    private readonly cache: LocalCacheService,
    private readonly kiosk: KioskService,
    /** Optional — absent means "serve the remote urls", the old behaviour. */
    private readonly images?: RemoteImageCache,
  ) {}

  /**
   * Mirror the tile images locally, then drop any the CMS has retired.
   * Fire-and-forget, after the set itself is already cached.
   */
  async cacheImages(): Promise<void> {
    if (!this.images) return;
    // rawList, NOT list: list() hands back the already-localized urls, which
    // warm() would skip and prune() would read as "nothing is referenced" —
    // deleting the entire mirror on the first run after it was built.
    const urls = this.rawList().map((b) => b.imageUrl).filter(Boolean);
    await this.images.warm(urls);
    await this.images.prune(urls);
  }

  private baseUrl(): string {
    if (process.env['BACKGROUNDS_API_URL']) return process.env['BACKGROUNDS_API_URL'];
    const base = (process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE).replace(/\/+$/, '');
    return `${base}/api/kiosks`;
  }

  /** Cached backgrounds (from the last successful refresh), in display order. */
  /** The cached set exactly as the API sent it — remote urls, un-rewritten. */
  private rawList(): KioskBackground[] {
    const cached = this.cache.get(CACHE_KEY);
    const backgrounds = cached?.data?.['backgrounds'];
    return Array.isArray(backgrounds) ? (backgrounds as KioskBackground[]) : [];
  }

  list(): KioskBackground[] {
    if (!this.images) return this.rawList();
    // Point each tile at its local mirror when one exists; the remote url passes
    // through untouched otherwise, so a cold cache behaves exactly as before.
    return this.rawList().map((b) => ({ ...b, imageUrl: this.images!.localize(b.imageUrl) }));
  }

  /** Pull the background set assigned to this kiosk and cache it. */
  async refresh(): Promise<number> {
    const kioskNum = this.kiosk.kioskNum();
    const url = `${this.baseUrl()}/${kioskNum}/backgrounds`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data?: unknown };
      const rows = Array.isArray(json.data) ? json.data : [];
      const backgrounds = rows
        .map((b) => normalizeBackground(b as Record<string, unknown>))
        // The API already filters to ACTIVE; re-checking here means a future
        // "return everything" change cannot leak a retired plate onto a kiosk.
        // A row with no status at all is kept — absence is not INACTIVE.
        .filter((b) => Boolean(b.imageUrl) && b.status !== 'INACTIVE')
        .sort((a, b) => a.sortOrder - b.sortOrder);

      this.cache.upsert(CACHE_KEY, { backgrounds }, 'backgrounds_api');
      log.info('Backgrounds cached from API', {
        url,
        count: backgrounds.length,
        ids: backgrounds.map((b) => b.backgroundId),
      });
      return backgrounds.length;
    } catch (error) {
      log.warn('Backgrounds refresh failed (using cached)', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.list().length;
    }
  }
}

/**
 * Normalises a raw API background row into a {@link KioskBackground}.
 *
 * The witteria API may return either camelCase (`imageUrl`, `sortOrder`,
 * `nameKr`, …) or snake_case (`image_url`, `sort_order`, `name_kr`, …) — the
 * banner endpoint proved both conventions reach the kiosk — so both are read.
 * The non-Korean names arrive as `null` today and are stored as null rather
 * than "" so `backgroundName()` can tell "not translated" from "blank".
 */
function normalizeBackground(raw: Record<string, unknown>): KioskBackground {
  const name = (camel: string, snake: string): string | null => {
    const v = raw[camel] ?? raw[snake];
    return typeof v === 'string' && v.length > 0 ? v : null;
  };
  return {
    backgroundId: Number(raw['backgroundId'] ?? raw['background_id'] ?? raw['id'] ?? 0),
    imageUrl: String(raw['imageUrl'] ?? raw['image_url'] ?? ''),
    sortOrder: Number(raw['sortOrder'] ?? raw['sort_order'] ?? 0),
    status: String(raw['status'] ?? 'ACTIVE'),
    nameKr: name('nameKr', 'name_kr') ?? '',
    nameEn: name('nameEn', 'name_en'),
    nameJp: name('nameJp', 'name_jp'),
    nameCh: name('nameCh', 'name_ch'),
    nameVn: name('nameVn', 'name_vn'),
    nameId: name('nameId', 'name_id'),
    nameTh: name('nameTh', 'name_th'),
    nameRu: name('nameRu', 'name_ru'),
  };
}
