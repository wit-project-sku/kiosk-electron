/**
 * Bundled outfit catalogue — the OFFLINE FALLBACK for the AR 한복체험 pickers.
 * The live catalogue (outfits AND tabs) comes from `GET /api/outfits` via
 * OutfitService/outfitStore on every layout now; these PNGs only stand in on a
 * kiosk that has never synced. Folder order matches outfitStore's
 * BUNDLED_CATEGORY_NAMES, which keys them like API content.
 *
 * The file stem is the outfit code sent to the AR API (e.g. "1.1", "10.2-F").
 */
const modules = import.meta.glob('./cat*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export type Gender = 'female' | 'male' | undefined;

export interface Outfit {
  code: string;
  url: string;
  gender: Gender;
}

/** Category index (0-7) → default gender. 5-8 are unisex (gender from -F/-M suffix). */
const CATEGORY_GENDER: Gender[] = ['female', 'female', 'male', 'male', undefined, undefined, undefined, undefined];

const catIndex = (path: string): number => {
  const m = path.match(/\/cat(\d)-/);
  return m ? Number(m[1]) - 1 : -1;
};
const codeOf = (path: string): string => path.split('/').pop()!.replace(/\.png$/i, '');

/** Natural sort so "1.10" follows "1.2", not "1.1". */
function naturalCmp(a: string, b: string): number {
  const ka = a.split(/(\d+)/).filter(Boolean);
  const kb = b.split(/(\d+)/).filter(Boolean);
  for (let i = 0; i < Math.max(ka.length, kb.length); i += 1) {
    const x = ka[i];
    const y = kb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn) {
      const d = Number(x) - Number(y);
      if (d !== 0) return d;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

const byCat: Outfit[][] = [[], [], [], [], [], [], [], []];
for (const [path, url] of Object.entries(modules)) {
  const idx = catIndex(path);
  if (idx < 0) continue;
  const code = codeOf(path);
  const gender: Gender = /-F$/i.test(code) ? 'female' : /-M$/i.test(code) ? 'male' : CATEGORY_GENDER[idx];
  byCat[idx]!.push({ code, url, gender });
}
for (const arr of byCat) arr.sort((a, b) => naturalCmp(a.code, b.code));

/** Outfits indexed by category (0-7), matching HanbokSelect's CATEGORIES order. */
export const OUTFITS_BY_CATEGORY: Outfit[][] = byCat;
