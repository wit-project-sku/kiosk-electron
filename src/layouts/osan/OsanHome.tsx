/**
 * 오산시 오색시장 (W004) home — Figma node 7812:106458 (WIT-WITH>디자인, 오산>홈),
 * the 2026-10 redesign.
 *
 * Built from the node via get_design_context; every position/size in
 * OsanHome.module.css is the exact Figma value (1 CSS px = 1 Figma px inside
 * KioskArtboard). All artwork is exported from its OWN Figma node into
 * assets/icons/osan as `home-*` — the older files there still serve the
 * sub-pages, so nothing is matched by filename.
 *
 * Layout, top to bottom: location + clock · 공지 card with live weather ·
 * 오늘의 상점 board · search row · 3 feature cards · 12-tile grid on a white
 * panel · 프로모션 / 사진촬영 / 화장실. The frame is the 제주 home's structure
 * re-skinned in 오색시장 navy, and like that one it draws nothing under the
 * bottom row — the rotating banner (y3267–3840) is no longer part of this screen.
 *
 * Copy: Korean is the frame's own text. Other languages read Localization_Osaek
 * (MainButton_*), with the second lines and the cards' subtitles authored here
 * because the sheet has no rows for them yet.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskScreenId } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { trackEvent } from '@renderer/lib/analytics';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { useWeatherVideo } from '@renderer/hooks/useWeatherVideo';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { weatherIconName, weatherIconUrl } from '@renderer/assets/weather';
import { useHasDonationTile, useOrderedTiles, type TileKey } from '@renderer/lib/buttonLayout';
import { pick, type Lang } from '@renderer/lib/i18n';
import { sheetText, t, tExact } from '@renderer/lib/loc';
import { DONATION_COMING_SOON, withComingSoon } from '@shared/config/donation';
import { SearchIcon } from '@layouts/components/SearchIcon';
import { useFitText } from '@layouts/components/fitText';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';
import { HangulComposer } from '../insadong/keyboard/hangul';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import { OsanLeftNav } from './OsanLeftNav';
import { OsanBanner } from './OsanBanner';
import { OsanShopBoard } from './OsanShopBoard';
import styles from './OsanHome.module.css';

type Text = Partial<Record<Lang, string>>;

interface OsanHomeProps {
  controller: KioskController;
}

// ── Tiles ──────────────────────────────────────────────────────────────
interface Tile {
  screen: KioskScreenId;
  /** Analytics label handed to navigate() — must stay the CMS `button_type` join. */
  label: string;
  /** Korean title as the frame draws it. */
  title: string;
  /** Localization_Osaek key for the other languages' title. */
  titleKey?: string;
  /** Authored title for the other languages when the sheet has no usable row. */
  titleText?: Text;
  /** Second line under the title. */
  sub: Text;
  /** osanIconUrl key — the 300×300 plate exported from the tile's own node. */
  icon: string;
  /** Title letter-spacing the frame sets on this one tile (여기는 오색시장). */
  tracking?: string;
}

/**
 * 물품's fallback title. The sheet now carries its own row (MainButton_ToBuy2,
 * "To buy(goods)"), so this only covers a language whose cell is empty.
 */
/**
 * 지역화폐's title in the other languages. Localization_Osaek has no
 * MainButton_MarketPaper row yet (the tile showed Korean everywhere); this is
 * Localization_Hwaseong's row for the same tile, and gives way to an 오색 row
 * as soon as the sheet adds one.
 */
const LOCALPAY_TITLE: Text = {
  ko: '지역화폐',
  en: 'Local Currency',
  ja: 'ちいきの おかね',
  zh: '地区货币',
  vi: 'Tiền tệ địa phương',
  th: 'สกุลเงินท้องถิ่น',
  ru: 'Местная валюта',
  id: 'Mata uang lokal',
};

const LODGING_TITLE: Text = {
  en: 'To buy (Goods)',
  ja: 'お買い物（物品）',
  zh: '我们买什么呢？(物品)',
  vi: 'Mua gì (Hàng hóa)',
  th: 'ซื้ออะไรดี (สินค้า)',
  ru: 'Что купить (Товары)',
  id: 'Mau beli apa (Barang)',
};

