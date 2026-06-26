import type { SupportedLanguage } from '@shared/types/kiosk';
import { useLanguageStore } from '@renderer/store/languageStore';
import { hasLoc, t } from '@renderer/lib/loc';

export type Lang = SupportedLanguage;

/** Pick the value for the active language, falling back to Korean. */
export function pick<T>(map: Partial<Record<Lang, T>>, lang: Lang): T {
  return (map[lang] ?? map.ko ?? (Object.values(map)[0] as T)) as T;
}

/** Hook: current UI language. */
export function useLang(): Lang {
  return useLanguageStore((s) => s.currentLanguage);
}

/** Category labels (food / shopping / lodging tabs) keyed by their Korean id. */
const CATEGORY_LABELS: Record<string, Partial<Record<Lang, string>>> = {
  // 뭐먹지
  한식: { en: 'Korean', ja: '韓国料理', zh: '韩餐' },
  한정식: { en: 'Korean course', ja: '韓定食', zh: '韩定食' },
  바베큐: { en: 'BBQ', ja: 'バーベキュー', zh: '烧烤' },
  분식: { en: 'Snacks', ja: '粉食', zh: '小吃' },
  샐러드샵: { en: 'Salad', ja: 'サラダ', zh: '沙拉' },
  '채식·비건': { en: 'Vegan', ja: 'ビーガン', zh: '素食' },
  '아시안·중식': { en: 'Asian·Chinese', ja: 'アジア・中華', zh: '亚洲·中餐' },
  전통차: { en: 'Tea house', ja: '伝統茶', zh: '传统茶' },
  카페: { en: 'Café', ja: 'カフェ', zh: '咖啡' },
  // 뭐사지
  의류: { en: 'Clothing', ja: '衣類', zh: '服装' },
  공예품: { en: 'Crafts', ja: '工芸品', zh: '工艺品' },
  수제도장: { en: 'Stamps', ja: '手作りはんこ', zh: '手工印章' },
  엔틱: { en: 'Antiques', ja: 'アンティーク', zh: '古董' },
  화방: { en: 'Art supplies', ja: '画材店', zh: '画材店' },
  한복: { en: 'Hanbok', ja: '韓服', zh: '韩服' },
  잡화: { en: 'Goods', ja: '雑貨', zh: '杂货' },
  '표구·액자': { en: 'Framing', ja: '額装', zh: '装裱·画框' },
  기념품: { en: 'Souvenirs', ja: 'お土産', zh: '纪念品' },
  // 숙박
  호텔: { en: 'Hotel', ja: 'ホテル', zh: '酒店' },
  호스텔: { en: 'Hostel', ja: 'ホステル', zh: '旅舍' },
  게스트하우스: { en: 'Guesthouse', ja: 'ゲストハウス', zh: '民宿' },
  // 미술관
  고미술: { en: 'Antique Art', ja: '古美術', zh: '古美术' },
  화랑: { en: 'Gallery', ja: '画廊', zh: '画廊' },
  표구: { en: 'Framing', ja: '表具', zh: '裱框' },
  전시관: { en: 'Exhibition', ja: '展示館', zh: '展览馆' },
  역사유적지: { en: 'Historic Site', ja: '史跡', zh: '历史遗跡' },
  // shared
  기타: { en: 'Other', ja: 'その他', zh: '其他' },
};

/** Localized category label, falling back to the Korean id. */
export function catLabel(id: string, lang: Lang): string {
  return CATEGORY_LABELS[id]?.[lang] ?? id;
}

/**
 * Page-header titles keyed by their Korean string (the id passed to
 * InsadongHeader). Pages keep passing the Korean title; the header localizes it.
 * Unknown / already-localized strings fall through unchanged.
 */
const SCREEN_TITLES: Record<string, Partial<Record<Lang, string>>> = {
  '여기는 인사동': { en: 'Here is Insadong', ja: 'ここは仁寺洞', zh: '这里是仁寺洞' },
  '‘인사’ 뭐하지 (AI 검색)': { en: 'What to Do (AI Search)', ja: '何しよう (AI検索)', zh: '做什么 (AI搜索)' },
  환율: { en: 'Exchange Rate', ja: '為替レート', zh: '汇率' },
  '도와줘 ‘인사’': { en: 'Help', ja: 'ヘルプ', zh: '帮助' },
  '인사 미술관': { en: 'Insa Gallery', ja: '仁寺美術館', zh: '仁寺美术馆' },
  "'인사' 뭐먹지": { en: 'What to Eat', ja: '何を食べる', zh: '吃什么' },
  "'인사' 뭐사지": { en: 'What to Buy', ja: '何を買う', zh: '买什么' },
  숙박안내: { en: 'Lodging', ja: '宿泊案内', zh: '住宿指南' },
  고궁안내: { en: 'Royal Palaces', ja: '古宮案内', zh: '古宫指南' },
  언어선택: { en: 'Language', ja: '言語選択', zh: '语言选择' },
  검색: { en: 'Search', ja: '検索', zh: '搜索' },
  '교통 안내': { en: 'Transportation', ja: '交通案内', zh: '交通指南' },
  위드마켓: { en: 'With Market', ja: 'ウィズマーケット', zh: 'With市场' },
  'AR 한복체험': { en: 'AR Hanbok', ja: 'AR韓服体験', zh: 'AR韩服体验' },
  화장실: { en: 'Restroom', ja: 'トイレ', zh: '洗手间' },
  상세: { en: 'Details', ja: '詳細', zh: '详情' },
};

