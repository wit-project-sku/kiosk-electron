#!/usr/bin/env node
/**
 * Pulls the kiosk content Google Sheet and generates typed data modules.
 *
 *   npm run sync:sheet
 *
 * Tabs consumed (4-language subset: ko / en / ja / zh):
 *   Localization_Insa  → src/renderer/src/data/localization.generated.ts
 *   PalaceInfo_Insa    → src/renderer/src/data/palaces.generated.ts
 *   AICategory_Insa    → src/renderer/src/data/aiCategories.generated.ts
 *   (W004 오색시장: *_Osaek tabs;  W005 화성휴게소: *_Hwaseong tabs — separate sheets)
 *   NationwideMarkets (전국시장, own sheet) → src/.../nationwideMarkets.generated.ts
 *
 * NOTE: VideoSubtitle_* is NOT generated here. Subtitles are fetched live from
 * the witteria API (SubtitleService → /api/kiosks/{id}/subtitles) and cached in
 * SQLite — the API is their single source of truth, with no build-time fallback.
 *
 * Raw CSVs are cached under src/renderer/src/data/sheet-cache/ so the build
 * still works offline; pass --offline to regenerate from the cache only.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SHEET_ID = '1AVZoyepjrlWIUtwXamGRYU6TWkKKKgVb7fzwEtbRDaw';
/** W004 오산 오색시장 content sheet (tabs suffixed _Osaek). */
const OSAEK_SHEET_ID = '1_CkWFXfB7ud0sJw-cnIWGvFlTzF12UxDuNylp5HkOiw';
/** W005 화성휴게소 content sheet (tabs suffixed _Hwaseong). */
const HWASEONG_SHEET_ID = '14aWRWrJXPC_J-W4GpZqa_g-3fDjjUsy6BpAhDg8OvVU';
/** W006 제주공항 content sheet (tabs suffixed _Jeju).
 *  Tabs: ShopData_Jeju · AICategory_Jeju · Localization_Jeju ·
 *  VideoSubtitle_Jeju_하영 · VideoSubtitle_Jeju_유산 · three 규칙 reference tabs.
 *  Only the two middle tabs are generated here — ShopData is served by the shops
 *  API (kioskId=7) and VideoSubtitle by the subtitles API, same as every other
 *  location. Mirrored in the runtime sync
 *  (src/main/services/sync/GoogleSheetsSyncTransport.ts CONTENT_SHEETS). */
const JEJU_SHEET_ID = '1A90MnKneWksKeL2zEcCUn75JKbnMFj7-OBmQsTkI72I';
/** 전국시장 (nationwide markets) dataset — shared, used by 화성휴게소's 전국휴게소 screen. */
const NATIONWIDE_MARKETS_SHEET_ID = '1EGeS48JvN3YNzFDLiBduKW-t8P5ilSDucNIMUNS2M-4';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'src/renderer/src/data');
const CACHE_DIR = join(DATA_DIR, 'sheet-cache');
const OFFLINE = process.argv.includes('--offline');

