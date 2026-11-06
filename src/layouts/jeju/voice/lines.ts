/**
 * What 제주 voice guidance says — every line comes from the sheet's
 * Text-to-speech_Script tab (VOICE_JEJU), except what is read off the screen
 * itself: the name of the element the keypad ring is on.
 */
import type { KioskScreenId } from '@shared/types/kiosk';
import type { LangText } from '@renderer/data/types';
import { VOICE_JEJU } from '@renderer/data/voice-jeju.generated';
import { useKioskStore } from '@renderer/store/kioskStore';
import { canSpeak, Priority, type Line, type VoiceLang } from './speech';

const VOICE_LANGS: readonly VoiceLang[] = ['ko', 'en', 'ja', 'zh', 'vi', 'th', 'ru', 'id'];

export function toVoiceLang(lang: string): VoiceLang {
  return (VOICE_LANGS as readonly string[]).includes(lang) ? (lang as VoiceLang) : 'ko';
}

/**
 * The site's own row (`jeju.home@W008`) before the shared one (`jeju.home`).
 * Then the airport's row, the layout a test rig previewing 제주 gets (JejuKiosk).
 * Each is the copy synced from the sheet at launch (stored with the
 * translations as `Voice_<key>`, see VoiceSyncParser) over the one bundled at
 * build time — so a script edit is heard after a restart, not a release.
 */
function row(key: string, kioskId: string): Partial<LangText> | undefined {
  const synced = useKioskStore.getState().translations;
  for (const k of [`${key}@${kioskId}`, key, `${key}@W008`]) {
    const live = synced[`Voice_${k}`];
    const bundled = VOICE_JEJU[k];
    if (live || bundled) return { ...bundled, ...live };
  }
  return undefined;
}

/** `{label}`-style slots, filled from `vars`. */
function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

interface LineOptions {
  priority: Priority;
  vars?: Record<string, string | number>;
  lead?: boolean;
  force?: boolean;
}

/**
 * One sheet line in the visitor's language. When Windows has no voice for that
 * language the line is spoken from the English column instead — a Thai sentence
 * through a Korean voice is noise, an English one is at least guidance.
 */
export function sheetLine(key: string, lang: VoiceLang, kioskId: string, opts: LineOptions): Line | null {
  const text = row(key, kioskId);
  if (!text) return null;
  const speakAs: VoiceLang = canSpeak(lang) ? lang : 'en';
  const template = text[speakAs] || text.en || text.ko;
  if (!template) return null;
  return {
    text: fill(template, opts.vars ?? {}),
    lang: speakAs,
    priority: opts.priority,
    lead: opts.lead,
    force: opts.force,
  };
}

/** Screens that are a remote site in a <webview>: nothing inside is read. */
const WEB_SCREENS: ReadonlySet<KioskScreenId> = new Set<KioskScreenId>([
  'market',
  'tamnao',
  'jejuqrang',
  'donation',
  'taxfree',
]);

/** Screens the sheet marks "자세히 듣기": key 2 reads their `data-voice-more` body. */
const LONG_TEXT_SCREENS: ReadonlySet<KioskScreenId> = new Set<KioskScreenId>(['heritage', 'geomun']);

/** W009/W010 keep 도와줘 instead of 공항 안내 — see jejuHelpTitle. */
const isTerminalOrHeritage = (kioskId: string): boolean => kioskId === 'W009' || kioskId === 'W010';

/**
 * The route's default intro (L1) and the hint lines that follow it — the tab or
 * step a screen opens on. Screens that change tab, step or modal declare their
 * own with intro.ts's useVoiceIntro, which wins over this. Empty for a screen
 * the guidance does not cover (search, maintenance).
 */
export function screenKeys(screen: KioskScreenId, photoActive: boolean, kioskId: string): string[] {
  if (photoActive) return ['hanbok.select'];
  const intro = SCREEN_INTROS[screen];
  const key = typeof intro === 'function' ? intro(kioskId) : intro;
  if (!key) return [];
  if (WEB_SCREENS.has(screen)) return [key, 'global.web.exit'];
  if (LONG_TEXT_SCREENS.has(screen)) return [key, 'global.more.hint'];
  return [key];
}

