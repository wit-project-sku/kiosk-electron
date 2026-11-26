/**
 * One-shot moves of a machine's stored site code after the server renumbered its
 * kiosks. Each runs once — while its flag is absent in kiosk-config.json — and
 * then the flag is stored, so a code that is already new is never moved again.
 * A fresh setup (applySetup) or a site switch writes both flags itself.
 *
 *  - `jejuIdShift202610` — the 2026-10-26 renumber (V201): 제주 W006·W007·W008 →
 *    W008·W009·W010.
 *  - `kioskIdShift202611` — the 2026-11-25 renumber (V224): 세계자연유산본부
 *    W010 → W011, 롯데 W011·W012·W013 → W012·W013·W014. Kiosk 10 is now the
 *    HQ 1-monitor PC, not a site. Also moves a test kiosk's `previewSite`.
 *
 * They chain in order, so a machine provisioned before 2026-10-26 as the old
 * 유산본부 code (W008) ends at W011.
 */

export const JEJU_ID_SHIFT_FLAG = 'jejuIdShift202610';
export const V224_ID_SHIFT_FLAG = 'kioskIdShift202611';

export const JEJU_ID_SHIFT: Readonly<Record<string, string>> = {
  W006: 'W008',
  W007: 'W009',
  W008: 'W010',
};

export const V224_ID_SHIFT: Readonly<Record<string, string>> = {
  W010: 'W011',
  W011: 'W012',
  W012: 'W013',
  W013: 'W014',
};

export interface StoredSite {
  kioskId: string;
  previewSite?: string;
  jejuShifted: boolean;
  v224Shifted: boolean;
}

/** What the stored config should become. `changed` lists the keys to write back. */
export function migrateStoredSite(stored: StoredSite): {
  kioskId: string;
  previewSite?: string;
  changed: ReadonlyArray<'kioskId' | 'previewSite'>;
} {
  let kioskId = stored.kioskId;
  let previewSite = stored.previewSite;
  if (!stored.jejuShifted) kioskId = JEJU_ID_SHIFT[kioskId] ?? kioskId;
  if (!stored.v224Shifted) {
    kioskId = V224_ID_SHIFT[kioskId] ?? kioskId;
    if (previewSite) previewSite = V224_ID_SHIFT[previewSite] ?? previewSite;
  }
  const changed: Array<'kioskId' | 'previewSite'> = [];
  if (kioskId !== stored.kioskId) changed.push('kioskId');
  if (previewSite !== stored.previewSite) changed.push('previewSite');
  return { kioskId, previewSite, changed };
}
