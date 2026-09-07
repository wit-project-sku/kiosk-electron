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
  JEJU_HERITAGE: INSA_NEW, // same Localization_Jeju tab, same column order
  // KADA W202 has no Localization tab at all (see CONTENT_SHEETS), so there are
  // no extra language columns to map. The parser never runs for this layout —
  // the transport skips it on the empty sheetId — and an empty list keeps that
  // true by construction rather than by borrowing another venue's column order.
  KADA: [],
};

/**
 * Layouts whose Localization tab is SHARED with another venue, and the mascot
 * names that tell the rows apart.
 *
 * Localization_Jeju serves 제주국제공항 W006 / 제주국제여객터미널 W007 (both mascot
 * 하영) and 세계자연유산본부 W008 (mascot 유산) from one tab — the sheet is titled
 * "#W6~8=제주_전체데이터" — so seven keys appear twice. Without this, last-wins gives
 * a 하영 machine the 유산 rows and the kiosk shows "안녕 '유산'", "도와줘 '유산'",
 * "사진촬영 (with '유산')".
 *
 * The scoring is keyed by LAYOUT, so W006 and W007 are covered by the one
 * JEJU_AIRPORT entry — they are the same venue as far as this sheet is concerned.
 * JEJU_HERITAGE (W008) is the same tab with the mascots the other way round —
 * that asymmetry is the whole reason W008 has its own layout id.
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
interface VenueMascots {
  ours: RegExp;
  other: RegExp;
  /**
   * Other-mascot HANGUL spelling → ours. Replaced only next to a quote or as a
   * whole cell — 유산 is also an ordinary noun ("세계자연유산", "인류무형문화유산"),
   * and a blanket swap turns those into "자연하영" / "인류무형문화하영".
   */
  renameKo: readonly [from: string, to: string];
  /**
   * The same name in the scripts where it is unambiguous — no Korean word
   * contains HAYOUNG / YUSAN / ハヨン / ユサン / Хаён / Юсан — so these are
   * replaced wherever they appear, preserving the sample's capitalisation.
   */
  rename: ReadonlyArray<readonly [from: string, to: string]>;
}

/** Quote and bracket characters the sheet wraps the mascot's name in. */
const QUOTED = String.raw`['\u2018\u2019"\u201C\u201D()\[\]\u300C\u300D\u300E\u300F]`;

const VENUE_MASCOTS: Partial<Record<KioskLayoutId, VenueMascots>> = {
  JEJU_AIRPORT: {
    ours: /하영|HAYOUNG/i,
    other: /유산|YUSAN/i,
    renameKo: ['유산', '하영'],
    rename: [
      ['YUSAN', 'HAYOUNG'],
      ['ユサン', 'ハヨン'],
      ['Юсан', 'Хаён'],
    ],
  },
  JEJU_HERITAGE: {
    ours: /유산|YUSAN/i,
    other: /하영|HAYOUNG/i,
    renameKo: ['하영', '유산'],
    rename: [
      ['HAYOUNG', 'YUSAN'],
      ['ハヨン', 'ユサン'],
      ['Хаён', 'Юсан'],
    ],
  },
};

/** Re-case `replacement` the way `sample` is cased (ALL CAPS / Title / lower).
 *  Korean and katakana are caseless, so every branch returns them unchanged. */
function matchCase(sample: string, replacement: string): string {
  if (sample !== sample.toLowerCase() && sample === sample.toUpperCase()) return replacement.toUpperCase();
  if (sample.slice(1) === sample.slice(1).toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
  }
  return replacement.toLowerCase();
}

/**
 * Rewrite the OTHER venue's mascot name to this venue's, inside a row the
 * tie-break has already assigned to us.
 *
 * Picking the right ROW is not enough, because the sheet's rows are copy-pasted
 * and then only partly re-worded. Measured on 2026-08-24, the 유산-marked rows
 * still say HAYOUNG in 18 cells: every non-Korean cell of MainButton_Greeting
 * ("Hello 'HAYOUNG'"), three of MainButton_ToHelp, and ALL EIGHT of
 * NoticeContent — whose Korean names HAYOUNG on both rows, so 제주공항 shows it
 * too. Without this a W008 kiosk headed 안녕 '유산' greets its visitors in
 * English as "Hello 'HAYOUNG'".
 *
 * Scoped by construction rather than by a key list: on a 유산 kiosk the string
 * 하영 should never appear at all, and vice versa. It is also self-healing —
 * once the operators correct the sheet there is nothing left to match, so this
 * becomes a no-op rather than something to remember to remove.
 */
function renameMascot(text: string, mascots: VenueMascots): string {
  if (!text || !mascots.other.test(text)) return text;

  let out = text;
  for (const [from, to] of mascots.rename) {
    out = out.replace(new RegExp(from, 'gi'), (m) => matchCase(m, to));
  }

  // Hangul: the whole cell (Greeting_NameContent is a bare "하영"), or an
  // occurrence touching a quote — "안녕 '하영'", "하영' 소개", "마스코트 '하영'를".
  // Anything else is an ordinary word that happens to contain 유산.
  const [koFrom, koTo] = mascots.renameKo;
  if (out.trim() === koFrom) return koTo;
  return out.replace(new RegExp('(?<=' + QUOTED + ')' + koFrom + '|' + koFrom + '(?=' + QUOTED + ')', 'g'), koTo);
}

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
      const raw = (row[index] ?? '').replace(/ /g, ' ').trim();
      // Correct any residual other-venue mascot name — see renameMascot.
      const text = mascots ? renameMascot(raw, mascots) : raw;
      if (text) result[lang]![key] = text;
    }
  }

  log.info('Parsed localization sheet', {
    layout,
    keys: Object.keys(result.ko ?? {}).length,
  });
  return result;
}
