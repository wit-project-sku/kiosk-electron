/**
 * The 롯데 content spreadsheet (W012~W014) and the tabs the kiosk reads from it.
 *
 * Read at build time by scripts/sync-sheet.mjs (gviz CSV → *.generated.ts bundled with the app)
 * and at every launch and 00:00 by GoogleSheetsSyncTransport (Sheets API → SQLite), exactly like
 * the 제주 sheet. Keep the id in step with LOTTE_SHEET_ID in scripts/sync-sheet.mjs.
 *
 * A native Google Sheet (converted from the uploaded .xlsx on 2026-11-18 — the Sheets API refuses
 * Office files, so an .xlsx id here would leave every launch on the bundled copy).
 */
export const LOTTE_SHEET_ID = '1ZKoNbnQAtmLaY8Hx5MT1jS8su0FPXKiu9lO7TnsFNOs';

/** UI strings — same columns as Localization_Jeju_v3 (Key, 8 languages, notes). */
export const LOTTE_LOCALIZATION_RANGE = 'Localization_Lotte!A:L';

/** 시설안내 · 화장실 rows, one tab per site. */
export const LOTTE_FACILITY_TABS: Readonly<Record<'W012' | 'W013' | 'W014', string>> = {
  W012: 'FacilityData_WorldMall',
  W013: 'FacilityData_Cheongnyangni',
  W014: 'FacilityData_StarCity',
};

/** Content-cache key for this kiosk's facility rows. Payload: `{ rows: LotteFacility[] }`. */
export const LOTTE_FACILITIES_KEY = 'sheet_lotte_facilities';
