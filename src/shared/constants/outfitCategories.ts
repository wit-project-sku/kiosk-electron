import type { OutfitCategoryLabels } from '../types/outfit';

/**
 * Display names for the outfit picker's tabs, for the two paths where the API
 * cannot supply them.
 *
 * `GET /api/outfits/categories` carries a label per language and is the source
 * of truth — these are only reached when it is unavailable:
 *
 *   1. the legacy `GET /api/categories/outfits`, which returns bare `{id,name}`
 *      and is still what PROD serves (the labelled endpoint 401s there today);
 *   2. the bundled PNG catalogue on a kiosk that has never synced.
 *
 * Without them those paths would print the raw filter code — "w=hannbok" is not
 * something to put in front of a visitor. The wording is copied from the live
 * admin values (stage, 2026-08-14) so a kiosk on either path shows the same
 * words: note 이벤트 for `brand` and 직업복 for `New Outfit`, which is what the
 * operator actually set, not what the code used to guess.
 *
 * Keys are LOWER-CASED category names — matching is case-insensitive.
 */
const FALLBACK_LABELS: Record<string, OutfitCategoryLabels> = {
  'w=hannbok': {
    labelKr: '여자 한복',
    labelEn: "Women's Hanbok",
    labelJp: '女性用ハンボク',
    labelCh: '女式韩服',
    labelVn: 'Hanbok nữ',
    labelId: 'Hanbok Wanita',
    labelTh: 'ฮันบกหญิง',
    labelRu: 'Женский ханбок',
  },
  'w=model': {
    labelKr: '모델',
    labelEn: 'Model',
    labelJp: 'モデル',
    labelCh: '模特',
    labelVn: 'Người mẫu',
    labelId: 'Model',
    labelTh: 'โมเดล',
    labelRu: 'Модель',
  },
  'm=hanbok': {
    labelKr: '남자 한복',
    labelEn: "Men's Hanbok",
    labelJp: '男性用ハンボク',
    labelCh: '男式韩服',
    labelVn: 'Hanbok nam',
    labelId: 'Hanbok Pria',
    labelTh: 'ฮันบกชาย',
    labelRu: 'Мужской ханбок',
  },
  'm=everyday': {
    labelKr: '일상복',
    labelEn: 'Everyday',
    labelJp: '普段着',
    labelCh: '日常服',
    labelVn: 'Thường ngày',
    labelId: 'Kasual',
    labelTh: 'ชุดลำลอง',
    labelRu: 'Повседневное',
  },
  global: {
    labelKr: '글로벌',
    labelEn: 'Global',
    labelJp: 'グローバル',
    labelCh: '全球',
    labelVn: 'Toàn cầu',
    labelId: 'Global',
    labelTh: 'โกลบอล',
    labelRu: 'Глобальный',
  },
  promotion: {
    labelKr: '프로모션',
    labelEn: 'Promotion',
    labelJp: 'プロモーション',
    labelCh: '促销',
    labelVn: 'Khuyến mãi',
    labelId: 'Promosi',
    labelTh: 'โปรโมชัน',
    labelRu: 'Промо',
  },
  brand: {
    labelKr: '이벤트',
    labelEn: 'Event',
    labelJp: 'イベント',
    labelCh: '活动',
    labelVn: 'Sự kiện',
    labelId: 'Acara',
    labelTh: 'อีเวนต์',
    labelRu: 'Событие',
  },
  'k-culture': {
    labelKr: 'K-CULTURE',
    labelEn: 'K-CULTURE',
    labelJp: 'K-CULTURE',
    labelCh: 'K-CULTURE',
    labelVn: 'K-CULTURE',
    labelId: 'K-CULTURE',
    labelTh: 'K-CULTURE',
    labelRu: 'K-CULTURE',
  },
  'new outfit': {
    labelKr: '직업복',
    labelEn: 'Job Wear',
    labelJp: '職業服',
    labelCh: '职业装',
    labelVn: 'Trang phục nghề',
    labelId: 'Pakaian Profesi',
    labelTh: 'ชุดอาชีพ',
    labelRu: 'Профессии',
  },
};

/**
 * The same text in all eight languages — the shape a label set has to be in
 * when there is only one string to put in it.
 *
 * This is the rule the server documents for a blank label (한국어 → 코드), and
 * the pickers rely on it: a label set is never partially filled, so every
 * caller can read its own language's field and get something.
 */
export function uniformOutfitLabels(text: string): OutfitCategoryLabels {
  return {
    labelKr: text,
    labelEn: text,
    labelJp: text,
    labelCh: text,
    labelVn: text,
    labelId: text,
    labelTh: text,
    labelRu: text,
  };
}

/**
 * Display names for a registered category name, for a source that carries none.
 *
 * An unknown category falls back to its own code in all eight languages. A tab
 * the operator has just registered is then visible and usable, spelled oddly,
 * which is strictly better than a tab that is missing or blank.
 *
 * ★ CATEGORIES ONLY. Do not reach for this to label an OUTFIT: the table above
 * is keyed by category code, so an outfit whose slug happens to read "global"
 * would come back captioned 글로벌 — the tab's name on a garment. Outfits use
 * `uniformOutfitLabels` on their own slug or code instead.
 */
export function fallbackOutfitLabels(categoryName: string): OutfitCategoryLabels {
  const known = FALLBACK_LABELS[categoryName.trim().toLowerCase()];
  if (known) return { ...known };
  return uniformOutfitLabels(categoryName);
}
