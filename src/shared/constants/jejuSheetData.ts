/**
 * Content-cache keys for the 제주 sheet tabs refreshed on every launch and at the
 * nightly sync. Main writes them (GoogleSheetsSyncTransport); the renderer reads
 * them over the bundled copy (lib/jejuAiCategories, lib/airportFacilities). The
 * payload is `{ rows: [...] }`.
 */
export const JEJU_AI_CATEGORIES_KEY = 'sheet_jeju_ai_categories';
export const JEJU_AIRPORT_FACILITIES_KEY = 'sheet_jeju_airport_facilities';