/**
 * The 12 grid tiles in the frame's reading order (4 columns × 3 rows).
 *
 * Three second lines in the frame are copy left over from the 제주 home it was
 * built from — 제주 숙소 모음 (뭐사지 물품), 제주공공플랫폼 (교통안내) and 탐나는전
 * (지역화폐). Those three are authored for 오색시장 instead; the other nine are
 * the frame's text.
 */
const TILES: Tile[] = [
  {
    screen: 'eat', label: "'정이' 뭐먹지", title: "'정이' 뭐먹지", titleKey: 'MainButton_ToEat', icon: 'home-tile-eat',
    sub: { ko: '맛집 추천', en: 'Restaurant picks', ja: 'おすすめグルメ', zh: '美食推荐', vi: 'Gợi ý quán ăn', th: 'ร้านอาหารแนะนำ', ru: 'Где поесть', id: 'Rekomendasi kuliner' },
  },
  {
    screen: 'shop', label: "'정이' 뭐사지(식품)", title: "'정이' 뭐사지(식품)", titleKey: 'MainButton_ToBuy', icon: 'home-tile-shop',
    sub: { ko: '쇼핑 추천', en: 'Shopping picks', ja: 'おすすめショッピング', zh: '购物推荐', vi: 'Gợi ý mua sắm', th: 'แนะนำช้อปปิ้ง', ru: 'Покупки', id: 'Rekomendasi belanja' },
  },
  {
    screen: 'lodging', label: "'정이' 뭐사지(물품)", title: '‘정이’ 뭐사지(물품)', titleKey: 'MainButton_ToBuy2', titleText: LODGING_TITLE, icon: 'home-tile-goods',
    sub: { ko: '물품 추천', en: 'Goods picks', ja: 'おすすめ雑貨', zh: '商品推荐', vi: 'Gợi ý hàng hóa', th: 'แนะนำสินค้า', ru: 'Товары', id: 'Rekomendasi barang' },
  },
  {
    screen: 'taxfree', label: 'TAX-FREE', title: 'TAX-FREE', icon: 'home-tile-taxfree',
    sub: { ko: '면세혜택', en: 'Tax refund', ja: '免税特典', zh: '免税优惠', vi: 'Ưu đãi miễn thuế', th: 'สิทธิ์ปลอดภาษี', ru: 'Возврат налога', id: 'Bebas pajak' },
  },
  {
    screen: 'about', label: '여기는 오색시장', title: '여기는 오색시장', titleKey: 'MainButton_Here', icon: 'home-tile-about', tracking: '-0.76px',
    sub: { ko: '관광지 추천', en: 'Attractions', ja: 'おすすめ観光地', zh: '景点推荐', vi: 'Điểm tham quan', th: 'สถานที่ท่องเที่ยว', ru: 'Достопримечательности', id: 'Tempat wisata' },
  },
  {
    screen: 'hello', label: "안녕 '정이'", title: '안녕 ’정이’', titleKey: 'MainButton_Greeting', icon: 'home-tile-hello',
    sub: { ko: '‘정이’ 소개', en: 'Meet Jeong-i', ja: 'ジョンイの紹介', zh: '认识Jeong-i', vi: 'Giới thiệu Jeong-i', th: 'แนะนำจองอี', ru: 'Знакомьтесь, Чон-и', id: 'Kenalan dengan Jeong-i' },
  },
  {
    screen: 'help', label: "도와줘 '정이'", title: '도와줘 ‘정이’', titleKey: 'MainButton_ToHelp', icon: 'home-tile-help',
    sub: { ko: '편의시설 안내', en: 'Amenities', ja: '便利施設のご案内', zh: '便利设施指南', vi: 'Tiện ích', th: 'สิ่งอำนวยความสะดวก', ru: 'Удобства', id: 'Fasilitas' },
  },
  {
    screen: 'map', label: '오색시장 지도', title: '오색시장 지도', titleKey: 'MainButton_Map', icon: 'home-tile-map',
    sub: { ko: '지도', en: 'Map', ja: '地図', zh: '地图', vi: 'Bản đồ', th: 'แผนที่', ru: 'Карта', id: 'Peta' },
  },
  {
    screen: 'exchange', label: '환율', title: '환율', titleKey: 'MainButton_Exchange', icon: 'home-tile-exchange',
    sub: { ko: '환율 계산기', en: 'Currency calculator', ja: '為替計算', zh: '汇率计算器', vi: 'Tính tỷ giá', th: 'คำนวณอัตราแลกเปลี่ยน', ru: 'Калькулятор валют', id: 'Kalkulator kurs' },
  },
  {
    screen: 'donation', label: '기부', title: '기부', titleKey: 'MainButton_Donation', icon: 'home-tile-donation',
    sub: { ko: '교복 기부', en: 'Uniform donation', ja: '制服の寄付', zh: '校服捐赠', vi: 'Quyên góp đồng phục', th: 'บริจาคชุดนักเรียน', ru: 'Пожертвование формы', id: 'Donasi seragam' },
  },
  {
    screen: 'transport', label: '교통안내', title: '교통안내', titleKey: 'MainButton_Transport', icon: 'home-tile-transport',
    sub: { ko: '대중교통 안내', en: 'Public transit', ja: '公共交通のご案内', zh: '公共交通指南', vi: 'Giao thông công cộng', th: 'ขนส่งสาธารณะ', ru: 'Общественный транспорт', id: 'Transportasi umum' },
  },
  {
    screen: 'museum', label: '지역화폐', title: '지역화폐', titleKey: 'MainButton_MarketPaper', titleText: LOCALPAY_TITLE, icon: 'home-tile-localpay',
    sub: { ko: '오색전·온누리', en: 'Osaekjeon · Onnuri', ja: 'オセク銭・オンヌリ', zh: '五色钱·温努里', vi: 'Osaekjeon · Onnuri', th: 'โอแซกจอน · ออนนูรี', ru: 'Осэкчон · Оннури', id: 'Osaekjeon · Onnuri' },
  },
];