/**
 * Korean header-title id → sheet localization keys (title + optional subtitle).
 * Lets the header pull both from Localization_Insa; ids without a key fall back
 * to the hand-written SCREEN_TITLES above / the localized page-description.
 */
const TITLE_KEYS: Record<string, { title: string; sub?: string }> = {
  '여기는 인사동': { title: 'MainButton_Here', sub: 'SubHeader_Attraction' },
  'TAX - FREE': { title: 'MainButton_TaxFree', sub: 'SubHeader_TaxFree' },
  '‘인사’ 뭐하지 (AI 검색)': { title: 'MainButton_AI', sub: 'SubHeader_AISearch' },
  환율: { title: 'MainButton_Exchange', sub: 'SubHeader_Exchange' },
  '도와줘 ‘인사’': { title: 'MainButton_ToHelp', sub: 'SubHeader_ToHelp' },
  '인사 미술관': { title: 'MainButton_ToGallery', sub: 'SubHeader_ToGallery' },
  "'인사' 뭐먹지": { title: 'MainButton_ToEat', sub: 'SubHeader_ToEat' },
  "'인사' 뭐사지": { title: 'MainButton_ToBuy', sub: 'SubHeader_ToBuy' },
  숙박안내: { title: 'MainButton_ToStay', sub: 'SubHeader_ToStay' },
  고궁안내: { title: 'MainButton_Palace', sub: 'SubHeader_Palace' },
  언어선택: { title: 'Language_Select_Language', sub: 'Language_Content' },
  '교통 안내': { title: 'MainButton_Transport', sub: 'SubHeader_Transport' },
  위드마켓: { title: 'MainButton_Goods' },
  화장실: { title: 'MainButton_WC', sub: 'SubHeader_ToHelp' },
  // ── W004 오산 오색시장 header titles + page descriptions (Localization_Osaek) ──
  "도와줘 '정이'": { title: 'MainButton_ToHelp', sub: 'SubHeader_ToHelp' },
  "'정이' 뭐먹지": { title: 'MainButton_ToEat', sub: 'SubHeader_ToEat' },
  "'정이' 뭐사지(식품)": { title: 'MainButton_ToBuy', sub: 'SubHeader_ToBuy' },
  "'정이' 뭐사지(물품)": { title: 'MainButton_ToBuy', sub: 'SubHeader_ToBuy' },
  "'정이' 모하지 (AI 검색)": { title: 'MainButton_AI', sub: 'SubHeader_AISearch' },
  "'정이' 모하지(AI 검색)": { title: 'MainButton_AI', sub: 'SubHeader_AICourse' },
};

/** Localized page-header title, falling back to the hand map, then the id. */
export function screenTitle(id: string, lang: Lang): string {
  const k = TITLE_KEYS[id]?.title;
  if (k && hasLoc(k)) return t(k, lang);
  return SCREEN_TITLES[id]?.[lang] ?? id;
}

/** Localized page subtitle for a header-title id, or undefined if none mapped. */
/** Localized subtitles not (yet) in the sheet, keyed by header-title id. */
const EXTRA_SUBTITLES: Record<string, Partial<Record<Lang, string>>> = {
  위드마켓: {
    ko: '오직 현장에서만 할인받을 수 있는 상품들을 확인해보세요!',
    en: 'Check out the products available at a discount only here, on-site!',
    ja: '現場でしか割引を受けられない商品をぜひチェックしてください！',
    zh: '快来看看只有在现场才能享受折扣的商品吧！',
  },
};

export function screenSubtitle(id: string, lang: Lang): string | undefined {
  const extra = EXTRA_SUBTITLES[id];
  if (extra) return extra[lang] ?? extra.ko;
  const k = TITLE_KEYS[id]?.sub;
  return k && hasLoc(k) ? t(k, lang) : undefined;
}