const SCREEN_INTROS: Partial<Record<KioskScreenId, string | ((kioskId: string) => string)>> = {
  home: 'jeju.home',
  language: 'jeju.language',
  ai_search: 'jeju.ai.pick',
  ai_detail: 'jeju.ai.course',
  detail: 'jeju.spot.detail',
  eat: 'jeju.food.list',
  shop: 'jeju.shop.list',
  lodging: 'jeju.stay.list',
  about: 'jeju.about.sights',
  hello: 'jeju.hello',
  help: (kioskId) => (isTerminalOrHeritage(kioskId) ? 'jeju.help' : 'jeju.airport.guide'),
  restroom: 'jeju.restroom',
  flights: 'jeju.flights',
  cruise: 'jeju.ferries',
  exchange: 'jeju.exchange.live',
  rentcar: 'jeju.rentcar.list',
  localpay: 'jeju.localpay.tamna',
  events: 'jeju.event.list',
  // Only W010 keeps the two-tab 탐나오·제주큐랑 page — must match webScreensFor in
  // JejuKiosk. The sheet still marks jeju.tamnao and jeju.qrang 제주공항-only and
  // jeju.tamnao-qrang for W009 too; W009 has since moved to the split pages.
  tamnao: (kioskId) => (kioskId === 'W010' ? 'jeju.tamnao-qrang' : 'jeju.tamnao'),
  jejuqrang: 'jeju.qrang',
  market: 'jeju.witstore',
  donation: 'jeju.donation',
  taxfree: 'jeju.taxfree.refund',
  fillme: 'fillme.start',
  heritage: 'heritage.unesco',
  geomun: 'heritage.geomun',
};

/**
 * Names for the icon-only controls, keyed by their `aria-label`. Those labels
 * are Korean on every language AND are what useJejuKeypad finds the rail's
 * buttons by, so they cannot be translated in place — this reads the right
 * name aloud instead. Drafts, to be replaced by sheet rows after native review.
 */
const ICON_LABELS: Record<string, LangText> = {
  뒤로: { ko: '뒤로', en: 'Back', ja: '戻る', zh: '返回', vi: 'Quay lại', th: 'ย้อนกลับ', ru: 'Назад', id: 'Kembali' },
  홈: { ko: '홈', en: 'Home', ja: 'ホーム', zh: '首页', vi: 'Trang chủ', th: 'หน้าแรก', ru: 'Главная', id: 'Beranda' },
  홈으로: { ko: '홈으로', en: 'Home', ja: 'ホームへ', zh: '回首页', vi: 'Về trang chủ', th: 'กลับหน้าแรก', ru: 'На главную', id: 'Ke beranda' },
  '음성 안내': {
    ko: '음성 안내',
    en: 'Voice guidance',
    ja: '音声案内',
    zh: '语音导览',
    vi: 'Hướng dẫn bằng giọng nói',
    th: 'เสียงนำทาง',
    ru: 'Голосовой гид',
    id: 'Panduan suara',
  },
  '저상 화면': {
    ko: '배리어프리 화면',
    en: 'Barrier-free layout',
    ja: 'バリアフリー画面',
    zh: '无障碍界面',
    vi: 'Giao diện không rào cản',
    th: 'หน้าจอไร้สิ่งกีดขวาง',
    ru: 'Доступный режим',
    id: 'Tampilan bebas hambatan',
  },
  위로: { ko: '위로', en: 'Scroll up', ja: '上へ', zh: '向上', vi: 'Lên', th: 'เลื่อนขึ้น', ru: 'Вверх', id: 'Ke atas' },
  아래로: { ko: '아래로', en: 'Scroll down', ja: '下へ', zh: '向下', vi: 'Xuống', th: 'เลื่อนลง', ru: 'Вниз', id: 'Ke bawah' },
  닫기: { ko: '닫기', en: 'Close', ja: '閉じる', zh: '关闭', vi: 'Đóng', th: 'ปิด', ru: 'Закрыть', id: 'Tutup' },
  Close: { ko: '닫기', en: 'Close', ja: '閉じる', zh: '关闭', vi: 'Đóng', th: 'ปิด', ru: 'Закрыть', id: 'Tutup' },
  지우기: { ko: '지우기', en: 'Delete', ja: '削除', zh: '删除', vi: 'Xóa', th: 'ลบ', ru: 'Удалить', id: 'Hapus' },
  검색: { ko: '검색', en: 'Search', ja: '検索', zh: '搜索', vi: 'Tìm kiếm', th: 'ค้นหา', ru: 'Поиск', id: 'Cari' },
  이전: { ko: '이전', en: 'Previous', ja: '前へ', zh: '上一个', vi: 'Trước', th: 'ก่อนหน้า', ru: 'Предыдущий', id: 'Sebelumnya' },
  다음: { ko: '다음', en: 'Next', ja: '次へ', zh: '下一个', vi: 'Tiếp', th: 'ถัดไป', ru: 'Далее', id: 'Berikutnya' },
  화장실: { ko: '화장실', en: 'Restroom', ja: 'トイレ', zh: '洗手间', vi: 'Nhà vệ sinh', th: 'ห้องน้ำ', ru: 'Туалет', id: 'Toilet' },
  사진촬영: {
    ko: '한복 사진 촬영',
    en: 'Hanbok photo',
    ja: '韓服写真撮影',
    zh: '拍韩服照片',
    vi: 'Chụp ảnh hanbok',
    th: 'ถ่ายภาพฮันบก',
    ru: 'Фото в ханбоке',
    id: 'Foto hanbok',
  },
  '제주 날씨': {
    ko: '제주 날씨',
    en: 'Jeju weather',
    ja: '済州の天気',
    zh: '济州天气',
    vi: 'Thời tiết Jeju',
    th: 'สภาพอากาศเชจู',
    ru: 'Погода на Чеджу',
    id: 'Cuaca Jeju',
  },
  언어선택: {
    ko: '언어 선택',
    en: 'Language',
    ja: '言語選択',
    zh: '选择语言',
    vi: 'Chọn ngôn ngữ',
    th: 'เลือกภาษา',
    ru: 'Выбор языка',
    id: 'Pilih bahasa',
  },
  '통화 바꾸기': {
    ko: '통화 바꾸기',
    en: 'Change currency',
    ja: '通貨を変更',
    zh: '更换货币',
    vi: 'Đổi tiền tệ',
    th: 'เปลี่ยนสกุลเงิน',
    ru: 'Сменить валюту',
    id: 'Ganti mata uang',
  },
  '지도 확대': { ko: '지도 확대', en: 'Zoom in', ja: '拡大', zh: '放大', vi: 'Phóng to', th: 'ซูมเข้า', ru: 'Увеличить', id: 'Perbesar' },
  '지도 축소': { ko: '지도 축소', en: 'Zoom out', ja: '縮小', zh: '缩小', vi: 'Thu nhỏ', th: 'ซูมออก', ru: 'Уменьшить', id: 'Perkecil' },
};

