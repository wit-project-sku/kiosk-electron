/**
 * 제주공항 (W006) home — Figma node 6439:71456 (제주>홈), the 2026-08-24 redesign
 * of 6117:48085.
 *
 * Built from the real node via get_design_context; every position/size in
 * JejuHome.module.css is the exact Figma value. All artwork is exported from its
 * OWN Figma node (see assets/icons/jeju), so no icon is matched by filename —
 * that guesswork is what produced missing icons on the Osan round.
 *
 * Layout, top to bottom: location + clock · 공지 card with live weather ·
 * 운항 정보 board · search row · 3 feature cards · 12-tile grid on a white
 * panel · K-DRAMA / 사진촬영 / 화장실.
 *
 * The redesign moved the bottom action row down into the strip the rotating
 * banner used to own (y3267–3840) and draws NOTHING below it, so the banner is
 * no longer part of this screen — `useRotatingBanner` is gone from here. Other
 * layouts still use it; put it back only with a design that has room for it.
 *
 * The 운항 정보 board was redrawn with six columns and three 현황 conditions
 * (탑승중 / 지연 / 탑승최종) — it lives in JejuFlightBoard.tsx.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { KioskScreenId } from '@shared/types/kiosk';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useOrderedTiles, type TileKey } from '@renderer/lib/buttonLayout';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { useWeatherVideo } from '@renderer/hooks/useWeatherVideo';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { weatherIconUrl, weatherIconName } from '@renderer/assets/weather';
import type { Lang } from '@renderer/lib/i18n';
import { t, sheetText } from '@renderer/lib/loc';
import { DONATION_COMING_SOON, withComingSoon } from '@shared/config/donation';
import { JejuFlightBoard } from './JejuFlightBoard';
import { JejuSailingBoard } from './JejuSailingBoard';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';
import { HangulComposer } from '../insadong/keyboard/hangul';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import styles from './JejuHome.module.css';

interface Props {
  controller: KioskController;
}

/** Search-bar language button → the current language's display code. */
const LANG_CODE: Record<string, string> = {
  ko: 'KR', en: 'EN', ja: 'JP', zh: 'CN', vi: 'VN', th: 'TH', ru: 'RU', id: 'ID',
};

/**
 * Notice + search placeholder now come from Localization_Jeju (`NoticeContent`,
 * `Main_Search`), so an edit in the sheet reaches the kiosk on the next night
 * sync with no rebuild — the same path every other location uses.
 *
 * These objects remain as the LAST-RESORT fallback for the two keys, used only
 * when neither the synced nor the bundled table has a value for the language and
 * `t()` would otherwise render the raw key. `t()` already falls back to the
 * sheet's Korean first, so in practice these fire only if the key disappears
 * from the sheet entirely.
 */
const NOTICE_FALLBACK = {
  ko: '9월 제주는 살이 통통하게 오른 은갈치와 고등어 같은 가을 해산물과 상큼한 황금향이 맛과 향이 가장 뛰어난 제철입니다.',
  en: 'September in Jeju is peak season for plump autumn seafood — silver hairtail and mackerel — and for fragrant, tangy golden hallabong.',
  ja: '9月の済州は、身の締まったタチウオやサバなどの秋の海の幸と、爽やかな黄金香が最も美味しい旬の季節です。',
  zh: '九月的济州岛，正是肉质肥美的带鱼、青花鱼等秋季海鲜与清甜黄金香最当季的时节。',
};

const SEARCH_PLACEHOLDER_FALLBACK = {
  ko: '제주에 대해 검색해보세요!',
  en: 'Search about Jeju!',
  ja: '済州について検索してみてください！',
  zh: '搜索关于济州的信息！',
  vi: 'Tìm kiếm về Jeju!',
  th: 'ค้นหาเกี่ยวกับเชจู!',
  ru: 'Поиск о Чеджу!',
  id: 'Cari tentang Jeju!',
};

/** Sheet key → local fallback, resolved by {@link sheetText}. */
const FALLBACKS: Record<string, Partial<Record<Lang, string>>> = {
  NoticeContent: NOTICE_FALLBACK,
  Main_Search: SEARCH_PLACEHOLDER_FALLBACK,
};

