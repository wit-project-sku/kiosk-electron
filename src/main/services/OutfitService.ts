import type {
  KioskOutfit,
  OutfitCategory,
  OutfitCategoryLabels,
  OutfitGender,
} from '@shared/types/outfit';
import { fallbackOutfitLabels } from '@shared/constants/outfitCategories';
import { createLogger } from '@main/core/logger';
import type { LocalCacheService } from '@main/services/LocalCacheService';
import type { KioskService } from '@main/services/KioskService';

const log = createLogger('outfit-service');
const CACHE_KEY = 'outfits';
const DEFAULT_API_BASE = 'https://api-v3.witteria.com';

/** One request's worth. The whole catalogue is ~65 rows, so this is one page. */
const PAGE_SIZE = 200;
/** Hard stop for the paging loop — a broken `last` flag must not spin forever. */
const MAX_PAGES = 20;

/**
 * The AR 한복체험 outfit catalogue, from the witteria API into SQLite.
 *
 * Replaces the build-time PNG glob: outfits used to ship inside the bundle, so
 * adding one meant a rebuild and a redeploy to every kiosk. Same shape as
 * BannerService/BackgroundService — pull on launch and at the nightly sync,
 * serve from cache, work offline.
 *
 *   GET /api/outfits?pageNum=1&pageSize=200   → { data: { content, last, … } }
 *   GET /api/outfits/categories               → { data: [ { id, categoryName, label* } ] }
 *
 * ── The tab list is CMS content ───────────────────────────────────────
 * `GET /api/outfits/categories` is what the picker draws its tabs from: one tab
 * per row, in registration order, labelled in eight languages by the operator.
 * Renaming a tab is an admin action rather than a release, which is why nothing
 * downstream may re-label a category locally.
 *
 * ★ It 401s on PROD (verified 2026-08-14 — stage answers, prod says "JWT 토큰이
 * 없거나 유효하지 않습니다"), so the pre-label `GET /api/categories/outfits` is
 * kept as the fallback: same rows, `{id,name}` only, and the missing labels are
 * filled from `shared/constants/outfitCategories`. Drop the fallback once the
 * labelled endpoint is reachable without a token on prod.
 *

 * ── Everything is fetched, nothing is filtered server-side ────────────
 * ★ `categoryName` is accepted by the endpoint and then IGNORED — every value
 * returns the full 65 rows (verified 2026-08-14: `w=hannbok`, `brand` and
 * `K-Culture` all came back with `totalElements: 65`, and the first page of a
 * `w=hannbok` query was school uniforms). `type` and `keyword` DO work.
 *
 * That is fine here, because filtering per tab is the wrong shape anyway: the
 * catalogue is small, the visitor flicks between tabs, and a request per tap
 * would put the network in the middle of the UI. So the whole list is pulled
 * once and the renderer filters it. If the server-side filter is fixed later,
 * nothing here has to change.
 *
 * Env:
 *   OUTFITS_API_URL            — full outfit endpoint override (wins if set)
 *   OUTFIT_CATEGORIES_API_URL  — full tab-list endpoint override (wins if set)
 *   WITTERIA_API_BASE          — shared API base, default https://api-v3.witteria.com
 */
export class OutfitService {
  constructor(
    private readonly cache: LocalCacheService,
    private readonly kiosk: KioskService,
  ) {}

  private base(): string {
    return (process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE).replace(/\/+$/, '');
  }

  private outfitsUrl(): string {
    return process.env['OUTFITS_API_URL'] || `${this.base()}/api/outfits`;
  }

  private categoriesUrl(): string {
    return process.env['OUTFIT_CATEGORIES_API_URL'] || `${this.base()}/api/outfits/categories`;
  }

  /** Pre-label tab list — the fallback while the labelled one 401s on prod. */
  private legacyCategoriesUrl(): string {
    return `${this.base()}/api/categories/outfits`;
  }