/** Join a home tile to its CMS button row by screen key (see useOrderedTiles). */
const osanTileKey = (tile: Tile): TileKey => ({ screen: tile.screen });

/** 300-wide tile + 180 gap across, 412-tall tile + 80 gap down. */
const COL_STEP = 480;
const ROW_STEP = 492;
const COLS = 4;
/* ♿ low-reach grid (Figma 7894:57306): 6 × 2 tiles, 230 wide, justified across
   1792.059 → 312.41 apart; rows 374.27 apart. */
const LOW_COLS = 6;
const LOW_COL_STEP = (1792.059 - 230) / 5;
const LOW_ROW_STEP = 374.27;

// ── Feature cards ──────────────────────────────────────────────────────
/**
 * Localization_Osaek's second-line row per home button (`MainButton_*_Subtext`).
 * The sheet drives the line wherever it has a cell for the language; the
 * authored `sub` covers the gaps. 지역화폐 has no row yet.
 */
const SUB_KEYS: Partial<Record<KioskScreenId, string>> = {
  ai_search: 'MainButton_AI_Subtext',
  market: 'MainButton_WITH_Market_Subtext',
  events: 'MainButton_Event_Subtext',
  eat: 'MainButton_ToEat_Subtext',
  shop: 'MainButton_ToBuy_SubText',
  lodging: 'MainButton_ToBuy2_Subtext',
  taxfree: 'MainButton_TaxFree_Subtext',
  about: 'MainButton_Here_Subtext',
  hello: 'MainButton_Greeting_Subtext',
  help: 'MainButton_ToHelp_Subtext',
  map: 'MainButton_Map_Subtext',
  exchange: 'MainButton_Exchange_Subtext',
  donation: 'MainButton_Donation_Subtext',
  transport: 'MainButton_Transport_Subtext',
};

