import { LOCALIZATION_JEJU } from './localization-jeju.generated';

/**
 * 롯데's bundled UI strings until it has a Localization tab of its own: the 제주 table's
 * generic rows (뒤로, 언어선택, 검색 안내…) with every row that names a 제주 place or mascot
 * removed, so a 제주 sentence can never reach a 롯데 screen. A dropped key falls back to
 * the copy authored on the screen.
 */
const JEJU_ONLY = /제주|하영|유산|귤이|공항|탐나|렌트|크루즈|거문/;

export const LOCALIZATION_LOTTE: typeof LOCALIZATION_JEJU = Object.fromEntries(
  Object.entries(LOCALIZATION_JEJU).filter(
    ([, row]) => !JEJU_ONLY.test(Object.values(row).join(' ')),
  ),
) as typeof LOCALIZATION_JEJU;