  /** Cached outfits for THIS kiosk. Empty until the first successful refresh. */
  list(): KioskOutfit[] {
    const rows = this.cache.get(CACHE_KEY)?.data?.['outfits'];
    if (!Array.isArray(rows)) return [];
    const kioskNum = this.kiosk.kioskNum();
    // Assignment is per-kiosk, so an outfit not assigned here must not show up.
    // An empty kioskIds is treated as "everywhere" rather than "nowhere" — the
    // failure mode of hiding the whole catalogue is far worse than showing one
    // extra outfit.
    return (rows as KioskOutfit[]).filter(
      (o) => o.kioskIds.length === 0 || o.kioskIds.includes(kioskNum),
    );
  }

  /** Cached category tabs, in API order. */
  categories(): OutfitCategory[] {
    const rows = this.cache.get(CACHE_KEY)?.data?.['categories'];
    return Array.isArray(rows) ? (rows as OutfitCategory[]) : [];
  }

  /** Pull the catalogue + tabs and cache them. Returns the outfit count stored. */
  async refresh(): Promise<number> {
    try {
      const [outfits, categories] = await Promise.all([
        this.fetchAllOutfits(),
        this.fetchCategories(),
      ]);

      // An empty catalogue is almost certainly a bad deploy rather than a real
      // "no outfits" state, and overwriting good rows with it would leave the
      // kiosk unable to take a photo at all. Keep what we have.
      if (outfits.length === 0) {
        log.warn('Outfit API returned nothing — keeping the cached catalogue', {
          cached: this.cache.get(CACHE_KEY)?.data?.['outfits'] ? 'yes' : 'no',
        });
        return this.list().length;
      }

      // Same reasoning one level down: no tabs means no way to reach any outfit,
      // so a failed tab fetch keeps the tabs already cached rather than blanking
      // the picker's top half.
      const tabs = categories.length > 0 ? categories : this.categories();

      this.cache.upsert(CACHE_KEY, { outfits, categories: tabs }, 'api');
      log.info('Outfits cached', { outfits: outfits.length, categories: tabs.length });
      return outfits.length;
    } catch (error) {
      log.warn('Outfit refresh failed — keeping cached catalogue', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.list().length;
    }
  }

  /** Walk every page. `last` ends it; MAX_PAGES is the backstop. */
  private async fetchAllOutfits(): Promise<KioskOutfit[]> {
    const all: KioskOutfit[] = [];
    const seen = new Set<number>();

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const url = `${this.outfitsUrl()}?pageNum=${page}&pageSize=${PAGE_SIZE}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`);
      const json = (await res.json()) as { data?: Record<string, unknown> };
      const data = json.data ?? {};
      const content = Array.isArray(data['content']) ? (data['content'] as unknown[]) : [];

      for (const row of content) {
        const outfit = normalizeOutfit(row);
        // Paging over a list the server is also re-sorting can repeat a row;
        // the id is the only stable identity we get.
        if (outfit && !seen.has(outfit.id)) {
          seen.add(outfit.id);
          all.push(outfit);
        }
      }

      if (data['last'] === true || content.length === 0) break;
      if (page === MAX_PAGES) {
        log.warn('Outfit paging hit MAX_PAGES — the catalogue may be truncated', {
          collected: all.length,
        });
      }
    }