interface Card {
  screen: KioskScreenId;
  label: string;
  title: string;
  titleKey: string;
  sub: Text;
  icon: string;
  /** Key into the per-card position/colour rules in OsanHome.module.css. */
  variant: 'cardAi' | 'cardMarket' | 'cardEvents';
}

const CARDS: Card[] = [
  {
    screen: 'ai_search', label: "'정이' 모하지 (AI검색)", title: "'정이' 뭐하지", titleKey: 'MainButton_AI', icon: 'home-card-ai', variant: 'cardAi',
    sub: { ko: 'AI 검색하기', en: 'AI search', ja: 'AI検索', zh: 'AI搜索', vi: 'Tìm kiếm AI', th: 'ค้นหาด้วย AI', ru: 'AI-поиск', id: 'Pencarian AI' },
  },
  {
    screen: 'market', label: '위드마켓', title: '위드마켓', titleKey: 'MainButton_WITH_Market', icon: 'home-card-market', variant: 'cardMarket',
    sub: { ko: '굿즈 만들기', en: 'Make goods', ja: 'グッズ作り', zh: '制作周边', vi: 'Làm quà lưu niệm', th: 'ทำของที่ระลึก', ru: 'Создать сувенир', id: 'Buat merchandise' },
  },
  {
    screen: 'events', label: '오산시 이벤트', title: '오산시 이벤트', titleKey: 'MainButton_Event', icon: 'home-card-events', variant: 'cardEvents',
    sub: { ko: '오산시 행사', en: 'Osan events', ja: '烏山市の行事', zh: '乌山市活动', vi: 'Sự kiện Osan', th: 'งานเมืองโอซาน', ru: 'События Осана', id: 'Acara Kota Osan' },
  },
];

// ── Copy ───────────────────────────────────────────────────────────────
/** Promo (K-DRAMA slot) caption — base word only; `withComingSoon` adds 준비중. */
const PROMO_LABEL: Text = {
  ko: '프로모션',
  en: 'PROMOTION',
  ja: 'PROMOTION',
  zh: '促销活动',
  vi: 'CHƯƠNG TRÌNH KHUYẾN MÃI',
  th: 'โปรโมชั่น',
  ru: 'АКЦИЯ',
  id: 'PROMOSI',
};

const SEARCH_PLACEHOLDER: Text = {
  ko: '오색시장에 대해 검색해보세요!',
  en: 'Search about Osaek Market!',
  ja: 'オセク市場について検索しましょう！',
  zh: '搜索关于五色市场的内容！',
  vi: 'Tìm kiếm về chợ Osaek!',
  th: 'ค้นหาเกี่ยวกับตลาดโอแซก!',
  ru: 'Поиск о рынке Осэк!',
  id: 'Cari tentang Pasar Osaek!',
};

/** Language button label — must match the 언어선택 pill codes (OsanLanguage). */
const LANG_CODE: Record<string, string> = {
  ko: 'KR', en: 'EN', ja: 'JP', zh: 'CN', vi: 'VN', th: 'TH', ru: 'RU', id: 'ID',
};

/** The sheet's value for `key`, or `fallback` when the row is missing or blank. */
function sheetOr(key: string | undefined, lang: Lang, fallback: string): string {
  if (!key) return fallback;
  const value = t(key, lang);
  return value && value !== key ? value : fallback;
}

/**
 * NoticeContent as bold/plain runs. The sheet marks bold with literal `<b>…</b>`
 * (an opening tag toggles, so a mistyped `<b>…<b>` still closes). Line breaks
 * become spaces: the rule beside the copy is drawn for three 70px lines, and the
 * browser wraps the text to the 977px box rather than to the cell's breaks.
 */
type Run = { text: string; bold?: boolean };
function parseNotice(text: string): Run[] {
  const runs: Run[] = [];
  let bold = false;
  for (const tok of text.split(/(<\s*\/?\s*b\s*>|<\s*br\s*\/?\s*>|\n)/gi)) {
    if (!tok) continue;
    if (/^<\s*\/?\s*b\s*>$/i.test(tok)) {
      bold = /^<\s*\//.test(tok) ? false : !bold;
      continue;
    }
    if (tok === '\n' || /^<\s*br/i.test(tok)) {
      runs.push({ text: ' ' });
      continue;
    }
    runs.push({ text: tok, bold });
  }
  return runs;
}

