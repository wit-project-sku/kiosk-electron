/**
 * 화성휴게소 (W005) home — Figma node 7904:104580 (WIT-WITH>디자인), the
 * 2026-10 redesign.
 *
 * Built from the node via get_design_context; every position/size in
 * HwaseongHome.module.css is the exact Figma value (1 CSS px = 1 Figma px inside
 * KioskArtboard). Artwork is each layer's own export in assets/icons/hwaseong as
 * `home-*`; the plates' colours are CSS, as in the frame.
 *
 * Layout, top to bottom: location + clock · 공지 card with live weather ·
 * 오늘의 상점 board · search row · 3 feature cards · 12-tile grid on a white
 * panel · 스마트관광 / 사진촬영 / 화장실. The frame is the 오산 home's structure
 * in [화성휴게소] main 1 #005AB4, and like it draws no rotating banner.
 *
 * Copy: Korean is the frame's own text, except where the frame still carries
 * 제주 / 오산 leftovers (the notice, the board, four second lines and the
 * cards' subtitles) — those are authored for 화성휴게소 here. Other languages
 * read Localization_Hwaseong (MainButton_*).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { KioskScreenId } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { trackEvent } from '@renderer/lib/analytics';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { useWeatherVideo } from '@renderer/hooks/useWeatherVideo';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { weatherIconName, weatherIconUrl } from '@renderer/assets/weather';
import { useHasDonationTile } from '@renderer/lib/buttonLayout';
import { buttonText, pick, type Lang } from '@renderer/lib/i18n';
import { t, tExact } from '@renderer/lib/loc';
import { DONATION_COMING_SOON, withComingSoon } from '@shared/config/donation';
import { SearchIcon } from '@layouts/components/SearchIcon';
import { useFitText } from '@layouts/components/fitText';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';
import { HangulComposer } from '../insadong/keyboard/hangul';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import { HwaseongBanner } from './HwaseongBanner';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import { HwaseongShopBoard } from './HwaseongShopBoard';
import styles from './HwaseongHome.module.css';

type Text = Partial<Record<Lang, string>>;

interface Props {
  controller: KioskController;
}

// ── Tiles ──────────────────────────────────────────────────────────────
/** One exported layer inside a 300×300 plate: its key, box and offset (Figma px). */
interface Art {
  icon: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Tile {
  screen: KioskScreenId;
  /** Analytics label handed to navigate() — the CMS `button_type` join. */
  label: string;
  /** Korean title as the frame draws it. */
  title: string;
  /** Localization_Hwaseong key for the other languages' title. */
  titleKey: string;
  sub: Text;
  /** Plate fill from the frame. */
  plate: string;
  /** The tile's artwork; `null` = drawn by GoodsArt (a layered icon). */
  art: Art | null;
  /** 준비중 — drawn in full colour, not tappable. */
  pending?: boolean;
  /** Title letter-spacing the frame sets on this one tile (화성휴게소). */
  tracking?: string;
  /** Analytics/CMS slot when tiles share a screen key (the rest_info trio). */
  slot?: number;
}

/**
 * The 12 grid tiles in the frame's reading order (4 columns × 3 rows).
 *
 * Four second lines in the frame are leftovers from the 제주 / 오산 homes it was
 * copied from — 제주 숙소 모음 (뭐사지), 환율 계산기 (문화재), 제주공공플랫폼
 * (K-컬처) and 탐나는전 (지역화폐). Those four are authored here; the other
 * eight are the frame's text.
 *
 * Art boxes are centred in the plate as the frame's auto layout centres them,
 * then shifted by each export's bleed (its SVG is larger than the layer box).
 */
const TILES: Tile[] = [
  {
    screen: 'food_court', label: "'휴' 뭐먹지", title: "'휴' 뭐먹지", titleKey: 'MainButton_ToEat', plate: '#fff0cb',
    art: { icon: 'home-tile-eat', left: 57.51, top: 47.85, width: 203.586, height: 203.839 },
    sub: { ko: '맛집 추천', en: 'Restaurant picks', ja: 'おすすめグルメ', zh: '美食推荐', vi: 'Gợi ý quán ăn', th: 'ร้านอาหารแนะนำ', ru: 'Где поесть', id: 'Rekomendasi kuliner' },
  },
  {
    screen: 'shop', label: "'휴' 뭐사지", title: '‘휴’ 뭐사지(물품)', titleKey: 'MainButton_ToBuy', plate: '#e5f2fc',
    art: null,
    sub: { ko: '물품 추천', en: 'Goods picks', ja: 'おすすめ雑貨', zh: '商品推荐', vi: 'Gợi ý hàng hóa', th: 'แนะนำสินค้า', ru: 'Товары', id: 'Rekomendasi barang' },
  },
  {
    // 전국시장 stays 준비중 (product gate, as before the redesign) — the frame
    // drops the marker, but the screen has not been released.
    screen: 'market', label: '전국시장(준비중)', title: '전국시장', titleKey: 'MainButton_TraditionalMarket', plate: '#ffe1fd',
    art: { icon: 'home-tile-market', left: 75, top: 75, width: 150, height: 150 }, pending: true,
    sub: { ko: '쇼핑 추천', en: 'Shopping picks', ja: 'おすすめショッピング', zh: '购物推荐', vi: 'Gợi ý mua sắm', th: 'แนะนำช้อปปิ้ง', ru: 'Покупки', id: 'Rekomendasi belanja' },
  },
  {
    screen: 'taxfree', label: 'TAX-FREE', title: 'TAX-FREE', titleKey: 'MainButton_TaxFree', plate: '#efefef',
    art: { icon: 'home-tile-taxfree', left: 47.5, top: 47.5, width: 205, height: 205 },
    sub: { ko: '면세혜택', en: 'Tax refund', ja: '免税特典', zh: '免税优惠', vi: 'Ưu đãi miễn thuế', th: 'สิทธิ์ปลอดภาษี', ru: 'Возврат налога', id: 'Bebas pajak' },
  },
  {
    screen: 'tourism', label: '화성휴게소', title: '화성휴게소', titleKey: 'MainButton_Here', plate: '#deffbc', tracking: '-0.76px',
    art: { icon: 'home-tile-here', left: 64, top: 64, width: 172, height: 172 },
    sub: { ko: '관광지 추천', en: 'Attractions', ja: 'おすすめ観光地', zh: '景点推荐', vi: 'Điểm tham quan', th: 'สถานที่ท่องเที่ยว', ru: 'Достопримечательности', id: 'Tempat wisata' },
  },
  {
    screen: 'hello', label: "안녕 '휴'", title: '안녕 ’휴’', titleKey: 'MainButton_Greeting', plate: '#ffe1e4',
    art: { icon: 'home-tile-hello', left: 72.656, top: 63.95, width: 154.688, height: 180.099 },
    sub: { ko: '‘휴’ 소개', en: 'Meet Hyu', ja: 'ヒュの紹介', zh: '认识Hyu', vi: 'Giới thiệu Hyu', th: 'แนะนำฮยู', ru: 'Знакомьтесь, Хю', id: 'Kenalan dengan Hyu' },
  },
  {
    screen: 'help', label: "도와줘 '휴'", title: '도와줘 ‘휴’', titleKey: 'MainButton_ToHelp', plate: '#ede4ff',
    art: { icon: 'home-tile-help', left: 48, top: 56, width: 204, height: 193 },
    sub: { ko: '편의시설 안내', en: 'Amenities', ja: '便利施設のご案内', zh: '便利设施指南', vi: 'Tiện ích', th: 'สิ่งอำนวยความสะดวก', ru: 'Удобства', id: 'Fasilitas' },
  },
  {
    // The frame's plate has no justify-center: the art sits at its 64.35 padding.
    screen: 'exchange', label: '환율', title: '환율', titleKey: 'MainButton_Exchange', plate: '#ffefd9',
    art: { icon: 'home-tile-exchange', left: 64.35, top: 56.5, width: 165, height: 187 },
    sub: { ko: '환율 계산기', en: 'Currency calculator', ja: '為替計算', zh: '汇率计算器', vi: 'Tính tỷ giá', th: 'คำนวณอัตราแลกเปลี่ยน', ru: 'Калькулятор валют', id: 'Kalkulator kurs' },
  },
  {
    screen: 'rest_info', label: '문화재(준비중)', title: '문화재(준비중)', titleKey: 'MainButton_Property', plate: '#d3b7a5', slot: 16,
    art: { icon: 'home-tile-heritage', left: 60, top: 50.93, width: 180, height: 202.137 }, pending: true,
    sub: { ko: '문화유산 안내', en: 'Heritage guide', ja: '文化遺産のご案内', zh: '文化遗产指南', vi: 'Di sản văn hóa', th: 'มรดกทางวัฒนธรรม', ru: 'Культурное наследие', id: 'Warisan budaya' },
  },
  {
    screen: 'donation', label: '기부', title: '기부', titleKey: 'MainButton_Donation', plate: '#e5f7f4',
    art: { icon: 'home-tile-donation', left: 56, top: 42, width: 178.27, height: 199.327 },
    sub: { ko: '교복 기부', en: 'Uniform donation', ja: '制服の寄付', zh: '校服捐赠', vi: 'Quyên góp đồng phục', th: 'บริจาคชุดนักเรียน', ru: 'Пожертвование формы', id: 'Donasi seragam' },
  },
  {
    screen: 'rest_info', label: 'K-컬처(준비중)', title: 'K-컬처(준비중)', titleKey: 'MainButton_KCulture', plate: '#fff5bb', slot: 17,
    art: { icon: 'home-tile-kculture', left: 61.5, top: 56.5, width: 177, height: 186.189 }, pending: true,
    sub: { ko: '한류 문화 체험', en: 'K-culture experience', ja: '韓流カルチャー体験', zh: '韩流文化体验', vi: 'Trải nghiệm văn hóa Hàn', th: 'สัมผัสวัฒนธรรมเกาหลี', ru: 'Корейская культура', id: 'Pengalaman budaya Korea' },
  },
  {
    screen: 'rest_info', label: '지역화폐', title: '지역화폐', titleKey: 'MainButton_MarketPaper', plate: '#f2ede6', slot: 18,
    art: { icon: 'home-tile-localpay', left: 43, top: 43, width: 214, height: 214 },
    sub: { ko: '행복화성지역화폐', en: 'Hwaseong local currency', ja: '華城地域通貨', zh: '华城地方货币', vi: 'Tiền địa phương Hwaseong', th: 'เงินท้องถิ่นฮวาซอง', ru: 'Местная валюта Хвасона', id: 'Mata uang lokal Hwaseong' },
  },
];

/** 300-wide tile + 180 gap across, 412-tall tile + 80 gap down. */
const COL_STEP = 480;
const ROW_STEP = 492;
const COLS = 4;
/* ♿ low-reach grid (Figma 7904:105099): 6 × 2 tiles, 230 wide, justified
   across 1792.059 → 312.41 apart; rows 374.27 apart. */
const LOW_COLS = 6;
const LOW_COL_STEP = (1792.059 - 230) / 5;
const LOW_ROW_STEP = 374.27;
/* ♿ the keyboard opens flush under the low search row (1952 + 182 − 1). */
const LOW_KEYBOARD_TOP = 2133;

/**
 * '휴' 뭐사지 plate art — the frame's '인사' 뭐사지 icon group (7904:104783), a
 * stack of layers rather than one export: bag, four leaves, the knot, the band
 * and a 30% photo. Offsets are the group's own (177.62 × 182.7, centred).
 */
function GoodsArt(): JSX.Element {
  const i = hwaseongIconUrl;
  const leaf = (icon: string, box: CSSProperties, inner: string): JSX.Element => (
    <span className={styles.goodsLeafBox} style={box}>
      <img src={i(icon)} alt="" className={styles.goodsLeaf} style={{ transform: inner }} draggable={false} />
    </span>
  );
  return (
    <span className={styles.goods}>
      <img src={i('home-tile-goods-bag')} alt="" className={styles.goodsBag} draggable={false} />
      {leaf('home-tile-goods-leaf1', { left: 89.94, top: 1.6, width: 87.682, height: 80.498 }, 'rotate(-29.94deg)')}
      {leaf('home-tile-goods-leaf2', { left: 0, top: 5.75, width: 87.682, height: 80.498 }, 'scaleY(-1) rotate(-150.06deg)')}
      {leaf('home-tile-goods-leaf3', { left: 89.36, top: 0, width: 85.551, height: 74.734 }, 'rotate(-21.97deg)')}
      {leaf('home-tile-goods-leaf4', { left: 2.72, top: 4.15, width: 85.551, height: 74.734 }, 'scaleY(-1) rotate(-158.03deg)')}
      <img src={i('home-tile-goods-knot')} alt="" className={styles.goodsKnot} draggable={false} />
      <span className={styles.goodsBand} />
      <span className={styles.goodsBandLight} />
      <span className={styles.goodsClasp} />
      <img src={i('home-tile-goods-photo')} alt="" className={styles.goodsPhoto} draggable={false} />
    </span>
  );
}

// ── Feature cards ──────────────────────────────────────────────────────
interface Card {
  screen: KioskScreenId;
  label: string;
  title: string;
  titleKey: string;
  /** The frame's subtitles are 오산 leftovers (AI 검색하기 / 굿즈 만들기 /
   *  오산시 행사) — these are authored for the three 화성 destinations. */
  sub: Text;
  variant: 'cardTraffic' | 'cardRest' | 'cardEvents';
}

const CARDS: Card[] = [
  {
    screen: 'transport', label: '전국도로교통상황', title: '전국도로교통상황', titleKey: 'MainButton_TrafficInfo', variant: 'cardTraffic',
    sub: { ko: '실시간 교통정보', en: 'Live traffic', ja: 'リアルタイム交通情報', zh: '实时交通信息', vi: 'Giao thông trực tiếp', th: 'สภาพจราจรสด', ru: 'Пробки онлайн', id: 'Lalu lintas langsung' },
  },
  {
    screen: 'convenience', label: '전국휴게소', title: '전국휴게소', titleKey: 'MainButton_ServiceArea', variant: 'cardRest',
    sub: { ko: '휴게소 정보', en: 'Rest area info', ja: 'SA情報', zh: '休息站信息', vi: 'Thông tin trạm dừng', th: 'ข้อมูลจุดพักรถ', ru: 'Зоны отдыха', id: 'Info rest area' },
  },
  {
    screen: 'events', label: '화성시 이벤트', title: '화성시 이벤트', titleKey: 'MainButton_Event', variant: 'cardEvents',
    sub: { ko: '화성시 행사', en: 'Hwaseong events', ja: '華城市の行事', zh: '华城市活动', vi: 'Sự kiện Hwaseong', th: 'งานเมืองฮวาซอง', ru: 'События Хвасона', id: 'Acara Kota Hwaseong' },
  },
];

/** 화성시 이벤트 card art (Layer_4, 7904:104639) — ten layers, two of them masked. */
function EventsArt(): JSX.Element {
  const i = hwaseongIconUrl;
  const mask = `url("${i('home-card-events-mask') ?? ''}")`;
  return (
    <span className={styles.eventsArt}>
      <img src={i('home-card-events-a')} alt="" className={styles.evA} draggable={false} />
      <img src={i('home-card-events-b')} alt="" className={styles.evB} draggable={false} />
      <img src={i('home-card-events-c')} alt="" className={styles.evC} draggable={false} />
      <span className={styles.evD} style={{ maskImage: mask, WebkitMaskImage: mask }}>
        <img src={i('home-card-events-d')} alt="" draggable={false} />
      </span>
      <span className={styles.evE} style={{ maskImage: mask, WebkitMaskImage: mask }}>
        <img src={i('home-card-events-e')} alt="" draggable={false} />
      </span>
      <img src={i('home-card-events-f')} alt="" className={styles.evF} draggable={false} />
      <img src={i('home-card-events-g')} alt="" className={styles.evG} draggable={false} />
      <img src={i('home-card-events-h')} alt="" className={styles.evH} draggable={false} />
      <img src={i('home-card-events-i')} alt="" className={styles.evI} draggable={false} />
    </span>
  );
}

// ── Copy ───────────────────────────────────────────────────────────────
const SEARCH_PLACEHOLDER: Text = {
  ko: '화성휴게소에 대해 검색해보세요!',
  en: 'Search about Hwaseong Service Area!',
  ja: '華城SAについて検索してみてください！',
  zh: '搜索关于华城休息站的信息！',
  vi: 'Tìm kiếm về trạm dừng Hwaseong!',
  th: 'ค้นหาเกี่ยวกับจุดพักรถฮวาซอง!',
  ru: 'Поиск о зоне отдыха Хвасон!',
  id: 'Cari tentang Rest Area Hwaseong!',
};

/** 스마트관광 caption when the sheet's MainButton_SmartTour is blank (base word;
 *  withComingSoon adds 준비중). */
const SMART_TOUR: Text = {
  ko: '스마트관광',
  en: 'Smart Tourism',
  ja: 'スマート観光',
  zh: '智慧旅游',
  vi: 'Du lịch thông minh',
  th: 'การท่องเที่ยวอัจฉริยะ',
  ru: 'Умный туризм',
  id: 'Pariwisata Cerdas',
};

/** Language button label — must match the 언어선택 pill codes (HwaseongLanguage). */
const LANG_CODE: Record<string, string> = {
  ko: 'KR', en: 'EN', ja: 'JP', zh: 'CN', vi: 'VN', th: 'TH', ru: 'RU', id: 'ID',
};

/**
 * NoticeContent as bold/plain runs (`<b>…</b>`; a mistyped `<b>…<b>` still
 * closes). Line breaks become spaces: the rule beside the copy is drawn for
 * three 70px lines, and the text wraps to its 977px box.
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

/** `2025-09-13(Mon)  ㅣ  06:00` — the frame's top-bar format. */
function formatDateTime(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}(${DAY_NAMES[d.getDay()]})  ㅣ  ${hh}:${mm}`;
}

/** 키보드 tray top — Figma 7956:82920 draws it at 1315, 3 over the search row
 *  (1136 + 182). */
const KEYBOARD_TOP = 1315;

export function HwaseongHome({ controller }: Props): JSX.Element {
  const { navigate, startPhoto, kioskId } = controller;
  const weather = useWeatherStore((s) => s.weather);
  const playWeatherVideo = useWeatherVideo();
  const lang = useLanguageStore((s) => s.currentLanguage);
  const low = useAccessibilityStore((s) => s.lowReach);
  const setSearchQuery = useSearchStore((s) => s.setQuery);

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
   * 기부 is in the frame, but the flow only exists where the donation app runs
   * (useHasDonationTile) and is live. Anywhere else it stays drawn and coloured,
   * labelled 준비중, and inert. The old grid's 화성휴게소 지도 alternative for
   * slot 14 is not in the redesign.
   */
  const hasDonation = useHasDonationTile(kioskId);
  const donationPending = DONATION_COMING_SOON || !hasDonation;

  /*
   * The grid renders in the frame's order. The buttons CMS still carries the
   * pre-redesign layout (the wide traffic card in row 1, 지도 in slot 14), so
   * ordering by it would scramble the new grid — re-enable useOrderedTiles once
   * the CMS rows match this frame.
   */

  // Sheet value (curated buttonText first), else the frame's Korean.
  const sheet = (key: string): string => {
    const v = buttonText(key, lang) ?? t(key, lang);
    return v && v !== key ? v : '';
  };
  const titleOf = (item: Tile | Card): string => {
    if (lang === 'ko') return item.title;
    if (item.screen === 'taxfree') return 'TAX-FREE';
    const gated = 'pending' in item && item.pending;
    const base = sheet(item.titleKey) || item.title;
    // Live tiles drop a stale "(준비중)" the sheet may still carry.
    return gated ? base : base.replace(/\s*\(준비중\)\s*/g, '').trim();
  };
  const isInert = (tile: Tile): boolean => !!tile.pending || (tile.screen === 'donation' && donationPending);
  const tileTitle = (tile: Tile): string => {
    const base = titleOf(tile);
    if (tile.screen === 'donation' && donationPending) return withComingSoon(base, lang);
    // 전국시장 is gated but its frame title has no marker; add the localized one.
    if (tile.screen === 'market' && tile.pending) return pending(base.replace(/\s*\(준비중\)\s*/g, ''));
    return base;
  };
  // Korean writes the marker tight, as the frame does (문화재(준비중)).
  const pending = (base: string): string => (lang === 'ko' ? `${base}(준비중)` : withComingSoon(base, lang));

  const noticeRuns = parseNotice(t('NoticeContent', lang));
  const noticeBody = noticeRuns.map((run, i) =>
    run.bold ? <b key={i}>{run.text}</b> : <span key={i}>{run.text}</span>,
  );

  const weatherIcon = weather ? weatherIconUrl(weatherIconName(weather.icon, weather.main)) : undefined;

  const smartTourLabel =
    lang === 'ko' ? '스마트관광(준비중)' : tExact('MainButton_SmartTour', lang) || pending(pick(SMART_TOUR, lang));

  /**
   * Other languages: Korean is laid out exactly as the frame draws it. Every
   * other language runs longer, so the notice, the cards and the tile text wrap
   * through the band each has and then scale down together (fitText).
   */
  const wide = lang !== 'ko';
  const noticeRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const fitKey = [
    lang,
    noticeRuns.map((r) => r.text).join(''),
    CARDS.map((c) => titleOf(c) + pick(c.sub, lang)).join('|'),
    TILES.map((tile) => tileTitle(tile) + pick(tile.sub, lang)).join('|'),
  ].join('§');
  useFitText(noticeRef, styles.noticeLead, wide, 0.7, fitKey);
  useFitText(cardsRef, styles.cardText, wide, 0.75, fitKey);
  useFitText(gridRef, styles.tileText, wide, 0.7, fitKey);

  const icon = hwaseongIconUrl;

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
          <span className={styles.siteName}>HWASEONG S/A</span>
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

        {/* Tapping the weather plays today's condition clip on the customer display. */}
        <button type="button" className={styles.weather} onClick={playWeatherVideo} aria-label="오늘 날씨 영상">
          <span className={styles.weatherTemp}>{weather ? `${Math.round(weather.tempC)}˚` : '--˚'}</span>
          {weatherIcon && <img src={weatherIcon} alt="" className={styles.weatherIcon} draggable={false} />}
        </button>
      </div>

      {/* ── 오늘의 상점 board + 상점 정보 더보기 ── */}
      <HwaseongShopBoard controller={controller} lang={lang} now={now} low={low} />

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

        <button type="button" className={styles.langBtn} onClick={() => navigate('language', '언어선택')} aria-label="언어선택">
          {LANG_CODE[lang] ?? lang.toUpperCase()}
        </button>
      </div>

      {/* ── Three feature cards ── */}
      <div className={styles.cards} ref={cardsRef}>
        {CARDS.map((card) => {
          const title = <span className={styles.cardTitle}>{titleOf(card)}</span>;
          const sub = <span className={styles.cardSub}>{pick(card.sub, lang)}</span>;
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
              {card.variant === 'cardTraffic' && icon('home-card-traffic') && (
                <img src={icon('home-card-traffic')} alt="" className={styles.cardArt} draggable={false} />
              )}
              {card.variant === 'cardRest' && icon('home-card-reststop') && (
                <img src={icon('home-card-reststop')} alt="" className={styles.cardArt} draggable={false} />
              )}
              {card.variant === 'cardEvents' && <EventsArt />}
            </button>
          );
        })}
      </div>

      {/* ── Menu grid on its white panel ── */}
      <div className={styles.panel} />
      <div className={styles.grid} ref={gridRef}>
        {TILES.map((tile, i) => {
          const inert = isInert(tile);
          const art = tile.art;
          const src = art ? icon(art.icon) : undefined;
          return (
            <button
              key={tile.label}
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
              <span className={styles.plate} style={{ background: tile.plate }}>
                {art === null ? (
                  <GoodsArt />
                ) : src ? (
                  <img
                    src={src}
                    alt=""
                    className={styles.plateArt}
                    style={{ left: art.left, top: art.top, width: art.width, height: art.height }}
                    draggable={false}
                  />
                ) : null}
              </span>
              <span className={`${styles.tileText} ${wide ? styles.tileTextFit : ''}`}>
                <span className={styles.tileTitle} style={!wide && tile.tracking ? { letterSpacing: tile.tracking } : undefined}>
                  {tileTitle(tile)}
                </span>
                <span className={styles.tileSub}>{pick(tile.sub, lang)}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Left nav: home · back · ♿ (shared with every content screen) ── */}
      <HwaseongLeftNav onHome={() => navigate('home', '홈')} onBack={() => navigate('home', '뒤로')} />

      {/* ── Bottom actions: 스마트관광 · 사진촬영 · 화장실 ── */}
      {/* 스마트관광 is 준비중: full colour, not tappable. */}
      <div className={styles.smartTour} aria-disabled="true">
        {icon('home-smarttour') && <img src={icon('home-smarttour')} alt="" className={styles.smartTourImg} draggable={false} />}
      </div>
      <span className={`${styles.actionLabel} ${styles.labelSmartTour}`}>{smartTourLabel}</span>

      <button type="button" className={styles.camera} onClick={startPhoto} aria-label="사진 촬영">
        {icon('home-camera') && <img src={icon('home-camera')} alt="" className={styles.actionImg} draggable={false} />}
      </button>

      <button type="button" className={styles.restroom} onClick={() => navigate('restroom', '화장실')} aria-label="화장실">
        {icon('home-restroom-disc') && <img src={icon('home-restroom-disc')} alt="" className={styles.actionImg} draggable={false} />}
        <span className={`${styles.wcFigure} ${styles.wcFigureLeft}`}>
          <img src={icon('home-restroom-figures')} alt="" draggable={false} />
        </span>
        <span className={`${styles.wcFigure} ${styles.wcFigureRight}`}>
          <img src={icon('home-restroom-figures')} alt="" draggable={false} />
        </span>
        <img src={icon('home-restroom-dot')} alt="" className={styles.wcDot} draggable={false} />
      </button>
      <span className={`${styles.actionLabel} ${styles.labelRestroom}`}>{t('MainButton_WC', lang)}</span>

      <FloatingKeyboard
        open={searching}
        onKey={applyKey}
        onClose={() => setSearching(false)}
        lang={lang}
        lightBackspace
        top={low ? LOW_KEYBOARD_TOP : KEYBOARD_TOP}
      />

      {/* ♿ the 가상 한복 promo moves up under the mode bar (Figma 7904:105362). */}
      {low && <HwaseongBanner onClick={startPhoto} top={146} />}
    </div>
  );
}