const csvUrl = (sheet, sheetId = SHEET_ID) =>
  `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;

/** RFC-4180 CSV parser (handles quoted fields, escaped quotes, embedded newlines). */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

async function loadTab(sheet, sheetId = SHEET_ID) {
  const cacheFile = join(CACHE_DIR, `${sheet}.csv`);
  if (OFFLINE) return parseCSV(await readFile(cacheFile, 'utf8'));
  const res = await fetch(csvUrl(sheet, sheetId));
  if (!res.ok) throw new Error(`Fetch ${sheet} failed: HTTP ${res.status}`);
  const text = await res.text();
  await writeFile(cacheFile, text, 'utf8');
  return parseCSV(text);
}

const clean = (s) => (s ?? '').replace(/ /g, ' ').trim();
const langText = (ko, en, ja, zh) => ({ ko: clean(ko), en: clean(en), ja: clean(ja), zh: clean(zh) });
/** Strip a leading "12-" group/order prefix from a category label. */
const stripPrefix = (s) => clean(s).replace(/^\s*\d+\s*-\s*/, '');

/**
 * Localization tabs carry four newer languages after Chinese (col 5). Their
 * column order differs per location's sheet, so pass the right map:
 *   Localization_Insa      → vi 6, th 7, ru 8, id 9
 *   Localization_Osaek     → vi 6, id 7, th 8, ru 9
 *   Localization_Hwaseong  → vi 6, id 7, th 8, ru 9
 * Empty cells are dropped so entries stay small and the renderer falls back to
 * Korean (LangText's vi/th/ru/id are optional).
 */
const NEW_LANG_COLS_INSA = { vi: 6, th: 7, ru: 8, id: 9 };
const NEW_LANG_COLS_OSAEK = { vi: 6, id: 7, th: 8, ru: 9 };
const localizedRow = (r, newCols) => {
  const out = langText(r[2], r[3], r[4], r[5]);
  for (const [lang, idx] of Object.entries(newCols)) {
    const v = clean(r[idx]);
    if (v) out[lang] = v;
  }
  return out;
};

/**
 * Build an 8-language field. ko/en/ja/zh come from the four `base` columns and
 * are always emitted (even if blank); vi/th/ru/id are read from `newCols` and
 * emitted ONLY when their cell has a value.
 *
 * IMPORTANT — how to add the new languages to these sheets (palaces / AICategory
 * / NationwideMarkets): APPEND the vi/th/ru/id columns at the END of the row,
 * never inserted between existing columns. Appending keeps every existing column
 * index stable, so until you add them these generators produce byte-for-byte the
 * same 4-language output as before (the extra indices just read `undefined`).
 * The per-field trailing layout each generator expects is documented at its call
 * site below.
 */
const langTextExt = (r, base, newCols, xf = clean) => {
  const out = { ko: xf(r[base[0]]), en: xf(r[base[1]]), ja: xf(r[base[2]]), zh: xf(r[base[3]]) };
  for (const lang of ['vi', 'th', 'ru', 'id']) {
    const idx = newCols[lang];
    if (idx != null) {
      const v = xf(r[idx]);
      if (v) out[lang] = v;
    }
  }
  return out;
};

/** Trailing new-language column indices for a field: 4 consecutive cells at
 *  `start`, in vi, th, ru, id order. Used to append new langs after a sheet's
 *  existing 4-language block without disturbing any current column. */
const trail = (start) => ({ vi: start, th: start + 1, ru: start + 2, id: start + 3 });

/**
 * Locate vi/th/ru/id columns in a header row BY NAME. Used for single-field
 * sheets (AICategory) whose extra columns are ragged and inconsistent across
 * kiosks (e.g. AICategory_Osaek already fills cols 5-8 with Korean reference
 * data) — positional appending there is unsafe. A column counts only if its
 * header contains an unambiguous language name, so existing Korean/data columns
 * never match: this is collision-proof and a no-op until such columns exist.
 * To add the new languages, head each new column with its language, e.g.
 * "베트남어" / "Vietnamese", "태국어" / "Thai", "러시아어", "인도네시아어".
 */
const LANG_HEADER_MARKERS = {
  vi: /베트남|vietnam/i,
  th: /태국|thai/i,
  ru: /러시아|russ/i,
  id: /인도네시아|indonesia/i,
};
const findLangCols = (header) => {
  const out = {};
  header.forEach((h, i) => {
    for (const [lang, re] of Object.entries(LANG_HEADER_MARKERS)) {
      if (out[lang] == null && re.test(h || '')) out[lang] = i;
    }
  });
  return out;
};

const BANNER = '// AUTO-GENERATED by scripts/sync-sheet.mjs — do not edit by hand.\n// Run `npm run sync:sheet` to refresh from the Google Sheet.\n';

async function genLocalization() {
  const rows = await loadTab('Localization_Insa');
  // Columns: 0 Num, 1 Key, 2 Korean, 3 English, 4 Japanese, 5 Chinese, 6 Vietnamese, 7 Thai, 8 Russian, 9 Indonesian.
  const entries = {};
  for (const r of rows.slice(1)) {
    const key = clean(r[1]);
    if (!key || key === 'Key') continue;
    entries[key] = localizedRow(r, NEW_LANG_COLS_INSA);
  }
  const body = Object.entries(entries)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join('\n');
  const out = `${BANNER}import type { LangText } from './types';\n\n/** UI strings keyed by their sheet \`Key\`. */\nexport const LOCALIZATION: Record<string, LangText> = {\n${body}\n};\n`;
  await writeFile(join(DATA_DIR, 'localization.generated.ts'), out, 'utf8');
  return Object.keys(entries).length;
}

/**
 * PalaceInfo_Insa columns are resolved BY HEADER NAME, never by position.
 *
 * This sheet has already been restructured once (30 → 58 columns, with the four
 * new languages INTERLEAVED into every field instead of appended). Positional
 * reads survived that change silently and produced scrambled output — address.ko
 * holding the Vietnamese NAME, phone holding a paragraph of prose — because
 * nothing checks that column 5 is still "주소 (한국어)". Name lookup cannot
 * mis-align, and resolvePalaceCols() below turns any future reshuffle into a
 * loud build failure instead of corrupt content.
 *
 * Headers read "<field> (<language>)" with erratic spacing and the occasional
 * missing paren ("업무시간 (한국어"), so both sides match loosely on the label.
 */
const PALACE_FIELD_MARKERS = {
  name: /업체명/,
  address: /주소/,
  hashtag: /해쉬태그|해시태그/,
  info: /정보/,
  hours: /업무시간/,
  highlights: /볼거리/,
  admission: /입장료/,
};
const PALACE_LANG_MARKERS = {
  ko: /한국어/,
  en: /영어/,
  ja: /일어|일본어/,
  zh: /중국어/,
  vi: /베트남/,
  th: /태국/,
  ru: /러시아/,
  id: /인도네시아/,
};

/**
 * Header row → `{ cols: { name: { ko: 1, en: 2, … }, … }, phone }`.
 * A language with no column is simply absent, so a 4-language sheet still
 * produces 4-language output; ko/en/ja/zh and phone are REQUIRED and throw.
 */
function resolvePalaceCols(header) {
  const cols = {};
  for (const field of Object.keys(PALACE_FIELD_MARKERS)) cols[field] = {};
  let phone = null;

  header.forEach((raw, i) => {
    const h = clean(raw);
    if (!h) return;
    // 전화번호 first: it carries no language suffix and must not fall through.
    if (phone == null && /전화번호/.test(h)) {
      phone = i;
      return;
    }
    const field = Object.keys(PALACE_FIELD_MARKERS).find((f) => PALACE_FIELD_MARKERS[f].test(h));
    if (!field) return;
    const lang = Object.keys(PALACE_LANG_MARKERS).find((l) => PALACE_LANG_MARKERS[l].test(h));
    if (!lang || cols[field][lang] != null) return; // first column for a language wins
    cols[field][lang] = i;
  });

  const missing = [];
  for (const [field, map] of Object.entries(cols)) {
    for (const lang of ['ko', 'en', 'ja', 'zh']) if (map[lang] == null) missing.push(`${field}.${lang}`);
  }
  if (phone == null) missing.push('phone');
  if (missing.length > 0) {
    throw new Error(
      `PalaceInfo_Insa: could not locate [${missing.join(', ')}] by header name. The sheet's ` +
        `header row changed — update PALACE_FIELD_MARKERS / PALACE_LANG_MARKERS in ` +
        `scripts/sync-sheet.mjs. Do NOT fall back to column positions.`,
    );
  }
  return { cols, phone };
}

