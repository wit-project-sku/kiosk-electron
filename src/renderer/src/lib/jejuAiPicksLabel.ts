import type { Lang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { aiCatLabel } from '@renderer/lib/aiCategoryLabel';
import { AI_CATEGORIES_JEJU } from '@renderer/data/aiCategories-jeju.generated';

/**
 * Korean questionnaire values on aiStore → Localization_Jeju keys.
 * Mirrors JejuAiSearch's VISITORS / STAY / TRANSPORT tables (labels stored
 * Korean for downstream matching; display uses the sheet via `t()`).
 */
const VISITOR_KEYS: Record<string, string> = {
  '1명': 'Visitor_1',
  '2명': 'Visitor_2',
  '3명': 'Visitor_3',
  '4명': 'Visitor_4',
  '5 ~ 9명': 'Visitor_5',
  '10명~': 'Visitor_6',
};

const STAY_KEYS: Record<string, string> = {
  '당일치기': 'StayTime_1',
  '1박 2일': 'StayTime_2',
  '2박 3일': 'StayTime_3',
  '3박 이상': 'StayTime_4',
};

const TRANSPORT_KEYS: Record<string, string> = {
  '도보': 'Transportation_1',
  '자전거': 'Transportation_2',
  '대중교통': 'Transportation_3',
  '자동차': 'Transportation_4',
};

const sheetLabel = (key: string, fallback: string, lang: Lang): string => {
  const value = t(key, lang);
  return value === key ? fallback : value;
};

/**
 * One aiStore answer (Korean) → the label shown on pick chips.
 * Interests resolve through AICategory_Jeju, same as JejuAiSearch tiles.
 */
export function localizeJejuAiPick(ko: string, lang: Lang): string {
  const visitorKey = VISITOR_KEYS[ko];
  if (visitorKey) return sheetLabel(visitorKey, ko, lang);

  const stayKey = STAY_KEYS[ko];
  if (stayKey) return sheetLabel(stayKey, ko, lang);

  const transportKey = TRANSPORT_KEYS[ko];
  if (transportKey) return sheetLabel(transportKey, ko, lang);

  const cat = AI_CATEGORIES_JEJU.find((row) => row.ko === ko);
  if (cat) return aiCatLabel(cat, lang);

  return ko;
}
