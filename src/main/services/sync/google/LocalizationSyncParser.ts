import type { KioskLayoutId, SupportedLanguage } from '@shared/types/kiosk';
import { createLogger } from '@main/core/logger';

const log = createLogger('localization-sync-parser');

/**
 * Column index of each language in the Localization tab. The first six columns
 * are shared (0 Num, 1 Key, 2 Korean, 3 English, 4 Japanese, 5 Chinese) but the
 * four newer languages sit in a DIFFERENT order per location's sheet, so the
 * column set is keyed by layout:
 *   Localization_Insa      → 6 Vietnamese, 7 Thai,       8 Russian, 9 Indonesian
 *   Localization_Osaek     → 6 Vietnamese, 7 Indonesian, 8 Thai,    9 Russian
 *   Localization_Hwaseong  → 6 Vietnamese, 7 Indonesian, 8 Thai,    9 Russian
 *   Localization_Jeju      → 6 Vietnamese, 7 Thai,       8 Russian, 9 Indonesian
 *                            (VERIFIED 2026-08-13 against the sheet's header row:
 *                            제주 follows the INSA order, not the newer template
 *                            this once assumed. Getting it wrong is silent — the
 *                            cells are all populated, so the kiosk simply shows
 *                            Thai text under Indonesian and so on.)
 */
const SHARED_COLS: Array<{ lang: SupportedLanguage; index: number }> = [
  { lang: 'ko', index: 2 },
  { lang: 'en', index: 3 },
  { lang: 'ja', index: 4 },
  { lang: 'zh', index: 5 },
];

const INSA_NEW: Array<{ lang: SupportedLanguage; index: number }> = [
  { lang: 'vi', index: 6 },
  { lang: 'th', index: 7 },
  { lang: 'ru', index: 8 },
  { lang: 'id', index: 9 },
];

const OSAEK_HWASEONG_NEW: Array<{ lang: SupportedLanguage; index: number }> = [
  { lang: 'vi', index: 6 },
  { lang: 'id', index: 7 },
  { lang: 'th', index: 8 },
  { lang: 'ru', index: 9 },
];

const NEW_LANG_COLS: Record<KioskLayoutId, Array<{ lang: SupportedLanguage; index: number }>> = {
  INSADONG: INSA_NEW,
  NAM_INSADONG: INSA_NEW,
  OSAN: OSAEK_HWASEONG_NEW,
  HWASEONG: OSAEK_HWASEONG_NEW,
  JEJU_AIRPORT: INSA_NEW,
};

/**
 * Layouts whose Localization tab is SHARED with another venue, and the mascot
 * names that tell the rows apart.
 *
 * Localization_Jeju serves 제주공항 / 여객선터미널 (하영) and 제주유산문화센터 (유산)
 * from one tab — the sheet is titled "#W6~8=제주_전체데이터" — so seven keys appear
 * twice. Without this, last-wins gives a W006 machine the 유산 rows and the kiosk
 * shows "안녕 '유산'", "도와줘 '유산'", "사진촬영 (with '유산')".
 *
 * The `설명, 비고` column looks like the obvious discriminator and is not usable:
 * it is SWAPPED on NoticeContent (the row marked 제주공항 carries YUSAN in all
 * seven translations) and ABSENT on SubButton_Greeting. It is also not a filter —
 * SubButton_Accommodation is marked 제주유산문화센터 and is the only row for its
 * key, so excluding by note would lose 숙박안내's subtitle. Mascot scoring is
 * both present and correct on every ambiguous key.
 *
 * Mirrored at build time in scripts/sync-sheet.mjs (jejuVenueScore) — keep both
 * in sync, or a fresh build and a synced kiosk disagree about the mascot.
 */
const VENUE_MASCOTS: Partial<Record<KioskLayoutId, { ours: RegExp; other: RegExp }>> = {
  JEJU_AIRPORT: { ours: /하영|HAYOUNG/i, other: /유산|YUSAN/i },
};

/**
 * Collapse rows that share a key down to this venue's row.
 *
 * Scored across the eight language cells: +1 per cell naming our mascot, −1 per
 * cell naming another venue's. Highest score wins and a tie keeps the LAST row,
 * so a key with one row — or with no mascot anywhere in it, like
 * MainButton_Promotion — comes through exactly as it would have.
 */
function pickVenueRows(rows: string[][], mascots: { ours: RegExp; other: RegExp }): string[][] {
  const best = new Map<string, { row: string[]; score: number }>();
  const order: string[] = [];

  for (const row of rows) {
    const key = (row[1] ?? '').trim();
    if (!key || key === 'Key') continue;

    let score = 0;
    for (let i = 2; i <= 9; i++) {
      const cell = row[i] ?? '';
      if (mascots.ours.test(cell)) score += 1;
      if (mascots.other.test(cell)) score -= 1;
    }

    const prev = best.get(key);
    if (!prev) order.push(key);
    if (prev && score < prev.score) continue;
    best.set(key, { row, score });
  }

  return order.map((key) => best.get(key)!.row);
}

export type LocalizationByLang = Partial<Record<SupportedLanguage, Record<string, string>>>;

/**
 * Parses a Localization tab into per-language `{ key: text }` maps. Header /
 * blank-key rows are skipped; empty cells are omitted (the renderer falls back
 * to Korean, then the key). Column layout for the four newer languages depends
 * on the kiosk layout — see NEW_LANG_COLS.
 */
export function parseLocalizationSheet(rows: string[][], layout: KioskLayoutId): LocalizationByLang {
  const cols = [...SHARED_COLS, ...NEW_LANG_COLS[layout]];
  const result: LocalizationByLang = {};
  for (const { lang } of cols) result[lang] = {};

  // Shared-tab layouts collapse to one row per key FIRST — see pickVenueRows.
  // Doing it here rather than inside the loop matters: the merge below skips
  // empty cells, so a 유산 row with a blank ja/zh would otherwise leave 하영's
  // translations in place and mix the two venues within a single key.
  const mascots = VENUE_MASCOTS[layout];
  const source = mascots ? pickVenueRows(rows, mascots) : rows;

  for (const row of source) {
    const key = (row[1] ?? '').trim();
    if (!key || key === 'Key') continue; // skip section/header rows

    for (const { lang, index } of cols) {
      const text = (row[index] ?? '').replace(/ /g, ' ').trim();
      if (text) result[lang]![key] = text;
    }
  }

  log.info('Parsed localization sheet', {
    layout,
    keys: Object.keys(result.ko ?? {}).length,
  });
  return result;
}