/** Build an 8-language field from a resolved `{ lang: columnIndex }` map. */
const langTextByCols = (r, map) => {
  const out = { ko: clean(r[map.ko]), en: clean(r[map.en]), ja: clean(r[map.ja]), zh: clean(r[map.zh]) };
  for (const lang of ['vi', 'th', 'ru', 'id']) {
    if (map[lang] == null) continue;
    const v = clean(r[map[lang]]);
    if (v) out[lang] = v;
  }
  return out;
};

async function genPalaces() {
  const rows = await loadTab('PalaceInfo_Insa');
  const { cols, phone } = resolvePalaceCols(rows[0] ?? []);
  const palaces = [];
  for (const r of rows.slice(1)) {
    if (!/^\d+$/.test(clean(r[0]))) continue; // data rows are numbered
    palaces.push({
      name: langTextByCols(r, cols.name),
      address: langTextByCols(r, cols.address),
      hashtag: langTextByCols(r, cols.hashtag),
      info: langTextByCols(r, cols.info),
      hours: langTextByCols(r, cols.hours),
      highlights: langTextByCols(r, cols.highlights),
      admission: langTextByCols(r, cols.admission),
      phone: clean(r[phone]),
    });
  }
  const body = palaces.map((p) => `  ${JSON.stringify(p)},`).join('\n');
  const out = `${BANNER}import type { LangText } from './types';\n\nexport interface PalaceData {\n  name: LangText;\n  address: LangText;\n  hashtag: LangText;\n  info: LangText;\n  hours: LangText;\n  highlights: LangText;\n  admission: LangText;\n  phone: string;\n}\n\n/** 고궁안내 — palace data (one entry per palace). */\nexport const PALACES: PalaceData[] = [\n${body}\n];\n`;
  await writeFile(join(DATA_DIR, 'palaces.generated.ts'), out, 'utf8');
  return palaces.length;
}