    return all;
  }

  /**
   * The tab list: the labelled endpoint, else the legacy one, else nothing.
   *
   * Never throws — a missing tab list must not take the outfit catalogue down
   * with it, since the cached tabs from the last sync are a perfectly good
   * answer and `refresh()` keeps them when this returns empty.
   */
  private async fetchCategories(): Promise<OutfitCategory[]> {
    for (const url of [this.categoriesUrl(), this.legacyCategoriesUrl()]) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data?: unknown };
        const rows = Array.isArray(json.data) ? json.data : [];
        const categories = rows
          .map(normalizeCategory)
          .filter((c): c is OutfitCategory => c !== null);
        if (categories.length > 0) return categories;
        log.warn('Category endpoint returned no usable tabs', { url, rows: rows.length });
      } catch (error) {
        log.warn('Category endpoint failed', {
          url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return [];
  }
}

/**
 * Normalises one tab row, from either endpoint.
 *
 * The two shapes differ only in the name field (`categoryName` vs `name`) and
 * in whether labels are present, so one function reads both: a legacy row simply
 * has every label filled from the local table. That also means the live list's
 * `name: null` rows (ids 10 and 11) are dropped by the same check that drops a
 * malformed one — a tab with no code cannot be matched against an outfit.
 */
function normalizeCategory(row: unknown): OutfitCategory | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;

  const id = typeof r['id'] === 'number' ? r['id'] : null;
  const raw = r['categoryName'] ?? r['name'];
  const categoryName = typeof raw === 'string' ? raw.trim() : '';
  if (id === null || !categoryName) return null;

  const fallback = fallbackOutfitLabels(categoryName);
  const label = (key: keyof OutfitCategoryLabels): string => {
    const v = r[key];
    return typeof v === 'string' && v.trim() ? v.trim() : fallback[key];
  };

  return {
    id,
    categoryName,
    labelKr: label('labelKr'),
    labelEn: label('labelEn'),
    labelJp: label('labelJp'),
    labelCh: label('labelCh'),
    labelVn: label('labelVn'),
    labelId: label('labelId'),
    labelTh: label('labelTh'),
    labelRu: label('labelRu'),
  };
}

/**
 * Gender for the AR request.
 *
 * An explicit `-F` / `-M` on the code wins — that is how the unisex categories
 * (global / K-Culture / New Outfit / uniforms) mark a variant. Otherwise it
 * comes from the category's `w=` / `m=` prefix, which is exactly how the old
 * folder-indexed catalogue stamped it (cat1/cat2 female, cat3/cat4 male).
 * Neither → undefined, and the AR request simply omits the field.
 */
function genderOf(categoryName: string, code: string): OutfitGender {
  if (/-F$/i.test(code)) return 'female';
  if (/-M$/i.test(code)) return 'male';
  const n = categoryName.toLowerCase();
  if (n.startsWith('w=')) return 'female';
  if (n.startsWith('m=')) return 'male';
  return undefined;
}

function normalizeOutfit(row: unknown): KioskOutfit | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;

  const id = typeof r['id'] === 'number' ? r['id'] : null;
  const code = typeof r['outfitCode'] === 'string' ? r['outfitCode'].trim() : '';
  const imageUrl = typeof r['imageUrl'] === 'string' ? r['imageUrl'].trim() : '';
  // Without a code there is nothing to send the AR API, and without an image
  // there is no card to tap. Either missing makes the row unusable.
  if (id === null || !code || !imageUrl) return null;

  // The endpoint documents ACTIVE-only, but it costs nothing to hold it to that.
  if (typeof r['status'] === 'string' && r['status'].toUpperCase() !== 'ACTIVE') return null;

  const categoryName = typeof r['categoryName'] === 'string' ? r['categoryName'].trim() : '';
  const rawType = typeof r['type'] === 'string' ? r['type'].toUpperCase() : 'NORMAL';
  const type =
    rawType === 'PREMIUM' || rawType === 'SCHOOL_UNIFORM'
      ? (rawType as KioskOutfit['type'])
      : 'NORMAL';

  return {
    id,
    code,
    imageUrl,
    categoryName,
    type,
    schoolId: typeof r['schoolId'] === 'number' ? r['schoolId'] : null,
    gender: genderOf(categoryName, code),
    kioskIds: Array.isArray(r['kioskIds'])
      ? (r['kioskIds'] as unknown[]).filter((k): k is number => typeof k === 'number')
      : [],
  };
}
