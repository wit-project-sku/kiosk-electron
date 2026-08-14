import type { Attraction } from '@shared/types/attraction';
import { createLogger } from '@main/core/logger';
import type { LocalCacheService } from '@main/services/LocalCacheService';
import type { KioskService } from '@main/services/KioskService';

const log = createLogger('attraction-service');
const CACHE_KEY = 'jeju_attractions';
const DEFAULT_API_BASE = 'https://api-v3.witteria.com';

/**
 * Fetches 제주's curated 관광명소 catalogue and caches it in SQLite so 여기는
 * 제주도's third tab reads it instantly and works offline. Refreshed on launch
 * and at the nightly sync, exactly like the shop catalogue it used to be a
 * filtered view of — see {@link Attraction} for what changed by moving off it.
 *
 * Env:
 *   JEJU_ATTRACTIONS_API_URL — full endpoint override (wins if set)
 *   WITTERIA_API_BASE        — shared API base, default https://api-v3.witteria.com
 *
 * ── On `kioskId`, and why this one is NOT the shop id ─────────────────
 * 제주 is the kiosk where the two ids diverge: its shops live at 7 while its
 * banners/backgrounds live at 6 (see ShopService.kioskNum). That trap does not
 * apply here — VERIFIED against stage on 2026-08-14, `?kioskId=6` and
 * `?kioskId=7` return the identical 101 rows, i.e. the parameter is accepted and
 * ignored server-side, the same way the outfit endpoint ignores `categoryName`.
 * So this sends the ordinary `kioskNum()` (W006 → 6) rather than reaching for
 * the shop-only override: it is the convention for every non-shop endpoint, and
 * nothing is gained by making an exception the server does not act on.
 *
 * If the server ever DOES start scoping this per kiosk and 제주's attractions
 * turn up empty, that is the first thing to check.
 */
export class AttractionService {
  constructor(
    private readonly cache: LocalCacheService,
    private readonly kiosk: KioskService,
  ) {}

  private baseUrl(): string {
    if (process.env['JEJU_ATTRACTIONS_API_URL']) return process.env['JEJU_ATTRACTIONS_API_URL'];
    const base = (process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE).replace(/\/+$/, '');
    return `${base}/api/jeju/attractions`;
  }

  /** Cached attractions (from the last successful refresh). Empty until first sync. */
  list(): Attraction[] {
    const cached = this.cache.get(CACHE_KEY);
    const rows = cached?.data?.['attractions'];
    return Array.isArray(rows) ? (rows as Attraction[]) : [];
  }

  /**
   * The 초성-filtered list, straight from the API's `initial` parameter.
   *
   * ── Why go to the network for a list we already hold ──────────────────
   * The renderer can (and does) filter the cached rows itself with
   * `leadingChosung`, and for 13 of the 14 buckets the two agree exactly —
   * measured against stage on 2026-08-14. They differ on names that do not
   * START with a Korean syllable: `1100고지습지` files under ㄱ on the server and
   * under nothing locally, because `leadingChosung` deliberately refuses to scan
   * past a leading digit (a shop named "3-김밥" must not land in ㄱ — that 3 is a
   * sheet ordering prefix, not part of the name). Both rules are right for their
   * own data, and the shared helper cannot be changed to suit this one screen.
   *
   * So the server is the better authority HERE, and this is how the screen gets
   * it — while the cached local filter still paints instantly and carries the
   * whole feature offline. See the call site in JejuAbout.
   *
   * Returns null on ANY failure (offline, bad shape, HTTP error) rather than an
   * empty array: the caller must be able to tell "no matches" from "could not
   * ask", because only the second one should fall back to the local filter.
   */
  async listByInitial(initial: string): Promise<Attraction[] | null> {
    // ㄱ~ㅎ, exactly one character — the API's documented contract. Anything else
    // is a caller bug, and sending it would silently return the whole catalogue.
    if (!/^[ㄱ-ㅎ]$/.test(initial)) {
      log.warn('Ignoring non-초성 initial filter', { initial });
      return null;
    }
    const url =
      `${this.baseUrl()}?kioskId=${this.kiosk.kioskNum()}` +
      `&initial=${encodeURIComponent(initial)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data?: Attraction[] | { content?: Attraction[] } };
      const data = json.data;
      const rows: Attraction[] = Array.isArray(data) ? data : (data?.content ?? []);
      // NOT cached: the full catalogue already is, and 14 more cache keys that
      // each duplicate a slice of it would only add ways for the two to disagree.
      return rows;
    } catch (error) {
      log.warn('제주 attractions 초성 filter failed (renderer keeps its local filter)', {
        initial,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /** Pull the catalogue and cache it; falls back to the cache on any failure. */
  async refresh(): Promise<number> {
    const url = `${this.baseUrl()}?kioskId=${this.kiosk.kioskNum()}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data?: Attraction[] | { content?: Attraction[] } };
      // Plain array today; the `data.content` path mirrors ShopService so a
      // re-paginated endpoint would not silently return zero rows.
      const data = json.data;
      const rows: Attraction[] = Array.isArray(data) ? data : (data?.content ?? []);

      if (rows.length > 0) {
        this.cache.upsert(CACHE_KEY, { attractions: rows }, 'jeju_attraction_api');
        log.info('제주 attractions cached from API', { count: rows.length });
      } else {
        // Deliberately NOT cached as an empty set, unlike the 배경 테마 list where
        // `[]` is a real state (a kiosk with no backgrounds assigned). 제주 having
        // zero attractions is not a state anyone configures — it is a bad
        // response — and caching it would blank the tab until the next sync.
        log.warn('제주 attractions API returned no rows', { url });
      }
      return rows.length;
    } catch (error) {
      log.warn('제주 attractions refresh failed (using cached)', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.list().length;
    }
  }
}