async function genAiCategories() {
  const rows = await loadTab('AICategory_Insa');
  // New langs detected by header name (add columns headed 베트남어/태국어/러시아어/
  // 인도네시아어 anywhere); ko/en/ja/zh stay at cols 1-4.
  const langCols = findLangCols(rows[0] ?? []);
  const cats = [];
  for (const r of rows.slice(1)) {
    if (!/^\d+$/.test(clean(r[0]))) continue;
    cats.push(langTextExt(r, [1, 2, 3, 4], langCols, stripPrefix));
  }
  const body = cats.map((c) => `  ${JSON.stringify(c)},`).join('\n');
  const out = `${BANNER}import type { LangText } from './types';\n\n/** '인사' 뭐하지 (AI검색) — 즐길거리 categories, prefix stripped. */\nexport const AI_CATEGORIES: LangText[] = [\n${body}\n];\n`;
  await writeFile(join(DATA_DIR, 'aiCategories.generated.ts'), out, 'utf8');
  return cats.length;
}

// ─── W004 오산 오색시장 (same column layout, _Osaek tabs, separate sheet) ───────
async function genLocalizationOsaek() {
  const rows = await loadTab('Localization_Osaek', OSAEK_SHEET_ID);
  // Columns: 0 No, 1 Key, 2 Korean, 3 English, 4 Japanese, 5 Chinese, 6 Vietnamese, 7 Indonesian, 8 Thai, 9 Russian.
  const entries = {};
  for (const r of rows.slice(1)) {
    const key = clean(r[1]);
    if (!key || key === 'Key') continue;
    entries[key] = localizedRow(r, NEW_LANG_COLS_OSAEK);
  }
  const body = Object.entries(entries)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join('\n');
  const out = `${BANNER}import type { LangText } from './types';\n\n/** W004 오색시장 UI strings keyed by their sheet \`Key\` (Localization_Osaek). */\nexport const LOCALIZATION_OSAEK: Record<string, LangText> = {\n${body}\n};\n`;
  await writeFile(join(DATA_DIR, 'localization-osaek.generated.ts'), out, 'utf8');
  return Object.keys(entries).length;
}

async function genAiCategoriesOsaek() {
  const rows = await loadTab('AICategory_Osaek', OSAEK_SHEET_ID);
  // Header-name detection: this sheet already uses cols 5-8 for Korean reference
  // data, so new-language columns must be found by name, not position.
  const langCols = findLangCols(rows[0] ?? []);
  const cats = [];
  for (const r of rows.slice(1)) {
    if (!/^\d+$/.test(clean(r[0]))) continue;
    const ko = stripPrefix(r[1]);
    if (!ko) continue; // skip numbered-but-blank rows so no nameless tiles render
    cats.push(langTextExt(r, [1, 2, 3, 4], langCols, stripPrefix));
  }
  const body = cats.map((c) => `  ${JSON.stringify(c)},`).join('\n');
  const out = `${BANNER}import type { LangText } from './types';\n\n/** W004 '정이' 모하지(AI검색) 즐길거리 categories, prefix stripped. */\nexport const AI_CATEGORIES_OSAEK: LangText[] = [\n${body}\n];\n`;
  await writeFile(join(DATA_DIR, 'aiCategories-osaek.generated.ts'), out, 'utf8');
  return cats.length;
}

