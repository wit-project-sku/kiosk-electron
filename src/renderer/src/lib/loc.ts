import type { Lang } from '@renderer/lib/i18n';
import { toLocalizedLang, type LocalizedLang } from '@shared/config/languages';
import { LOCALIZATION } from '@renderer/data/localization.generated';
import { LOCALIZATION_OSAEK } from '@renderer/data/localization-osaek.generated';
import { LOCALIZATION_HWASEONG } from '@renderer/data/localization-hwaseong.generated';
import { LOCALIZATION_JEJU } from '@renderer/data/localization-jeju.generated';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { useKioskStore } from '@renderer/store/kioskStore';

/** Languages the localization tables can carry a column for — from the LANGUAGES
 *  registry, so a new language needs no edit here. Anything else (zh_cn/zh_tw/es)
 *  falls back to Korean. */
type LocLang = LocalizedLang;
const locLang = (lang: Lang): LocLang => toLocalizedLang(lang);

/**
 * Bundled fallback table for the running location: Osaek for W004 (OSAN),
 * Hwaseong for W005 (HWASEONG), Jeju for W006 (JEJU_AIRPORT), else insadong
 * (W001–W003).
 *
 * 제주 joined on 2026-08-13 — Localization_Jeju carries 233 keys, of which ~230
 * have Korean and ~124 are translated. A key the 제주 sheet has not filled falls
 * back to its own Korean (see `t`), NOT to the Insadong table: borrowing another
 * location's copy is what the per-layout split exists to prevent.
 */
function bundledTable(): typeof LOCALIZATION {
  const layout = getKioskLocation(useKioskStore.getState().config.kioskId).layout;
  if (layout === 'OSAN') return LOCALIZATION_OSAEK;
  if (layout === 'HWASEONG') return LOCALIZATION_HWASEONG;
  if (layout === 'JEJU_AIRPORT') return LOCALIZATION_JEJU;
  return LOCALIZATION;
}

/**
 * Localized UI string by its sheet `Key` (from Localization_Insa).
 *
 * Source order: live SQLite translations delivered via the startup bootstrap
 * (refreshed from the Google Sheet during night sync) → the data bundled at
 * build time (`npm run sync:sheet`) → Korean → the key itself. This keeps the
 * kiosk fast and fully offline while still picking up sheet edits on the next
 * launch after a sync.
 */
export function t(key: string, lang: Lang): string {
  const k = locLang(lang);

  const synced = useKioskStore.getState().translations[key];
  if (synced) {
    if (synced[k] && synced[k]!.trim()) return synced[k]!;
    if (synced.ko && synced.ko.trim()) return synced.ko;
  }

  const entry = bundledTable()[key];
  if (!entry) return key;
  return (entry[k] && entry[k].trim()) || entry.ko || key;
}

/**
 * Like `t()`, but without the leading list marker the sheet stores on some rows.
 *
 * Several Localization rows are authored as bullet lines — `AI_CourseContent_1`
 * reads "• 맞춤 코스가 준비되었어요!" in ko/en/ja/zh/ru and "* …" in vi/th/id,
 * `SubHeader_*` uses "* ". That marker belongs to the spreadsheet's own
 * formatting, and rendering it inside a heading shows a stray glyph whose shape
 * even changes with the language. Use this wherever the row is a heading or a
 * standalone sentence; use `t()` when the marker is wanted verbatim.
 */
export function tPlain(key: string, lang: Lang): string {
  return t(key, lang).replace(/^\s*[•*·]\s*/, '');
}

/**
 * The sheet's value for the EXACT language only — no Korean fallback. Returns
 * '' when that language's cell is empty. Use this to follow the sheet as-is
 * (even when it stores English in a ja/zh slot) and only fill gaps when truly
 * empty. `t()` is the full fallback chain.
 */
export function tExact(key: string, lang: Lang): string {
  const k = locLang(lang);
  const synced = useKioskStore.getState().translations[key];
  if (synced && synced[k] && synced[k]!.trim()) return synced[k]!.trim();
  const entry = bundledTable()[key];
  if (entry && entry[k] && entry[k].trim()) return entry[k].trim();
  return '';
}

/** True when a key exists in either the live or bundled localization tables. */
export function hasLoc(key: string): boolean {
  return key in bundledTable() || key in useKioskStore.getState().translations;
}

/**
 * Sheet string for THIS language, with an authored fallback — resolved PER
 * LANGUAGE rather than per key.
 *
 * The order is what makes a partly-translated sheet safe:
 *   1. `tExact` — the sheet's own cell for this language. The sheet is
 *      authoritative wherever it has an answer, even if it stores English in a
 *      ja slot; following it is the whole point of the sheet.
 *   2. the authored fallback for the SAME language.
 *   3. `t()`'s Korean chain, and finally the fallback's Korean.
 *
 * Step 2 before step 3 is the part that matters. Localization_Jeju fills its
 * page copy in Korean only while the screens carry all eight languages, so a
 * plain `t()` would answer Korean to an English visitor and look like it worked
 * — a real regression that nothing reports. This way the sheet drives every cell
 * it has filled, and the authored copy covers the gaps until it does.
 *
 * Used by the 제주 screens that read long-form copy (홈 notice, 여기는 제주도,
 * 안녕 '하영', 지역화폐); `t()` remains the right call for keys the sheet
 * translates fully.
 */
export function sheetText(key: string, lang: Lang, fallback?: Partial<Record<Lang, string>>): string {
  const exact = tExact(key, lang);
  if (exact) return exact;
  const authored = fallback?.[lang];
  if (authored) return authored;
  const value = t(key, lang);
  return value === key ? (fallback?.ko ?? '') : value;
}
