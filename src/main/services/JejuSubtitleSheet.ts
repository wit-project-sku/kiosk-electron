/**
 * 제주 VideoSubtitle tab → VideoEntry[] — SubtitleService's fallback source.
 *
 * ── Why a sheet at all ──────────────────────────────────────────────────────
 * Every other venue's second-monitor clip map comes from the CMS
 * (`/api/kiosks/{n}/subtitles`), and so does 제주's once its rows are
 * published. Until then the production endpoint answers 제주 (W006–W008) with
 * zero rows, and a customer display with no rows cannot follow the touch screen
 * at all: it falls back to the generic reel, which advances only when a clip
 * ends and reads as "the video switches late". The operators author those rows
 * in the 제주 content spreadsheet first anyway — the CMS was populated FROM this
 * tab on stage — so the tab is read at runtime, through the same service-account
 * Sheets access the translations already use, and used only while the API has
 * nothing.
 *
 * ── What comes out ──────────────────────────────────────────────────────────
 * Rows are emitted exactly as the CMS would carry them: the sheet's own
 * `Key (개발)` value (`Default-1`, `Greeting-2-1`, `To eat Market`, …) and the
 * video file stem. The display's `normalizeClipIndexKeys` already turns those
 * raw keys into the ones the screen map addresses, so a row reads the same
 * whichever source delivered it — nothing downstream knows or cares.
 *
 * Ported from the build-time generator this replaces (scripts/sync-sheet.mjs,
 * retired 2026-09-11), minus the key aliasing that now lives in the display.
 */
import type { KioskLayoutId } from '@shared/types/kiosk';
import type { SubtitleLangText, VideoEntry, VideoSet } from '@shared/types/subtitle';

/**
 * The VideoSubtitle tab each 제주 layout reads. W006 제주공항 and W007
 * 제주국제여객터미널 share JEJU_AIRPORT and one tab — each row is kept only where
 * its video file is on that machine (or where `비디오 폴더명` names that venue).
 * W008 has its own mascot and tab, which carries no file names yet, so it
 * yields nothing until one is filled in.
 */
export const JEJU_SUBTITLE_TABS: Partial<Record<KioskLayoutId, string>> = {
  JEJU_AIRPORT: 'VideoSubtitle_귤이',
  JEJU_HERITAGE: 'VideoSubtitle_Jeju_유산',
};

/** Sheet language header → app code. Resolved by name, so a reorder cannot scramble it. */
const SHEET_LANGS: Record<string, keyof SubtitleLangText> = {
  KR: 'ko', EN: 'en', JP: 'ja', CN: 'zh', VN: 'vi', ID: 'id', TH: 'th', RU: 'ru',
};

/** The sets a row may scope itself to via `비디오 폴더명 (운영)`. */
const JEJU_SETS: ReadonlySet<string> = new Set<VideoSet>(['jeju-airport', 'jeju-terminal', 'jeju-heritage']);

/** Trim, and fold the NBSPs spreadsheet cells pick up from pasted text. */
// Built from the code point: a literal NBSP in a regex trips no-irregular-whitespace.
const NBSP = new RegExp(String.fromCharCode(0xa0), 'g');
const clean = (v: unknown): string => String(v ?? '').replace(NBSP, ' ').trim();

interface LangCol {
  code: keyof SubtitleLangText;
  i: number;
}

interface Columns {
  key: number;
  fileDev: number;
  fileOps: number;
  folder: number;
  main: LangCol[];
  rightTop: LangCol[];
}

/**
 * Header row → column indices, BY NAME. Throws rather than guessing: every
 * failure here is otherwise silent — a missed 파일명 column yields rows with no
 * video (dropped, monitor stays on the generic reel) and a block slipped by one
 * puts the 우측상단 caption under every clip.
 */
function resolveColumns(header: readonly string[]): Columns {
  const at = (test: (h: string) => boolean): number => header.findIndex((h) => test(clean(h)));
  const key = at((h) => /^Key\b/i.test(h));
  const fileDev = at((h) => /파일명/.test(h) && /개발/.test(h));
  const fileOps = at((h) => /파일명/.test(h) && /운영/.test(h));
  const folder = at((h) => /폴더/.test(h));

  // The tab carries two language blocks in sheet order — the subtitle line,
  // then the 우측상단 label. The second block starts where a language repeats,
  // so a tab with fewer than eight languages still splits correctly.
  const main: LangCol[] = [];
  const rightTop: LangCol[] = [];
  header.forEach((raw, i) => {
    const code = SHEET_LANGS[clean(raw).toUpperCase()];
    if (!code) return;
    const block = rightTop.length > 0 || main.some((c) => c.code === code) ? rightTop : main;
    block.push({ code, i });
  });

  const missing: string[] = [];
  if (key < 0) missing.push('Key (개발)');
  if (fileDev < 0 && fileOps < 0) missing.push('파일명');
  if (!main.some((c) => c.code === 'ko')) missing.push('subtitle KR');
  if (missing.length > 0) {
    throw new Error(
      `could not locate [${missing.join(', ')}] by header name — the tab's header row ` +
        'changed; columns are never guessed by position',
    );
  }
  return { key, fileDev, fileOps, folder, main, rightTop };
}

/** One language block of a row. ko/en/ja/zh are always present (SubtitleLangText
 *  requires them); vi/th/ru/id only when filled. */
function langBlock(row: readonly string[], block: readonly LangCol[]): SubtitleLangText {
  const out: SubtitleLangText = { ko: '', en: '', ja: '', zh: '' };
  for (const { code, i } of block) {
    const v = clean(row[i]);
    if (v || code in out) out[code] = v;
  }
  return out;
}

/**
 * Parse a VideoSubtitle tab. The header is found by content (a `Key` and a
 * `파일명` column) within the first rows, because the tab opens with a banner
 * row above it. `noVideo` counts planned rows whose clip has no file yet — the
 * sheet doubles as the shooting backlog, so those are expected, not errors.
 */
export function parseJejuSubtitleSheet(
  rows: readonly (readonly string[])[],
): { entries: VideoEntry[]; noVideo: number } {
  const headerAt = rows
    .slice(0, 6)
    .findIndex((r) => r.some((c) => /^Key\b/i.test(clean(c))) && r.some((c) => /파일명/.test(clean(c))));
  if (headerAt < 0) throw new Error('no header row (a "Key" and a "파일명" column) in the first six rows');
  const cols = resolveColumns(rows[headerAt] ?? []);

  const entries: VideoEntry[] = [];
  let noVideo = 0;
  rows.slice(headerAt + 1).forEach((r, i) => {
    const key = clean(r[cols.key]);
    if (!key || /^Key\b/i.test(key)) return;
    // 운영 (the name the file actually ships under) wins over 개발 once filled.
    const named =
      (cols.fileOps >= 0 ? clean(r[cols.fileOps]) : '') || (cols.fileDev >= 0 ? clean(r[cols.fileDev]) : '');
    if (!named) {
      noVideo += 1;
      return;
    }
    const entry: VideoEntry = {
      key,
      // A folder prefix ("jeju/…") is dropped, as the API path drops it.
      file: named.slice(named.lastIndexOf('/') + 1),
      subtitle: langBlock(r, cols.main),
      label: langBlock(r, cols.rightTop),
      buttonId: null,
      sortOrder: i,
    };
    const folder = cols.folder >= 0 ? clean(r[cols.folder]) : '';
    if (JEJU_SETS.has(folder)) entry.set = folder as VideoSet;
    entries.push(entry);
  });
  return { entries, noVideo };
}