/**
 * Localized sheet string, resolved PER LANGUAGE rather than per key.
 *
 * `sheetText` (lib/loc) does the resolving — sheet cell for this language, then
 * the authored fallback for the SAME language, then `t()`'s Korean chain. A
 * plain `t()` would hide a real regression: Localization_Jeju fills
 * `Main_Search` in Korean only, while the copy authored here has all eight, so
 * `t()` would answer Korean to an English visitor and look like it worked.
 * Checked 2026-08-13: of the keys this screen uses, Main_Search is 1/8 languages
 * and MainButton_ToEat / ToBuy / AI are 2/8 — the sheet still has gaps.
 */
const homeText = (key: string, lang: Lang): string => sheetText(key, lang, FALLBACKS[key]);

/**
 * Home-tile / card screen id → Localization_Jeju key, mirroring Osan's
 * TILE_LABEL_KEYS. Only the DISPLAY label is localized — `navigate()` keeps
 * receiving the Korean label, because that string is the analytics label and is
 * joined against the `buttons` table (see buttonCatalog).
 *
 * 탐나오 and the home's own 운항 정보 board have no MainButton_* row in the sheet,
 * so they keep their authored labels.
 *
 * MainButton_Cruise / SubButton_Cruise (운항정보 · 입·출항 정보) serve DOUBLE duty
 * and that is correct: on 제주공항 they title the 운항정보 page (see i18n's
 * TITLE_KEYS), and on 여객터미널 they also label the 크루즈 운항 tile that opens
 * the ferry board. The sheet files both under "유산문화센터, 여객선터미널에 적용".
 * Note the tile therefore READS 운항정보 while `navigate()` still receives
 * 크루즈 운항 — the CMS's button_type, and the only string the analytics join
 * matches on.
 *
 * MainButton_Greeting and MainButton_ToHelp used to render "안녕 '유산'" and
 * "도와줘 '유산'" here. That was NOT stale sheet data: Localization_Jeju is one
 * tab shared by 제주공항 and 제주유산문화센터, so both keys carry two rows and a
 * last-wins parser handed W006 the 유산 one. Both parsers now break the tie on
 * the mascot name — see LocalizationSyncParser.VENUE_MASCOTS and
 * sync-sheet.mjs jejuVenueScore. Nothing is overridden on this side.
 */
const TILE_LABEL_KEYS: Partial<Record<string, string>> = {
  eat: 'MainButton_ToEat',
  shop: 'MainButton_ToBuy',
  lodging: 'MainButton_Accommodation',
  taxfree: 'MainButton_TaxFree',
  about: 'MainButton_Here',
  hello: 'MainButton_Greeting',
  help: 'MainButton_ToHelp',
  rentcar: 'MainButton_RentCar',
  cruise: 'MainButton_Cruise',
  exchange: 'MainButton_Exchange',
  donation: 'MainButton_Donation',
  localpay: 'MainButton_LocalCurrency',
  tamnao: 'MainButton_Tamnao',
  ai_search: 'MainButton_AI',
  market: 'MainButton_Goods',
  events: 'MainButton_Event',
};

/**
 * The descriptive second line under each tile/card title, added to
 * Localization_Jeju as `SubButton_*` on 2026-08-13. Same resolution as the
 * titles: sheet first, authored `sub` as the fallback.
 *
 * 제주 is the only layout with two-line home tiles — Insadong/Osan/Hwaseong draw
 * a single label — so this map has no counterpart on the other kiosks.
 */
const TILE_SUB_KEYS: Partial<Record<string, string>> = {
  eat: 'SubButton_ToEat',
  shop: 'SubButton_ToBuy',
  lodging: 'SubButton_Accommodation',
  taxfree: 'SubButton_TaxFree',
  about: 'SubButton_Here',
  hello: 'SubButton_Greeting',
  help: 'SubButton_ToHelp',
  rentcar: 'SubButton_RentCar',
  cruise: 'SubButton_Cruise',
  exchange: 'SubButton_Exchange',
  donation: 'SubButton_Donation',
  localpay: 'SubButton_LocalCurrency',
  tamnao: 'SubButton_Tamnao',
  ai_search: 'SubButton_AI',
  market: 'SubButton_Goods',
  events: 'SubButton_Event',
};

/** A `<b>`-and-newline run, as the sheet's NoticeContent stores it. */
interface Run {
  text: string;
  bold?: boolean;
}

