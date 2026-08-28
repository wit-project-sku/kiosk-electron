import type {
  KioskOutfit,
  OutfitCategory,
  OutfitCategoryLabels,
  OutfitGender,
  OutfitSubCategory,
} from '@shared/types/outfit';
import { fallbackOutfitLabels, uniformOutfitLabels } from '@shared/constants/outfitCategories';
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
 *   GET /api/outfits/categories               → { data: [ { id, categoryName,
 *                                                 label*, sortOrder, subCategories } ] }
 *
 * ── The tab list is CMS content ───────────────────────────────────────
 * `GET /api/outfits/categories` is what the picker draws its tabs from: one tab
 * per row, in registration order, labelled in eight languages by the operator.
 * Renaming a tab is an admin action rather than a release, which is why nothing
 * downstream may re-label a category locally.
 *
 * It used to 401 on prod (2026-08-14), which is why the pre-label
 * `GET /api/categories/outfits` is still tried second: same rows, `{id,name}`
 * only, labels filled from `shared/constants/outfitCategories`. Re-checked
 * 2026-08-25 — prod now answers 200 with no token, so that second attempt is
 * unreachable in practice.
 *
 * ── Two shapes are in the field at once ───────────────────────────────
 * Prod and stage do NOT agree today (both checked 2026-08-25), and the fleet
 * runs against prod, so every field below is read defensively:
 *
 *   prod    10 flat rows, NO sortOrder and NO subCategories; the gender-split
 *           codes intact (`w=hannbok` / `m=hanbok` / `m=everyday`); ids 1…9,12.
 *   stage    9 rows WITH both; the gender-split pairs merged into `hanbok` and
 *           `daily` carrying 남자·여자 chips; `w=model` retired, `ComeUp` added;
 *           ids in no useful order (76, 77, 9, 78, 5…) against sortOrder 1…9.
 *
 * A missing sortOrder falls back to the row's position and a missing
 * subCategories to an empty array, so one code path draws both: prod keeps the
 * flat row it sends today and gains chips the day it starts sending them.
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

  /**
   * Append `kioskId` to an endpoint, respecting a query string it may already
   * have (both URLs are env-overridable, and an override may carry one).
   *
   * Passing it is what makes the server do the work this class used to do
   * badly: it returns only outfits ASSIGNED to this kiosk AND inside their
   * operating period, and only categories that actually have one — so an event
   * category stops arriving as an empty tab once its run ends. The client-side
   * filter in list() stays as a backstop for an override that drops the param.
   */
  private withKioskId(url: string): string {
    return `${url}${url.includes('?') ? '&' : '?'}kioskId=${this.kiosk.kioskNum()}`;
  }

  /** Cached outfits for THIS kiosk. Empty until the first successful refresh. */
  list(): KioskOutfit[] {
    const rows = this.cache.get(CACHE_KEY)?.data?.['outfits'];
    if (!Array.isArray(rows)) return [];
    const kioskNum = this.kiosk.kioskNum();
    // Belt and braces: the fetch now sends `kioskId`, so the server has already
    // dropped anything not assigned here (and anything outside its operating
    // period, which this filter cannot see). This still runs because
    // OUTFITS_API_URL can override the endpoint with one that drops the param.
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
      const url = this.withKioskId(`${this.outfitsUrl()}?pageNum=${page}&pageSize=${PAGE_SIZE}`);
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
    for (const url of [this.withKioskId(this.categoriesUrl()), this.legacyCategoriesUrl()]) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data?: unknown };
        const rows = Array.isArray(json.data) ? json.data : [];
        const categories = rows
          .map((row, i) => normalizeCategory(row, i))
          .filter((c): c is OutfitCategory => c !== null)
          // The array happens to arrive in sortOrder today, but the FIELD is
          // the operator's stated order and the array position is not, so the
          // row order is taken from it rather than assumed. sort() is stable,
          // and the substituted index (see normalizeCategory) makes this a
          // no-op on a response that carries no sortOrder at all.
          .sort((a, b) => a.sortOrder - b.sortOrder);
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
function normalizeCategory(row: unknown, index: number): OutfitCategory | null {
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

  // No sortOrder → the row's own position, so an endpoint that carries none
  // keeps exactly the order it sent. Ordering by `id` would NOT: the newer
  // catalogue numbers its tabs 76, 77, 9, 78, 5… against sortOrder 1…9.
  const sortOrder = typeof r['sortOrder'] === 'number' ? r['sortOrder'] : index;

  const subRows = Array.isArray(r['subCategories']) ? (r['subCategories'] as unknown[]) : [];
  const subCategories = subRows
    .map((sub, i) => normalizeSubCategory(sub, i))
    .filter((c): c is OutfitSubCategory => c !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    id,
    categoryName,
    sortOrder,
    subCategories,
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
 * One chip under a tab.
 *
 * A sub-category has no code to fall back on the way a category does — the id
 * is the key and the labels are the whole display — so a row without a Korean
 * label is dropped rather than drawn blank. The other seven fall back to the
 * Korean one, which is the same rule the server documents for a blank label.
 */
function normalizeSubCategory(row: unknown, index: number): OutfitSubCategory | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;

  const id = typeof r['id'] === 'number' ? r['id'] : null;
  const labelKr = typeof r['labelKr'] === 'string' ? r['labelKr'].trim() : '';
  if (id === null || !labelKr) return null;

  const label = (key: keyof OutfitCategoryLabels): string => {
    const v = r[key];
    return typeof v === 'string' && v.trim() ? v.trim() : labelKr;
  };

  return {
    id,
    sortOrder: typeof r['sortOrder'] === 'number' ? r['sortOrder'] : index,
    labelKr,
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
 * Gender for the AR request, from whichever of the three signals is present.
 *
 * An explicit `-F` / `-M` on the code wins — that is how the unisex categories
 * (global / K-Culture / 직업의상 / uniforms) mark a variant.
 *
 * ★ Then the SUB-CATEGORY, because on the newer catalogue it is the only thing
 * left. The gender-split categories were merged there (`w=hannbok` + `m=hanbok`
 * → one `hanbok` with 남자/여자 chips, `m=everyday` → `daily`), so the `w=` /
 * `m=` prefix is gone AND those codes carry no suffix: checked 2026-08-25, all
 * 36 outfits under 한복 and 일상의상 would come out genderless without this.
 *
 * The prefix stays last for the older catalogue, where it is how the whole
 * folder-indexed bundle stamped gender (cat1/cat2 female, cat3/cat4 male). The
 * two never coexist on one row, so the order between them is not load-bearing.
 * None of the three → undefined, and the AR request simply omits the field.
 */
function genderOf(categoryName: string, code: string, subLabelKr: string | null): OutfitGender {
  if (/-F$/i.test(code)) return 'female';
  if (/-M$/i.test(code)) return 'male';
  // Matched on the Korean label because that is the field the API sends
  // (`subCategoryLabelKr`); the localized ones are display-only.
  if (subLabelKr === '여자') return 'female';
  if (subLabelKr === '남자') return 'male';
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
  const name = typeof r['name'] === 'string' ? r['name'].trim() : '';
  const subLabel = typeof r['subCategoryLabelKr'] === 'string' ? r['subCategoryLabelKr'].trim() : '';

  /*
   * The card's caption, one per language — what the 2026-08-27 redraw hangs
   * under the plate (Figma 6530:10487).
   *
   * ★ `label*`, NOT `name`. `name` is the operator's filing slug ("global_5.7")
   * and reads as one in every language; the labels are the garment's actual
   * name, translated in the admin web (사라판 / Sarafan / Сарафан). Only stage
   * sends them today — prod's outfit rows carry `name` and no labels at all —
   * so the slug, then the AR code, stand in until prod catches up. Never
   * `fallbackOutfitLabels`: that table is keyed by CATEGORY code and would
   * caption an outfit slugged "global" with the 글로벌 tab's name.
   */
  const labels = uniformOutfitLabels(name || code);
  const label = (key: keyof OutfitCategoryLabels): string => {
    const v = r[key];
    return typeof v === 'string' && v.trim() ? v.trim() : labels[key];
  };
  const subCategoryLabelKr = subLabel || null;
  const rawType = typeof r['type'] === 'string' ? r['type'].toUpperCase() : 'NORMAL';
  const type =
    rawType === 'PREMIUM' || rawType === 'SCHOOL_UNIFORM'
      ? (rawType as KioskOutfit['type'])
      : 'NORMAL';

  return {
    id,
    code,
    imageUrl,
    name,
    labelKr: label('labelKr'),
    labelEn: label('labelEn'),
    labelJp: label('labelJp'),
    labelCh: label('labelCh'),
    labelVn: label('labelVn'),
    labelId: label('labelId'),
    labelTh: label('labelTh'),
    labelRu: label('labelRu'),
    categoryName,
    categoryId: typeof r['categoryId'] === 'number' ? r['categoryId'] : null,
    subCategoryId: typeof r['subCategoryId'] === 'number' ? r['subCategoryId'] : null,
    subCategoryLabelKr,
    type,
    schoolId: typeof r['schoolId'] === 'number' ? r['schoolId'] : null,
    gender: genderOf(categoryName, code, subCategoryLabelKr),
    kioskIds: Array.isArray(r['kioskIds'])
      ? (r['kioskIds'] as unknown[]).filter((k): k is number => typeof k === 'number')
      : [],
  };
}
