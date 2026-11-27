/**
 * FacilityData_* (롯데 시설안내 · 화장실), read at launch rather than only at build time. Mirrors
 * genFacilitiesLotte in scripts/sync-sheet.mjs, which produces the copy bundled with the app —
 * change one, change the other.
 *
 * Columns are found by their header names (`ShopName_Kr` …), and the header row is looked for
 * rather than assumed: the Sheets API returns the title row above it, which the build's CSV
 * export folds away. Returns [] when the header is not found, so a renamed or rebuilt tab leaves
 * the kiosk on its last good copy instead of shifted columns.
 */
import type { LotteFacility, LotteText } from '@shared/types/lotteSheet';

type Row = readonly (string | undefined)[];

const clean = (s: string | undefined): string => (s ?? '').replace(/\u00a0/g, ' ').trim();

/** Sheet suffix → app language. */
const SUFFIX: ReadonlyArray<[keyof LotteText, string]> = [
  ['ko', 'Kr'],
  ['en', 'En'],
  ['ja', 'Jp'],
  ['zh', 'Ch'],
  ['vi', 'Vn'],
  ['th', 'Th'],
  ['ru', 'Ru'],
  ['id', 'Id'],
];

export function parseLotteFacilities(rows: readonly Row[]): LotteFacility[] {
  const headerAt = rows.findIndex((r) => r.some((c) => clean(c) === 'ShopName_Kr'));
  if (headerAt < 0) return [];
  const col = new Map<string, number>();
  rows[headerAt]!.forEach((cell, i) => {
    const name = clean(cell);
    if (name && !col.has(name)) col.set(name, i);
  });
  // An export that types ShopID as numbers drops its header (gviz does); it is the first column.
  if (!col.has('ShopID')) col.set('ShopID', 0);

  const cell = (r: Row, header: string): string => {
    const i = col.get(header);
    return i == null ? '' : clean(r[i]);
  };
  const text = (r: Row, field: string): LotteText => {
    const out = {} as LotteText;
    for (const [lang, suffix] of SUFFIX) out[lang] = cell(r, `${field}_${suffix}`);
    return out;
  };

  const out: LotteFacility[] = [];
  for (const r of rows.slice(headerAt + 1)) {
    const no = cell(r, 'NO');
    const parts = no.split('=');
    const id = Number(cell(r, 'ShopID'));
    // Data rows only: the 'Default' marker row and section rows have no 'site=group=nn' NO.
    if (parts.length !== 3 || !Number.isFinite(id) || !cell(r, 'ShopName_Kr')) continue;
    out.push({
      id,
      no,
      group: parts[1]!.trim(),
      name: text(r, 'ShopName'),
      category: text(r, 'BaseCategory'),
      location: text(r, 'Location'),
      hours: cell(r, 'OpeningHours_Kr'),
      tel: cell(r, 'PhoneNumber_Kr'),
      description: text(r, 'Description'),
    });
  }
  return out;
}