/**
 * Split the notice into bold/plain runs. The sheet authors it with literal
 * `<b>…</b>` markers, which would otherwise render as visible tag text.
 * `.noticeText b` already carries the 700 weight, so the markup maps straight
 * onto the design.
 *
 * The sheet's `\n` / `<br/>` breaks become plain spaces rather than <br>: the
 * Korean cell hard-wraps at FOUR lines, but this card's slot is THREE — the
 * orange rule is 242px = 3 × 70px line-height + 2 × 16px padding, and
 * `.noticeText`'s y165 + 3 lines ends at y375, exactly the rule's y391 minus
 * that 16. So the fourth authored row hung below the rule.
 *
 * Re-flowing is safe because the copy is far narrower than four lines: measured
 * in Noto Sans KR at 51px the whole Korean notice is 2438px of text — 2.4 lines
 * against the 1033px box — so the browser wraps it to the three the design
 * draws (ko 3, ja 3, zh 2). English is the one outlier at 3035px and still
 * takes four rows; the line count now follows the copy and the box instead of
 * whatever breaks the sheet happens to carry.
 */
function parseNotice(text: string): Run[] {
  const runs: Run[] = [];
  let bold = false;
  for (const tok of text.split(/(<b>|<\/b>|<br\s*\/?>|\n)/g)) {
    if (!tok) continue;
    if (tok === '<b>') { bold = true; continue; }
    if (tok === '</b>') { bold = false; continue; }
    // A break is a word boundary, not a nbsp — HTML collapses the run of
    // whitespace this leaves next to the sheet's own trailing spaces.
    if (tok === '\n' || /^<br\s*\/?>$/.test(tok)) { runs.push({ text: ' ' }); continue; }
    runs.push(bold ? { text: tok, bold: true } : { text: tok });
  }
  return runs;
}