/** Longest name read for one element — a card's first line, never its whole body. */
const MAX_NAME = 80;

/**
 * What an element is called, in the visitor's language: `data-voice-label`
 * first — an entry field whose visible text is what the visitor typed marks its
 * name there, so the value is never read out — then a known label
 * (the 날씨 panel's visible first line is a temperature, not its name), then
 * its first line of visible text (a tile's title, not its subtitle), then its
 * raw `aria-label` — that one only to Korean visitors, since reading Korean to
 * anyone else would be worse than silence.
 */
function elementName(el: HTMLElement, lang: VoiceLang): string | null {
  const marked = el.dataset['voiceLabel']?.trim();
  if (marked) return marked;
  const aria = el.getAttribute('aria-label')?.trim();
  const known = aria ? ICON_LABELS[aria] : undefined;
  if (known) return known[lang] || known.en;
  const firstLine = el.innerText
    .split('\n')
    .map((s) => s.trim())
    .find(Boolean);
  if (firstLine) return firstLine.slice(0, MAX_NAME);
  return aria && lang === 'ko' ? aria : null;
}

/**
 * The focus line (L2) for the element the keypad ring just landed on.
 *
 * Live text from the screen, so it needs a Windows voice for `lang` — without
 * one nothing is read (the screen's own words are not in English to fall back on).
 * `privateScreen` drops "selected": on a personal-data screen what the visitor
 * chose must not be said out loud (the speaker plays with the earphones).
 */
export function focusLine(
  el: HTMLElement,
  lang: VoiceLang,
  kioskId: string,
  privateScreen: boolean,
): Line | null {
  if (!canSpeak(lang)) return null;
  const label = elementName(el, lang);
  if (!label) return null;
  const opts = (vars: Record<string, string | number>): LineOptions => ({ priority: Priority.Focus, vars });

  const disabled = (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true';
  if (disabled) return sheetLine('focus.disabled', lang, kioskId, opts({ label }));

  if (el.getAttribute('role') === 'tab') {
    const tabs = Array.from(el.parentElement?.querySelectorAll<HTMLElement>(':scope > [role="tab"]') ?? []);
    const i = tabs.indexOf(el);
    if (i >= 0) return sheetLine('focus.tab', lang, kioskId, opts({ label, i: i + 1, total: tabs.length }));
  }

  const selected = el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-pressed') === 'true';
  if (selected && !privateScreen) return sheetLine('focus.selected', lang, kioskId, opts({ label }));

  const list = el.closest<HTMLElement>('[data-voice-list]');
  if (list && list !== el) {
    const n = Array.from(list.children).findIndex((c) => c.contains(el));
    if (n >= 0) return sheetLine('focus.listitem', lang, kioskId, opts({ n: n + 1, name: label }));
  }

  return sheetLine('focus.button', lang, kioskId, opts({ label }));
}