// ─── W005 화성휴게소 (same column layout, _Hwaseong tabs, separate sheet) ───────
async function genLocalizationHwaseong() {
  const rows = await loadTab('Localization_Hwaseong', HWASEONG_SHEET_ID);
  // Columns: 0 Num, 1 Key, 2 Korean, 3 English, 4 Japanese, 5 Chinese, 6 Vietnamese, 7 Indonesian, 8 Thai, 9 Russian.
  const entries = {};
  for (const r of rows.slice(1)) {
    const key = clean(r[1]);
    if (!key || key === 'Key') continue;
    entries[key] = localizedRow(r, NEW_LANG_COLS_OSAEK);
  }
  const body = Object.entries(entries)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join('\n');
  const out = `${BANNER}import type { LangText } from './types';\n\n/** W005 화성휴게소 UI strings keyed by their sheet \`Key\` (Localization_Hwaseong). */\nexport const LOCALIZATION_HWASEONG: Record<string, LangText> = {\n${body}\n};\n`;
  await writeFile(join(DATA_DIR, 'localization-hwaseong.generated.ts'), out, 'utf8');
  return Object.keys(entries).length;
}

async function genAiCategoriesHwaseong() {
  const rows = await loadTab('AICategory_Hwaseong', HWASEONG_SHEET_ID);
  // Header-name detection: this sheet already uses cols 5-9 for Korean reference
  // data, so new-language columns must be found by name, not position.
  const langCols = findLangCols(rows[0] ?? []);
  const cats = [];
  for (const r of rows.slice(1)) {
    if (!/^\d+$/.test(clean(r[0]))) continue;
    const ko = stripPrefix(r[1]);
    if (!ko) continue; // skip numbered-but-blank rows so no nameless tiles render
    cats.push(langTextExt(r, [1, 2, 3, 4], langCols, stripPrefix));
  }
  const body = cats.map((c) => `  ${JSON.stringify(c)},`).join('\n');
  const out = `${BANNER}import type { LangText } from './types';\n\n/** W005 화성휴게소 모하지(AI검색) 즐길거리 categories, prefix stripped. */\nexport const AI_CATEGORIES_HWASEONG: LangText[] = [\n${body}\n];\n`;
  await writeFile(join(DATA_DIR, 'aiCategories-hwaseong.generated.ts'), out, 'utf8');
  return cats.length;
}

// ─── W006 제주공항 (separate sheet, _Jeju tabs) ────────────────────────
// VERIFIED 2026-08-13 against the real header row, which reads
//   Num · Key · Korean · English · Japanese · Chinese · Vietnamese · Thai ·
//   Russian · Indonesian · 설명,비고 · 구분(위치)
// — i.e. the INSA order (vi 6, th 7, ru 8, id 9), NOT the newer Osaek/Hwaseong
// one this originally assumed. Reading it as Osaek would have put Thai in the
// Indonesian slot, Russian in Thai's and Indonesian in Russian's, silently: every
// cell is non-empty, so nothing would have failed — the kiosk would just have
// shown the wrong language. Re-check this row before trusting any future edit.
//
// Row 0 is a title banner ("운영팀> 2번 모니터> 앱 콘텐츠 내용") and row 1 is the
// header; slice(1) drops the banner and the `key === 'Key'` guard drops the header.

