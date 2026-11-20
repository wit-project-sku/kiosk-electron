/**
 * Screen text from the 롯데 sheet's Localization_Lotte tab — the way the other kiosks draw their
 * labels from their own Localization tab.
 *
 * `lt(key, lang, authored)` is the sheet's cell for this language, else the copy authored on the
 * screen for that language, else Korean — what shows while a key is missing. Rows that differ per site are written
 * `Key@W011` / `@W012` / `@W013` in the sheet; pass the kiosk id and the site's own row wins over
 * a shared one. The table is the copy synced at launch, else the one bundled at build time
 * (lib/loc → data/localization-lotte).
 */
import { hasLoc, sheetText } from '@renderer/lib/loc';
import type { Lang } from '@renderer/lib/i18n';
import type { KioskId } from '@shared/types/kiosk';

/** The site's own row (`Key@W011`) when the sheet has one, else the shared `Key`. */
export const siteKey = (key: string, kioskId?: KioskId): string =>
  kioskId && hasLoc(`${key}@${kioskId}`) ? `${key}@${kioskId}` : key;

/** Authored copy: the Korean line, or the screen's own per-language map. */
export type Authored = string | Partial<Record<Lang, string>>;

export function lt(key: string, lang: Lang, authored: Authored, kioskId?: KioskId): string {
  return sheetText(siteKey(key, kioskId), lang, typeof authored === 'string' ? { ko: authored } : authored);
}

/** `lt` for rows with a `{n}` slot ('함께 나눈 영화 {n}편'). */
export function ltn(key: string, lang: Lang, authored: Authored, n: string | number, kioskId?: KioskId): string {
  return lt(key, lang, authored, kioskId).replace('{n}', String(n));
}

/** True when the sheet has the row (shared or this site's) — for content that only exists there. */
export const hasLt = (key: string, kioskId?: KioskId): boolean => hasLoc(siteKey(key, kioskId));