// ── Date / time ────────────────────────────────────────────────────────
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** `2025-09-13(Mon)  ㅣ  06:00` — the exact format in the Figma top bar. */
function formatDateTime(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}(${DAY_NAMES[d.getDay()]})  ㅣ  ${hh}:${mm}`;
}

// ── Tiles ──────────────────────────────────────────────────────────────
interface Tile {
  screen: KioskScreenId;
  /** Korean label — also the analytics label handed to navigate(). */
  label: string;
  /** Second line under the label. */
  sub: string;
  /** jejuIconUrl key — the exported 200×200 Figma plate. */
  icon: string;
  /**
   * Plate colour painted BEHIND the art, at the grid's own 45px radius.
   *
   * Only 탐나오 needs it: its art is the 탐나오 app icon, a squircle drawn at
   * radius ~86, which among eleven 45px plates reads as a different kind of
   * control — a round button dropped into the grid. A plate in the icon's own
   * red fills the corners the squircle leaves transparent, so the tile is the
   * same 45px plate as its neighbours and the icon's roundness disappears into
   * it. Match this to the ART, not to a palette token.
   */
  plate?: string;
}

/**
 * The one grid slot that differs between the two 제주 venues — row 2, column 4.
 *
 * 제주공항 W006 draws 렌트카; 제주국제여객터미널 W007 draws 크루즈 운항, which opens
 * the ferry sailing board (JejuCruise). Everything else on the two homes is
 * identical, so this is the whole of the per-venue difference.
 *
 * Verified against the live CMS on 2026-08-24: `/api/kiosks/7/buttons` is
 * byte-for-byte W006's 21 rows with exactly this one changed (id 163, line 6
 * position 4), and the terminal's Figma home 6457:116495 draws a ship in the
 * same cell.
 *
 * `label` is the ANALYTICS label — `navigate()` hands it straight to the buttons
 * join, so it must stay byte-identical to the CMS's `button_type` (see
 * buttonCatalog's SLOT_OVERRIDES). The label the visitor READS comes from
 * TILE_LABEL_KEYS via the sheet, and the two are allowed to differ.
 */
const RENTCAR_TILE: Tile = { screen: 'rentcar', label: '렌트카', sub: '간편 예약', icon: 'tile-rentcar' };
const CRUISE_TILE: Tile = { screen: 'cruise', label: '크루즈 운항', sub: '입·출항 정보', icon: 'tile-cruise' };

/**
 * The 안녕/도와줘 tiles carry the venue's MASCOT in their analytics labels, so
 * they too are per-venue: W006/W007's CMS rows read 하영, W008's read 유산
 * (`/api/kiosks/8/buttons` ids 182/183, verified 2026-08-24). Like the venue
 * tile's label, these must stay byte-identical to the CMS `button_type`
 * (ASCII apostrophes); the label the visitor READS still comes from
 * TILE_LABEL_KEYS via the sheet, whose mascot tie-break already answers
 * per-layout.
 */
interface TileMascot {
  hello: string;
  helloSub: string;
  help: string;
}
const HAYOUNG_LABELS: TileMascot = { hello: "안녕 '하영'", helloSub: '하영 소개', help: "도와줘 '하영'" };
const YUSAN_LABELS: TileMascot = { hello: "안녕 '유산'", helloSub: '유산 소개', help: "도와줘 '유산'" };

/** The 12 grid tiles, in Figma reading order (4 columns × 3 rows). */
const tilesWith = (venue: Tile, m: TileMascot = HAYOUNG_LABELS): Tile[] => [
  { screen: 'eat',      label: "'제주'뭐먹지", sub: '맛집 추천',      icon: 'tile-eat'      },
  { screen: 'shop',     label: "'제주'뭐사지", sub: '쇼핑 추천',      icon: 'tile-shop'     },
  { screen: 'lodging',  label: '숙박안내',     sub: '제주 숙소 모음', icon: 'tile-lodging'  },
  { screen: 'taxfree',  label: 'TAX-FREE',    sub: '면세혜택',       icon: 'tile-taxfree'  },
  { screen: 'about',    label: '여기는 제주도', sub: '관광지 추천',    icon: 'tile-about'    },
  { screen: 'hello',    label: m.hello,        sub: m.helloSub,       icon: 'tile-hello'    },
  { screen: 'help',     label: m.help,          sub: '편의시설 안내',  icon: 'tile-help'     },
  venue,
  { screen: 'exchange', label: '환율',         sub: '환율계산기',     icon: 'tile-exchange' },
  { screen: 'donation', label: '기부',         sub: '교복 기부',      icon: 'tile-donation' },
  { screen: 'tamnao',   label: '탐나오',       sub: '제주공공플랫폼', icon: 'tile-tamnao', plate: '#e8534c' },
  { screen: 'localpay', label: '지역화폐',     sub: '탐나는전',       icon: 'tile-localpay' },
];

/**
 * Both grids, built once at module scope.
 *
 * Their identities have to be STABLE across renders: `useOrderedTiles` memoises
 * on the array it is handed, so building one per render would re-run the CMS
 * join — and re-log its diagnostics — on every tick of the home clock.
 */
const TILES_AIRPORT = tilesWith(RENTCAR_TILE);
const TILES_TERMINAL = tilesWith(CRUISE_TILE);
// W008 세계자연유산본부 — W007's grid (크루즈 운항, not 렌트카) with the 유산 tiles.
const TILES_HERITAGE = tilesWith(CRUISE_TILE, YUSAN_LABELS);

/**
 * Which grid a 제주 kiosk draws, by kiosk id.
 *
 * Keyed by KIOSK, not by layout: W006 and W007 deliberately share the
 * JEJU_AIRPORT layout (one 제주 design, two venues — see KioskLayoutId), so the
 * layout cannot tell them apart and this is the level the difference lives at.
 * A kiosk with no entry gets the airport grid.
 */
const TILES_BY_KIOSK: Partial<Record<string, Tile[]>> = { W007: TILES_TERMINAL, W008: TILES_HERITAGE };

/** Join a home tile to its CMS button row by screen key (see useOrderedTiles). */
const jejuTileKey = (tile: Tile): TileKey => ({ screen: tile.screen });

/** 300-wide tile + 180 gap across, 412-tall tile + 80 gap down. */
const COL_STEP = 480;
const ROW_STEP = 492;
/* Low-reach compresses the tile grid: columns land on 0/503.33/1006.67/1510 and
   rows on 0/334/667 (Figma 6442:105429). */
const COL_STEP_LOW = 503.33;
const ROW_STEP_LOW = 333.5;

/** Search row geometry (mirrors .searchRow in the CSS) — the inline keyboard
 *  tray is positioned from it, so the two can't drift apart. */
const SEARCH_ROW_TOP = 1136;
const SEARCH_ROW_HEIGHT = 182;

interface CardDef {
  screen: KioskScreenId;
  label: string;
  sub: string;
  icon: string;
  /** Key into the per-card position/colour rules in JejuHome.module.css. */
  variant: 'cardAi' | 'cardMarket' | 'cardEvents';
}

const CARDS: CardDef[] = [
  { screen: 'ai_search', label: "'제주' 뭐하지", sub: 'AI 검색하기', icon: 'card-ai',     variant: 'cardAi'     },
  { screen: 'market',    label: '위드마켓',      sub: '굿즈 만들기', icon: 'card-market', variant: 'cardMarket' },
  { screen: 'events',    label: '제주도 이벤트',  sub: '제주행사',    icon: 'card-events', variant: 'cardEvents' },
];

export function JejuHome({ controller }: Props): JSX.Element {
  const weather = useWeatherStore((s) => s.weather);
  const playWeatherVideo = useWeatherVideo();
  const lang = useLanguageStore((s) => s.currentLanguage);
  const setStoreQuery = useSearchStore((s) => s.setQuery);

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

  function applyKey(action: KeyAction): void {
    const c = composer.current;
    switch (action.type) {
      case 'jamo':      c.inputJamo(action.value);    break;
      case 'literal':   c.inputLiteral(action.value); break;
      case 'space':     c.inputLiteral(' ');          break;
      case 'backspace': c.backspace();                break;
      case 'enter':
        setStoreQuery(c.value.trim());
        setSearching(false);
        controller.navigate('search', '검색');
        return;
    }
    setQuery(c.value);
  }

  /** Always navigate through the controller — that is what resolves the DB
   *  button id and fires the click/menu-touch analytics. Never trackEvent here. */
  function go(screen: KioskScreenId, label: string): void {
    controller.navigate(screen, label);
  }

  const weatherIcon = weather
    ? weatherIconUrl(weatherIconName(weather.icon, weather.main))
    : jejuIconUrl('weather-sun');

  const donationPending = DONATION_COMING_SOON;
  /** Resolve one of the two tile lines: the sheet's value, else the authored one. */
  const fromSheet = (
    map: Partial<Record<string, string>>,
    screen: string,
    authored: string,
  ): string => {
    const key = map[screen];
    if (!key) return authored;
    // `t()` answers the sheet's Korean for a language it has no cell for, and the
    // key itself when the row is gone entirely — the latter is what the fallback
    // is for. SubButton_Transport is authored blank in the sheet, so guard '' too.
    const value = t(key, lang);
    return !value || value === key ? authored : value;
  };
  /** Display label: the sheet's when the tile has a key, else the authored one. */
  const labelFor = (screen: string, authored: string): string =>
    fromSheet(TILE_LABEL_KEYS, screen, authored);
  const subFor = (screen: string, authored: string): string =>
    fromSheet(TILE_SUB_KEYS, screen, authored);
  const tileLabel = (tile: Tile): string => {
    const base = labelFor(tile.screen, tile.label);
    return tile.screen === 'donation' && donationPending ? withComingSoon(base, lang) : base;
  };
  const noticeRuns = parseNotice(homeText('NoticeContent', lang));

  /**
   * Grid order from the buttons CMS (`/api/kiosks/{6,7}/buttons`), falling back to
   * the authored order when the layout is not cached or any tile fails to match.
   *
   * Both venues' 12 seeded rows agree with their Figma today — lines 5/6/7 are
   * 뭐먹지·뭐사지·숙박·TAX-FREE / 여기는·안녕·도와줘·(렌트카|크루즈 운항) /
   * 환율·기부·탐나오·지역화폐 — so this changes nothing on screen right now. It is
   * wired so a CMS reorder moves the grid without a release, which is how the
   * other kiosks behave.
   */
  const tiles = TILES_BY_KIOSK[controller.kioskId] ?? TILES_AIRPORT;
  const orderedTiles = useOrderedTiles(controller.kioskId, tiles, jejuTileKey);

  /* Low-reach: a 959px hero opens the page and everything below both moves down
     AND compresses — see the block at the foot of JejuHome.module.css. */
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const toggleLowReach = useAccessibilityStore((s) => s.toggleLowReach);
  /* Params are optional because CSS Module lookups are typed `string | undefined`. */
  const low = (base?: string, alt?: string): string => `${base ?? ''} ${lowReach ? alt ?? '' : ''}`;
  const colStep = lowReach ? COL_STEP_LOW : COL_STEP;
  const rowStep = lowReach ? ROW_STEP_LOW : ROW_STEP;

  return (
    <div className={styles.root}>
      {jejuIconUrl('bg') && (
        <img src={jejuIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      {lowReach && jejuIconUrl('banner-ai-hero') && (
        <div className={styles.hero}>
          <img src={jejuIconUrl('banner-ai-hero')} alt="" className={styles.heroImg} draggable={false} />
          <div className={`${styles.heroRule} ${styles.heroRuleTop}`} />
          <div className={`${styles.heroRule} ${styles.heroRuleBottom}`} />
        </div>
      )}

      {/* ── Top bar ── */}
      <div className={low(styles.topBar, styles.topBarLow)}>
        <div className={styles.topLeft}>
          {jejuIconUrl('ico-location') && (
            <img src={jejuIconUrl('ico-location')} alt="" className={styles.locationIcon} draggable={false} />
          )}
          <span className={styles.siteName}>JEJUDO ISLAND</span>
        </div>
        <span className={styles.dateTime}>{clock}</span>
      </div>

      {/* ── 공지 card + weather ── */}
      <div className={low(styles.notice, styles.noticeLow)}>
        <div className={styles.noticeRule} />
        <p className={styles.noticeText}>
          {noticeRuns.map((run, i) => (run.bold ? <b key={i}>{run.text}</b> : <span key={i}>{run.text}</span>))}
        </p>

        {/* Tapping the weather plays today's condition clip on the customer
            display (Weather_Rain/Cold/Sunny), same as the other kiosks. */}
        <div
          className={styles.weather}
          role="button"
          aria-label="오늘 날씨 영상"
          onClick={playWeatherVideo}
        >
          <span className={styles.weatherTemp}>
            {weather ? `${Math.round(weather.tempC)}˚` : '--˚'}
          </span>
          {weatherIcon && (
            <img src={weatherIcon} alt="" className={styles.weatherIcon} draggable={false} />
          )}
        </div>
      </div>

      {/* ── 운항 정보 board — W006 flights, W007 ferry sailings ── */}
      {controller.kioskId === 'W007' ? (
        <JejuSailingBoard controller={controller} lang={lang} />
      ) : (
        <JejuFlightBoard controller={controller} lang={lang} />
      )}

      {/* ── Search row ── */}
      <div className={low(styles.searchRow, styles.searchRowLow)}>
        <button
          type="button"
          className={styles.searchHome}
          onClick={() => go('home', '홈')}
          aria-label="홈"
        >
          {jejuIconUrl('ico-home-search') && (
            <img src={jejuIconUrl('ico-home-search')} alt="" className={styles.searchHomeImg} draggable={false} />
          )}
        </button>

        <div className={low(styles.searchField, styles.searchFieldLow)} onClick={() => setSearching(true)} role="button">
          <span className={`${styles.searchText} ${query ? styles.searchValue : styles.searchPlaceholder}`}>
            {query || homeText('Main_Search', lang)}
            {searching && <span className={styles.searchCaret} />}
          </span>
          {jejuIconUrl('ico-search') && (
            <img src={jejuIconUrl('ico-search')} alt="" className={styles.searchIcon} draggable={false} />
          )}
        </div>

        <button
          type="button"
          className={low(styles.langBtn, styles.langBtnLow)}
          onClick={() => go('language', '언어선택')}
          aria-label="언어선택"
        >
          {LANG_CODE[lang] ?? 'KR'}
        </button>
      </div>

      {/* ── Three feature cards ── */}
      <div className={low(styles.cards, styles.cardsLow)}>
        {CARDS.map((card) => (
          <button
            key={card.screen}
            type="button"
            className={`${styles.card} ${styles[card.variant]}`}
            onClick={() => go(card.screen, card.label)}
          >
            <span className={styles.cardTitle}>{labelFor(card.screen, card.label)}</span>
            <span className={styles.cardSub}>{subFor(card.screen, card.sub)}</span>
            {jejuIconUrl(card.icon) && (
              <img src={jejuIconUrl(card.icon)} alt="" className={styles.cardArt} draggable={false} />
            )}
          </button>
        ))}
      </div>

      {/* ── Menu grid ── */}
      <div className={low(styles.panel, styles.panelLow)} />
      <div className={low(styles.grid, styles.gridLow)}>
        {orderedTiles.map((tile, i) => {
          const art = jejuIconUrl(tile.icon);
          const disabled = tile.screen === 'donation' && donationPending;
          return (
            <button
              key={tile.screen}
              type="button"
              className={[styles.tile, lowReach ? styles.tileLow : '', disabled ? styles.tileDisabled : '']
                .filter(Boolean)
                .join(' ')}
              style={{ left: (i % 4) * colStep, top: Math.floor(i / 4) * rowStep }}
              onClick={disabled ? undefined : () => go(tile.screen, tile.label)}
              disabled={disabled}
            >
              {art ? (
                <>
                  {tile.plate && (
                    <span className={low(styles.tilePlate, styles.tilePlateLow)} style={{ background: tile.plate }} />
                  )}
                  <img src={art} alt="" className={low(styles.tileArt, styles.tileArtLow)} draggable={false} />
                </>
              ) : (
                <span className={styles.tileArtMissing}>{tile.label[0]}</span>
              )}
              <span className={low(styles.tileText, styles.tileTextLow)}>
                <span className={styles.tileTitle}>{tileLabel(tile)}</span>
                <span className={styles.tileSub}>{subFor(tile.screen, tile.sub)}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Bottom actions ── */}
      {/* K-DRAMA is DISABLED for now — the screen behind it is not ready. Only
          the click is off: no dim, no colour change, so the art stays exactly
          as the frame draws it (`disabled` alone would take Chrome's UA fade).
          Re-enable by restoring `onClick={() => go('kdrama', 'K-DRAMA')}`. */}
      <button
        type="button"
        className={low(styles.kdrama, styles.kdramaLow)}
        disabled
        aria-disabled="true"
        aria-label="K-DRAMA"
      >
        {jejuIconUrl('btn-kdrama') && (
          <img src={jejuIconUrl('btn-kdrama')} alt="" className={styles.actionImg} draggable={false} />
        )}
      </button>
      <span className={`${styles.actionLabel} ${styles.labelKdrama} ${lowReach ? styles.actionLabelLow : ''}`}>K-DRAMA</span>

      <button type="button" className={low(styles.camera, styles.cameraLow)} onClick={() => controller.startPhoto()} aria-label="사진촬영">
        {jejuIconUrl('btn-camera') && (
          <img src={jejuIconUrl('btn-camera')} alt="" className={styles.actionImg} draggable={false} />
        )}
      </button>

      <button type="button" className={low(styles.restroom, styles.restroomLow)} onClick={() => go('restroom', '화장실')} aria-label="화장실">
        {jejuIconUrl('ico-restroom') && (
          <img src={jejuIconUrl('ico-restroom')} alt="" className={styles.actionImg} draggable={false} />
        )}
      </button>
      <span className={`${styles.actionLabel} ${styles.labelRestroom} ${lowReach ? styles.actionLabelLow : ''}`}>화장실</span>

      {/* ── Left nav (one Figma render, two tap zones) ── */}
      <div className={styles.leftNav}>
        {jejuIconUrl('nav-left') && (
          <img src={jejuIconUrl('nav-left')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button
          type="button"
          className={`${styles.leftNavZone} ${styles.leftNavHome}`}
          onClick={() => go('home', '홈')}
          aria-label="홈"
        />
        <button
          type="button"
          className={`${styles.leftNavZone} ${styles.leftNavBack}`}
          onClick={() => go('home', '뒤로')}
          aria-label="뒤로"
        />
      </div>
      {jejuIconUrl('ico-accessibility') && (
        <button
          type="button"
          className={styles.accessibility}
          onClick={toggleLowReach}
          aria-label="저상 화면"
          aria-pressed={lowReach}
        >
          <img
            src={jejuIconUrl('ico-accessibility')}
            alt=""
            className={styles.accessibilityImg}
            draggable={false}
          />
        </button>
      )}

      {/* Inline search keyboard — shows in place, no navigation until Enter.
          `top` must track the search row (1136 + 182 = 1318) so the tray opens
          flush UNDER it; the shared default of 900 is Insadong's position and
          would put the keyboard above Jeju's search bar. */}
      <FloatingKeyboard
        open={searching}
        onKey={applyKey}
        onClose={() => setSearching(false)}
        lang={lang}
        lightBackspace
        top={SEARCH_ROW_TOP + SEARCH_ROW_HEIGHT}
      />
    </div>
  );
}