// ── Date / time ────────────────────────────────────────────────────────
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** `2025-09-13(Mon)  ㅣ  06:00` — the exact format in the frame's top bar. */
function formatDateTime(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}(${DAY_NAMES[d.getDay()]})  ㅣ  ${hh}:${mm}`;
}

/** Search row geometry (mirrors .searchRow) — the keyboard tray opens flush under it. */
const SEARCH_ROW_TOP = 1136;
const SEARCH_ROW_HEIGHT = 182;

export function OsanHome({ controller }: OsanHomeProps): JSX.Element {
  const { navigate, startPhoto, kioskId } = controller;
  const weather = useWeatherStore((s) => s.weather);
  const playWeatherVideo = useWeatherVideo();
  const lang = useLanguageStore((s) => s.currentLanguage);
  const setSearchQuery = useSearchStore((s) => s.setQuery);
  const low = useAccessibilityStore((s) => s.lowReach);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const clock = useMemo(() => formatDateTime(now), [now]);

  // Inline search keyboard — the field never navigates on tap, only on Enter.
  const composer = useRef(new HangulComposer());
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const submitSearch = (): void => {
    const q = composer.current.value.trim();
    setSearching(false);
    if (q) {
      trackEvent({ name: 'button_clicked', payload: { screen: 'search_submit', query: q, kioskId } });
      setSearchQuery(q);
      navigate('search', '검색');
    }
  };

  const applyKey = (action: KeyAction): void => {
    const c = composer.current;
    switch (action.type) {
      case 'jamo':      c.inputJamo(action.value);    break;
      case 'literal':   c.inputLiteral(action.value); break;
      case 'space':     c.inputLiteral(' ');          break;
      case 'backspace': c.backspace();                break;
      case 'enter':     submitSearch(); return;
    }
    setQuery(c.value);
  };

  /**
   * 기부 is in the frame on every 오산 kiosk, but the flow only exists where the
   * donation app runs (a card terminal + a 기부 CMS row — useHasDonationTile) and
   * is live (DONATION_COMING_SOON). Anywhere else the tile stays drawn, coloured
   * and labelled 준비중, but does nothing: OsanKiosk mounts no donation layer to
   * navigate to.
   */
  const hasDonation = useHasDonationTile(kioskId);
  const donationPending = DONATION_COMING_SOON || !hasDonation;

  /*
   * Grid order from the buttons CMS, falling back to the frame's order. The CMS
   * still carries the old grid (시장화폐 / 전국 시장, no 지도 row), so today the
   * join misses and the authored order — the frame's — is what renders.
   */
  const orderedTiles = useOrderedTiles(kioskId, TILES, osanTileKey);

  // Every language follows the sheet's own cell first (Korean included); the
  // frame's title / authored copy covers a cell that is empty.
  const titleOf = (item: Tile | Card): string => {
    const own = item.titleKey ? tExact(item.titleKey, lang) : '';
    if (own) return own;
    if (lang === 'ko') return item.title;
    const authored = 'titleText' in item && item.titleText ? pick(item.titleText, lang) : item.title;
    return sheetOr(item.titleKey, lang, authored);
  };
  const subOf = (item: Tile | Card): string => {
    const key = SUB_KEYS[item.screen];
    return key ? sheetText(key, lang, item.sub) : pick(item.sub, lang);
  };
  const tileTitle = (tile: Tile): string => {
    const base = titleOf(tile);
    return tile.screen === 'donation' && donationPending ? withComingSoon(base, lang) : base;
  };

  const noticeRuns = parseNotice(t('NoticeContent', lang));
  const noticeBody = noticeRuns.map((run, i) =>
    run.bold ? <b key={i}>{run.text}</b> : <span key={i}>{run.text}</span>,
  );

  const weatherIcon = weather ? weatherIconUrl(weatherIconName(weather.icon, weather.main)) : undefined;

  /**
   * ── Other languages ─────────────────────────────────────────────────────
   * Korean is laid out exactly as the frame draws it. Every other language runs
   * longer, and three blocks have nowhere to grow — the notice band above the
   * board, the 310-tall cards, and a tile's text under its plate. In `wide` mode
   * each block's text wraps through the whole band it has (see "Other languages"
   * at the foot of the CSS) and only copy that still outgrows it scales down, by
   * one factor per block. Nothing is clamped. See fitText.ts.
   */
  const wide = lang !== 'ko';
  const noticeRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const fitKey = [
    lang,
    noticeRuns.map((r) => r.text).join(''),
    CARDS.map((c) => titleOf(c) + subOf(c)).join('|'),
    orderedTiles.map((tile) => tileTitle(tile) + subOf(tile)).join('|'),
  ].join('§');
  useFitText(noticeRef, styles.noticeLead, wide, 0.7, fitKey);
  useFitText(cardsRef, styles.cardText, wide, 0.75, fitKey);
  useFitText(gridRef, styles.tileText, wide, 0.7, fitKey);

  const icon = osanIconUrl;

  return (
    <div className={low ? `${styles.root} ${styles.homeLow}` : styles.root}>
      {/* ── Top bar: location + date/time ── */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <span className={styles.locationIcon}>
            {icon('home-location') && (
              <img src={icon('home-location')} alt="" className={styles.locationIconImg} draggable={false} />
            )}
          </span>
          <span className={styles.siteName}>OSAEK MARKET</span>
        </div>
        <span className={styles.dateTime}>{clock}</span>
      </div>

      {/* ── 공지 card + weather ── */}
      <div className={styles.notice}>
        {wide ? (
          <div className={`${styles.noticeLead} ${styles.noticeLeadWide}`} ref={noticeRef}>
            <div className={styles.noticeRow}>
              <div className={styles.noticeRule} />
              <p className={`${styles.noticeText} ${styles.noticeTextWide}`}>{noticeBody}</p>
            </div>
          </div>
        ) : (
          <div className={styles.noticeLead}>
            <div className={styles.noticeRule} />
            <p className={styles.noticeText}>{noticeBody}</p>
          </div>
        )}

        {/* Tapping the weather plays today's condition clip on the customer
            display, as it always has on this kiosk. */}
        <button type="button" className={styles.weather} onClick={playWeatherVideo} aria-label="오늘 날씨 영상">
          <span className={styles.weatherTemp}>{weather ? `${Math.round(weather.tempC)}˚` : '--˚'}</span>
          {weatherIcon && <img src={weatherIcon} alt="" className={styles.weatherIcon} draggable={false} />}
        </button>
      </div>

      {/* ── 오늘의 상점 board + 상점 정보 더보기 ── */}
      <OsanShopBoard controller={controller} lang={lang} now={now} low={low} />

      {/* ── Search row ── */}
      <div className={styles.searchRow}>
        <button type="button" className={styles.searchHome} onClick={() => navigate('home', '홈')} aria-label="홈">
          {icon('home-search-home') && (
            <img src={icon('home-search-home')} alt="" className={styles.searchHomeImg} draggable={false} />
          )}
        </button>

        <div className={styles.searchField} onClick={() => setSearching(true)} role="button">
          <span className={`${styles.searchText} ${query ? styles.searchValue : styles.searchPlaceholder}`}>
            {query || pick(SEARCH_PLACEHOLDER, lang)}
            {searching && <span className={styles.searchCaret} />}
          </span>
          <span className={styles.searchIcon}>
            <SearchIcon className={styles.searchIconSvg} />
          </span>
        </div>

        <button
          type="button"
          className={styles.langBtn}
          onClick={() => navigate('language', '언어선택')}
          aria-label="언어선택"
        >
          {LANG_CODE[lang] ?? lang.toUpperCase()}
        </button>
      </div>

      {/* ── Three feature cards ── */}
      <div className={styles.cards} ref={cardsRef}>
        {CARDS.map((card) => {
          const title = <span className={styles.cardTitle}>{titleOf(card)}</span>;
          const sub = <span className={styles.cardSub}>{subOf(card)}</span>;
          return (
            <button
              key={card.screen}
              type="button"
              className={`${styles.card} ${styles[card.variant]}`}
              onClick={() => navigate(card.screen, card.label)}
            >
              {wide ? (
                <span className={styles.cardText}>
                  {title}
                  {sub}
                </span>
              ) : (
                <>
                  {title}
                  {sub}
                </>
              )}
              <span className={styles.cardArt}>
                {icon(card.icon) && (
                  <img src={icon(card.icon)} alt="" className={styles.cardArtImg} draggable={false} />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Menu grid on its white panel ── */}
      <div className={styles.panel} />
      <div className={styles.grid} ref={gridRef}>
        {orderedTiles.map((tile, i) => {
          const art = icon(tile.icon);
          const inert = tile.screen === 'donation' && donationPending;
          return (
            <button
              key={tile.screen}
              type="button"
              className={inert ? `${styles.tile} ${styles.tileInert}` : styles.tile}
              style={
                low
                  ? { left: (i % LOW_COLS) * LOW_COL_STEP, top: Math.floor(i / LOW_COLS) * LOW_ROW_STEP }
                  : { left: (i % COLS) * COL_STEP, top: Math.floor(i / COLS) * ROW_STEP }
              }
              onClick={inert ? undefined : () => navigate(tile.screen, tile.label)}
              aria-disabled={inert || undefined}
            >
              {art ? (
                <img src={art} alt="" className={styles.tileArt} draggable={false} />
              ) : (
                <span className={styles.tileArtMissing}>{tile.title[0]}</span>
              )}
              <span className={`${styles.tileText} ${wide ? styles.tileTextFit : ''}`}>
                <span
                  className={styles.tileTitle}
                  style={!wide && tile.tracking ? { letterSpacing: tile.tracking } : undefined}
                >
                  {tileTitle(tile)}
                </span>
                <span className={styles.tileSub}>{subOf(tile)}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Left nav: home · back · ♿ (shared with every content screen) ── */}
      <OsanLeftNav onHome={() => navigate('home', '홈')} onBack={() => navigate('home', '뒤로')} />

      {/* ── Bottom actions: 프로모션 · 사진촬영 · 화장실 ── */}
      {/* 프로모션 (K-DRAMA slot) is gated 준비중: full colour, not tappable. */}
      <div className={styles.promo} aria-disabled="true">
        {icon('home-kdrama') && <img src={icon('home-kdrama')} alt="" className={styles.promoLogo} draggable={false} />}
      </div>
      <span className={`${styles.actionLabel} ${styles.labelPromo}`}>{withComingSoon(pick(PROMO_LABEL, lang), lang)}</span>

      <button type="button" className={styles.camera} onClick={startPhoto} aria-label="사진 촬영">
        {icon('home-camera') && <img src={icon('home-camera')} alt="" className={styles.actionImg} draggable={false} />}
      </button>

      <button type="button" className={styles.restroom} onClick={() => navigate('restroom', '화장실')} aria-label="화장실">
        {icon('home-restroom') && <img src={icon('home-restroom')} alt="" className={styles.actionImg} draggable={false} />}
      </button>
      <span className={`${styles.actionLabel} ${styles.labelRestroom}`}>{t('MainButton_WC', lang)}</span>

      <FloatingKeyboard
        open={searching}
        onKey={applyKey}
        onClose={() => setSearching(false)}
        lang={lang}
        /* ♿ 오산>검색-01 7894:58134 draws the keyboard at 2133, 1 over the row. */
        top={low ? 2133 : SEARCH_ROW_TOP + SEARCH_ROW_HEIGHT}
      />

      {/* ♿ the promo moves up under the mode bar (Figma 7894:57182). */}
      {low && <OsanBanner onClick={startPhoto} top={146} />}
    </div>
  );
}
