/**
 * AICategory_Jeju and AirportFacilityData_Jeju, read at launch rather than only
 * at build time. These mirror genAiCategoriesJeju and genAirportFacilitiesJeju in
 * scripts/sync-sheet.mjs, which produce the copies bundled with the app — change
 * one, change the other.
 *
 * Both tabs keep a title row above the header, which the Sheets API returns and
 * the build's CSV export folds away, so the header is looked for rather than
 * assumed to be row 0. Both return [] when it is not found: a renamed or rebuilt
 * tab must leave the kiosk on its last good data, not on shifted columns.
 */
type Row = readonly (string | undefined)[];
type Text = Record<string, string>;

const clean = (s: string | undefined): string => (s ?? '').replace(/\u00a0/g, ' ').trim();
/** Strip a leading "12-" group/order prefix from a category label. */
const stripPrefix = (s: string | undefined): string => clean(s).replace(/^\s*\d+\s*-\s*/, '');

const LANG_HEADER_MARKERS: Record<string, RegExp> = {
  vi: /베트남|vietnam/i,
  th: /태국|thai/i,
  ru: /러시아|russ/i,
  id: /인도네시아|indonesia/i,
};

export function parseJejuAiCategories(rows: readonly Row[]): Text[] {
  const markers = Object.values(LANG_HEADER_MARKERS);
  const headerAt = rows.findIndex((r) => r.some((cell) => markers.some((m) => m.test(cell ?? ''))));
  if (headerAt < 0) return [];
  const header = rows[headerAt]!;
  const cols: Record<string, number> = {};
  header.forEach((cell, i) => {
    for (const [lang, marker] of Object.entries(LANG_HEADER_MARKERS)) {
      if (cols[lang] == null && marker.test(cell ?? '')) cols[lang] = i;
    }
  });

  const out: Text[] = [];
  for (const r of rows.slice(headerAt + 1)) {
    if (!/^\d+$/.test(clean(r[0]))) continue;
    const ko = stripPrefix(r[1]);
    if (!ko) continue;
    const text: Text = { ko, en: stripPrefix(r[2]), ja: stripPrefix(r[3]), zh: stripPrefix(r[4]) };
    for (const lang of ['vi', 'th', 'ru', 'id']) {
      const index = cols[lang];
      const value = index == null ? '' : stripPrefix(r[index]);
      if (value) text[lang] = value;
    }
    out.push(text);
  }
  return out;
}

const JEJU_TERMINALS: Record<string, string> = { 국내선: 'domestic', 국제선: 'international' };

/** Eight consecutive language cells starting at `start`, in sheet order. */
function lang8(r: Row, start: number): Text {
  const out: Text = {
    ko: clean(r[start]),
    en: clean(r[start + 1]),
    ja: clean(r[start + 2]),
    zh: clean(r[start + 3]),
  };
  ['vi', 'th', 'ru', 'id'].forEach((lang, i) => {
    const value = clean(r[start + 4 + i]);
    if (value) out[lang] = value;
  });
  return out;
}

export interface ParsedFacility {
  terminal: string;
  floor: string;
  name: Text;
  category: Text;
  location: Text;
  openTime: string;
  tel: string;
  mainProduct: Text;
}

/** Columns: see the note on genAirportFacilitiesJeju. */
export function parseJejuAirportFacilities(rows: readonly Row[]): ParsedFacility[] {
  const headerAt = rows.findIndex((r) => clean(r[2]) === 'ShopName_Kr');
  if (headerAt < 0) return [];

  const out: ParsedFacility[] = [];
  for (const r of rows.slice(headerAt + 1)) {
    const name = lang8(r, 2);
    if (!name['ko']) continue; // blank row

    // A row with no readable terminal is dropped: filed on the wrong plan it would
    // be worse than missing. An empty floor is kept, for the chip catalog only.
    const terminal = JEJU_TERMINALS[clean(r[1]).split('=')[1] ?? ''];
    if (!terminal) continue;
    const location = lang8(r, 18);
    const floor = (location['ko']!.match(/^(\d)F/) ?? [])[1];

    out.push({
      terminal,
      floor: floor ? `${floor}F` : '',
      name,
      category: lang8(r, 10),
      location,
      openTime: clean(r[26]),
      tel: clean(r[27]),
      mainProduct: lang8(r, 28),
    });
  }
  return out;
}
