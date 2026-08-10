import type { Shop, ShopImage } from '@shared/types/shop';
import { createLogger } from '@main/core/logger';

const log = createLogger('shop-normalize');

/**
 * Makes the witteria shops payload actually match the `Shop` type before it can
 * reach the renderer.
 *
 * The API sends `null` for text fields the type declares as plain `string` —
 * measured on production: 32 of 814 rows on kiosk 1 and 7 of 281 on kiosk 4 have
 * a null `addressKr`, plus scattered nulls in `hashTagKr` / `descriptionKr` /
 * `shopNameKr`. TypeScript can't catch it (the payload is cast, never checked),
 * so the null travels all the way to a render and takes the screen down:
 * `SpotDetailCard` does `data.address.trim()`, which throws on the five 뭐먹지
 * shops at 오색시장 whose address is null — a white screen on tap.
 *
 * Sanitizing HERE rather than at each render site is deliberate: there is one
 * entry point for this data and roughly a dozen screens reading it, and the next
 * screen someone writes will not remember to guard. Fields the type declares as
 * `string | null` (baseCategory / secondCategory / aiCategory / openTime / tel /
 * naverLink / naverRating) are left alone — their null is meaningful and the
 * filters compare against it.
 */

/** Bases whose per-language variants are declared as plain `string`. */
const TEXT_BASES = ['shopName', 'address', 'hashTag', 'description'] as const;
/** Language suffixes on those fields. Kr..Ch are required, Vn..Ru optional. */
const SUFFIXES = ['Kr', 'En', 'Jp', 'Ch', 'Vn', 'Id', 'Th', 'Ru'] as const;

const TEXT_FIELDS: string[] = TEXT_BASES.flatMap((b) => SUFFIXES.map((s) => `${b}${s}`));

export interface NormalizeReport {
  /** How many rows needed at least one repair. */
  repaired: number;
  /** `fieldName` → number of rows where it was null/absent/not a string. */
  fields: Record<string, number>;
  /** Rows dropped because they carry no usable identity. */
  dropped: number;
}

/**
 * Coerce one row. Returns null when the row has no usable identity — an object
 * with no numeric id can't be keyed in a list or stored in detailStore, and
 * rendering it produces a blank card nobody can act on.
 */
function normalizeOne(raw: unknown, report: NormalizeReport): Shop | null {
  if (!raw || typeof raw !== 'object') {
    report.dropped++;
    return null;
  }
  const s = { ...(raw as Record<string, unknown>) };

  if (typeof s['id'] !== 'number') {
    report.dropped++;
    return null;
  }

  let touched = false;

  for (const key of TEXT_FIELDS) {
    // Absent optional languages stay absent: `field()` falls back to Korean via
    // `||`, and writing '' would be indistinguishable anyway. Only a PRESENT
    // non-string (i.e. null) is a lie about the type, so only that is repaired.
    if (key in s && typeof s[key] !== 'string') {
      s[key] = '';
      report.fields[key] = (report.fields[key] ?? 0) + 1;
      touched = true;
    }
  }

  // `no` is declared `string` and is used as a display/order value.
  if (typeof s['no'] !== 'string') {
    s['no'] = s['no'] == null ? '' : String(s['no']);
    report.fields['no'] = (report.fields['no'] ?? 0) + 1;
    touched = true;
  }

  // `images` is spread (`[...s.images]`) in shopImages/prefetchShopThumbnails —
  // a null or object here is an immediate "is not iterable" throw.
  const images = s['images'];
  if (!Array.isArray(images)) {
    s['images'] = [];
    report.fields['images'] = (report.fields['images'] ?? 0) + 1;
    touched = true;
  } else {
    const clean: ShopImage[] = [];
    let imgTouched = false;
    for (const entry of images) {
      const im = entry as Partial<ShopImage> | null;
      if (!im || typeof im.imageUrl !== 'string' || !im.imageUrl) {
        imgTouched = true; // a blank <img src> renders a broken-image glyph
        continue;
      }
      clean.push({
        id: typeof im.id === 'number' ? im.id : 0,
        imageUrl: im.imageUrl,
        // sortOrder feeds a comparator; NaN there makes the sort order arbitrary.
        sortOrder: typeof im.sortOrder === 'number' && Number.isFinite(im.sortOrder) ? im.sortOrder : 0,
      });
    }
    if (imgTouched) {
      s['images'] = clean;
      report.fields['images.entry'] = (report.fields['images.entry'] ?? 0) + 1;
      touched = true;
    }
  }

  if (touched) report.repaired++;
  return s as unknown as Shop;
}

/**
 * Normalize a whole payload. `context` only labels the log line.
 * Pass `quiet` for the cache-read path so startup doesn't re-log what the
 * fetch already reported.
 */
export function normalizeShops(
  raw: unknown[],
  context: string,
  quiet = false,
): { shops: Shop[]; report: NormalizeReport } {
  const report: NormalizeReport = { repaired: 0, fields: {}, dropped: 0 };
  const shops: Shop[] = [];
  for (const row of raw) {
    const shop = normalizeOne(row, report);
    if (shop) shops.push(shop);
  }

  if (!quiet && (report.repaired > 0 || report.dropped > 0)) {
    // Logged at warn so a data regression upstream is visible in kiosk logs
    // instead of only showing up as a crash report from the field.
    log.warn('Shop payload did not match its contract', {
      context,
      total: raw.length,
      repaired: report.repaired,
      dropped: report.dropped,
      fields: report.fields,
    });
  }
  return { shops, report };
}
