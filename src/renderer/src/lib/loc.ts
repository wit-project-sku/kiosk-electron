import type { Lang } from '@renderer/lib/i18n';
import { LOCALIZATION } from '@renderer/data/localization.generated';
import { LOCALIZATION_OSAEK } from '@renderer/data/localization-osaek.generated';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { useKioskStore } from '@renderer/store/kioskStore';

type Lang4 = 'ko' | 'en' | 'ja' | 'zh';
const lang4 = (lang: Lang): Lang4 => (['ko', 'en', 'ja', 'zh'].includes(lang) ? (lang as Lang4) : 'ko');

/** Bundled fallback table for the running location (Osaek for W004, else insadong). */
function bundledTable(): typeof LOCALIZATION {
  const kioskId = useKioskStore.getState().config.kioskId;
  return getKioskLocation(kioskId).layout === 'OSAN' ? LOCALIZATION_OSAEK : LOCALIZATION;
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

/** True when a key exists in either the live or bundled localization tables. */
export function hasLoc(key: string): boolean {
  return key in bundledTable() || key in useKioskStore.getState().translations;
}