/**
 * This ONE tab serves three venues — the sheet is titled "#W6~8=제주_전체데이터".
 * Seven keys therefore appear TWICE, once for 제주공항/여객선터미널 (mascot 하영)
 * and once for 제주유산문화센터 (mascot 유산): NoticeContent, MainButton_Greeting,
 * MainButton_ToHelp, SubButton_Greeting, Photo_SelectTogether, MainButton_Promotion
 * and SubButton_ToHelp. A plain last-wins loop hands W006 the 유산 rows, so the
 * kiosk renders "안녕 '유산'", "도와줘 '유산'" and "사진촬영 (with '유산')".
 *
 * Ties are broken on the MASCOT NAME, not the `설명, 비고` column, for two reasons:
 *   - the note is WRONG on NoticeContent — the row marked "제주공항, 여객선터미널에
 *     적용" carries YUSAN in all seven translations while the row marked
 *     "제주유산문화센터에 적용" carries HAYOUNG. Both Korean cells say HAYOUNG, the
 *     buttons CMS says 안녕 '하영', and the Figma agrees, so the notes are swapped
 *     on that key;
 *   - the note is ABSENT on SubButton_Greeting, whose two rows differ only by
 *     하영' 소개 / 유산' 소개.
 * The note is also NOT a filter: SubButton_Accommodation carries
 * "제주유산문화센터에 적용" and is the ONLY row for its key — dropping it would lose
 * 숙박안내's subtitle entirely. Hence disambiguation, never exclusion.
 *
 * Scored across all eight language cells: +1 per cell naming this venue's mascot,
 * −1 per cell naming another's. Highest score wins; a tie keeps the LAST row, so
 * every key with no mascot in it (MainButton_Promotion, and all 224 unique keys)
 * behaves exactly as before. Mirrored at runtime in
 * src/main/services/sync/google/LocalizationSyncParser.ts — keep the two in sync.
 */
const JEJU_MASCOT_OURS = /하영|HAYOUNG/i;
const JEJU_MASCOT_OTHER = /유산|YUSAN/i;

/** Venue score for one row — see the comment above. */
function jejuVenueScore(r) {
  let score = 0;
  for (let i = 2; i <= 9; i++) {
    const cell = r[i] ?? '';
    if (JEJU_MASCOT_OURS.test(cell)) score += 1;
    if (JEJU_MASCOT_OTHER.test(cell)) score -= 1;
  }
  return score;
}

async function genLocalizationJeju() {
  const rows = await loadTab('Localization_Jeju', JEJU_SHEET_ID);
  const entries = {};
  const scores = {};
  for (const r of rows.slice(1)) {
    const key = clean(r[1]);
    if (!key || key === 'Key') continue;
    const score = jejuVenueScore(r);
    // `>=` keeps last-wins on a tie, so single-row keys are untouched.
    if (key in entries && score < scores[key]) continue;
    entries[key] = localizedRow(r, NEW_LANG_COLS_INSA);
    scores[key] = score;
  }
  const body = Object.entries(entries)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join('\n');
  const out = `${BANNER}import type { LangText } from './types';

/** W006 제주공항 UI strings keyed by their sheet \`Key\` (Localization_Jeju). */
export const LOCALIZATION_JEJU: Record<string, LangText> = {
${body}
};
`;
  await writeFile(join(DATA_DIR, 'localization-jeju.generated.ts'), out, 'utf8');
  return Object.keys(entries).length;
}

async function genAiCategoriesJeju() {
  const rows = await loadTab('AICategory_Jeju', JEJU_SHEET_ID);
  const langCols = findLangCols(rows[0] ?? []);
  const cats = [];
  for (const r of rows.slice(1)) {
    if (!/^\d+$/.test(clean(r[0]))) continue;
    const ko = stripPrefix(r[1]);
    if (!ko) continue;
    cats.push(langTextExt(r, [1, 2, 3, 4], langCols, stripPrefix));
  }
  const body = cats.map((c) => `  ${JSON.stringify(c)},`).join('\n');
  const out = `${BANNER}import type { LangText } from './types';

/** W006 제주공항 AI검색 categories, prefix stripped. */
export const AI_CATEGORIES_JEJU: LangText[] = [
${body}
];
`;
  await writeFile(join(DATA_DIR, 'aiCategories-jeju.generated.ts'), out, 'utf8');
  return cats.length;
}

