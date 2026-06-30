import type { Lang } from '@renderer/lib/i18n';
import { LOCALIZATION } from '@renderer/data/localization.generated';
import { LOCALIZATION_OSAEK } from '@renderer/data/localization-osaek.generated';
import { LOCALIZATION_HWASEONG } from '@renderer/data/localization-hwaseong.generated';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { useKioskStore } from '@renderer/store/kioskStore';

type Lang4 = 'ko' | 'en' | 'ja' | 'zh';
const lang4 = (lang: Lang): Lang4 => (['ko', 'en', 'ja', 'zh'].includes(lang) ? (lang as Lang4) : 'ko');

/**
 * Bundled fallback table for the running location: Osaek for W004 (OSAN),
 * Hwaseong for W005 (HWASEONG), else insadong (W001–W003).
 */
function bundledTable(): typeof LOCALIZATION {
  const layout = getKioskLocation(useKioskStore.getState().config.kioskId).layout;
  if (layout === 'OSAN') return LOCALIZATION_OSAEK;
  if (layout === 'HWASEONG') return LOCALIZATION_HWASEONG;
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
  const k = lang4(lang);

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
 * The sheet's value for the EXACT language only — no Korean fallback. Returns
 * '' when that language's cell is empty. Use this to follow the sheet as-is
 * (even when it stores English in a ja/zh slot) and only fill gaps when truly
 * empty. `t()` is the full fallback chain.
 */
export function tExact(key: string, lang: Lang): string {
  const k = lang4(lang);
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
