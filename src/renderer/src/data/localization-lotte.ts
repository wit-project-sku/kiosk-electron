import { LOCALIZATION_JEJU } from './localization-jeju.generated';
import { LOCALIZATION_LOTTE_SHEET } from './localization-lotte.generated';

/**
 * 롯데's bundled UI strings: its own Localization_Lotte tab (npm run sync:sheet -- --only=lotte),
 * over the 제주 table's generic rows (뒤로, 언어선택, 검색 안내…) for the keys the 롯데 tab does
 * not have. Every 제주 row that names a 제주 place or mascot is removed first, so a 제주 sentence
 * can never reach a 롯데 screen. A key in neither falls back to the copy authored on the screen.
 */
const JEJU_ONLY = /제주|하영|유산|귤이|공항|탐나|렌트|크루즈|거문/;

const JEJU_GENERIC = Object.fromEntries(
  Object.entries(LOCALIZATION_JEJU).filter(([, row]) => !JEJU_ONLY.test(Object.values(row).join(' '))),
) as typeof LOCALIZATION_JEJU;

export const LOCALIZATION_LOTTE: typeof LOCALIZATION_JEJU = {
  ...JEJU_GENERIC,
  ...LOCALIZATION_LOTTE_SHEET,
};