// ─── 전국시장 (nationwide markets) — single sheet, grouped by province ──────────
async function genNationwideMarkets() {
  // Cols: 0 Num, 1 사진여부, 2-5 name ko/en/jp/cn, 6-9 province, 10-13 district,
  //       14-17 address, 18-21 hashtag, 22-25 description, 26-29 openTime,
  //       30 tel, 31 naverLink.
  const rows = await loadTab('NationwideMarkets', NATIONWIDE_MARKETS_SHEET_ID);
  const markets = [];
  for (const r of rows.slice(1)) {
    if (!/^\d+$/.test(clean(r[0]))) continue; // data rows are numbered
    // New langs (vi/th/ru/id) APPENDED after naverLink (col 31), one 4-col block
    // per field: name 32-35, province 36-39, district 40-43, address 44-47,
    // hashtag 48-51, description 52-55, openTime 56-59. Each block is vi,th,ru,id.
    const name = langTextExt(r, [2, 3, 4, 5], trail(32));
    if (!name.ko) continue; // skip blank rows
    markets.push({
      name,
      province: langTextExt(r, [6, 7, 8, 9], trail(36)),
      district: langTextExt(r, [10, 11, 12, 13], trail(40)),
      address: langTextExt(r, [14, 15, 16, 17], trail(44)),
      hashtag: langTextExt(r, [18, 19, 20, 21], trail(48)),
      description: langTextExt(r, [22, 23, 24, 25], trail(52)),
      openTime: langTextExt(r, [26, 27, 28, 29], trail(56)),
      tel: clean(r[30]),
      naverLink: clean(r[31]),
    });
  }
  const body = markets.map((m) => `  ${JSON.stringify(m)},`).join('\n');
  const out = `${BANNER}import type { LangText } from './types';\n\nexport interface NationwideMarket {\n  name: LangText;\n  province: LangText;\n  district: LangText;\n  address: LangText;\n  hashtag: LangText;\n  description: LangText;\n  openTime: LangText;\n  tel: string;\n  naverLink: string;\n}\n\n/** 전국시장 — nationwide markets grouped by province (전국휴게소 screen). */\nexport const NATIONWIDE_MARKETS: NationwideMarket[] = [\n${body}\n];\n`;
  await writeFile(join(DATA_DIR, 'nationwideMarkets.generated.ts'), out, 'utf8');
  return markets.length;
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  const loc = await genLocalization();
  const palaces = await genPalaces();
  const cats = await genAiCategories();
  console.log(`✓ localization: ${loc} keys`);
  console.log(`✓ palaces:      ${palaces}`);
  console.log(`✓ aiCategories: ${cats}`);

  // W004 오산 오색시장 (separate sheet, _Osaek tabs)
  const locO = await genLocalizationOsaek();
  const catsO = await genAiCategoriesOsaek();
  console.log(`✓ [osaek] localization: ${locO} keys`);
  console.log(`✓ [osaek] aiCategories: ${catsO}`);

  // W005 화성휴게소 (separate sheet, _Hwaseong tabs)
  const locH = await genLocalizationHwaseong();
  const catsH = await genAiCategoriesHwaseong();
  console.log(`✓ [hwaseong] localization: ${locH} keys`);
  console.log(`✓ [hwaseong] aiCategories: ${catsH}`);

  // W006 제주공항 (separate sheet, _Jeju tabs) — skipped until the sheet exists.
  if (JEJU_SHEET_ID) {
    const locJ = await genLocalizationJeju();
    const catsJ = await genAiCategoriesJeju();
    console.log(`✓ [jeju] localization: ${locJ} keys`);
    console.log(`✓ [jeju] aiCategories: ${catsJ}`);
  } else {
    console.log('– [jeju] skipped (JEJU_SHEET_ID not set)');
  }

  // 전국시장 (nationwide markets, single shared sheet)
  const markets = await genNationwideMarkets();
  console.log(`✓ nationwideMarkets: ${markets}`);
  console.log(OFFLINE ? '(offline: regenerated from cache)' : '(synced from Google Sheets)');
}

main().catch((e) => {
  console.error('sync-sheet failed:', e.message);
  process.exit(1);
});
