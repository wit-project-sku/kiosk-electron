/**
 * 오색시장 (W004) home — laid out as the 제주 home (Figma 7212:64842, 제주>홈),
 * with Osan's own colours, tile artwork, labels and destinations.
 *
 * Top to bottom: location + clock · 공지 panel with live weather · search row ·
 * 3 feature cards ('정이' 모하지 / 위드마켓 / 오산시 이벤트) · 12-tile grid on a
 * white panel · K-DRAMA / 사진촬영 / 화장실 · rotating promo banner.
 *
 * ♿ low-reach re-lays the page at the 제주 low-reach coordinates; the mode bar
 * and promo banner above it come from OsanKiosk (InsadongLowReachTop).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { KioskScreenId, SupportedLanguage } from '@shared/types/kiosk';
import { OSAN_WEATHER_SITES } from '@shared/config/weatherSites';
import { SearchIcon } from '@layouts/components/SearchIcon';
import { IDLE_TIMEOUT_MS, type KioskController } from '@renderer/hooks/useKioskController';
import { useInactivityReset } from '@renderer/hooks/useInactivityReset';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { trackEvent } from '@renderer/lib/analytics';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { useWeatherVideo } from '@renderer/hooks/useWeatherVideo';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { weatherIconName, weatherIconUrl } from '@renderer/assets/weather';
import { useHasDonationTile, useOrderedTiles, type TileKey } from '@renderer/lib/buttonLayout';
import { DONATION_COMING_SOON, withComingSoon } from '@shared/config/donation';
import { t } from '@renderer/lib/loc';
import { useFitText } from '../jeju/fitText';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';
import { HangulComposer } from '../insadong/keyboard/hangul';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import { InsadongWeatherPanel } from '../insadong/InsadongWeatherPanel';
import { OsanLeftNav } from './OsanLeftNav';
import styles from './OsanHome.module.css';

interface OsanHomeTile {
  screen: KioskScreenId;
  label: string;
  icon: string;
  /** The tile plate's own colour — the icon is a glyph drawn on it. */
  bg: string;
  /** Anchor the icon to the bottom of the plate (e.g. full-body 정이 illustration). */
  alignBottom?: boolean;
  /** Explicit icon size (CSS length) overriding the default 85% — exact Figma dims. */
  iconW?: string;
  iconH?: string;
  /** The art IS the whole tile face (an opaque square), filled edge-to-edge. */
  artFull?: boolean;
}

/** Mint fill of donation.png (sampled from the art itself). The PNG is a rounded
 *  square whose CORNERS are transparent, so the plate behind it must match. */
const DONATION_ART_BG = '#cbeae5';

/** Feature cards — the AI questionnaire, 위드마켓 and events. */
const AI_TILE: OsanHomeTile = { screen: 'ai_search', label: "'정이' 모하지 (AI검색)", icon: 'ai-search', bg: '#1c7bd4' };
const MARKET_TILE: OsanHomeTile = { screen: 'market', label: '위드마켓', icon: 'market', bg: '#ffcc99' };
const EVENTS_TILE: OsanHomeTile = { screen: 'events', label: '오산시 이벤트', icon: 'events', bg: '#ffa680' };
const CARDS: ReadonlyArray<{ tile: OsanHomeTile; variant: 'cardAi' | 'cardSecond' | 'cardEvents' }> = [
  { tile: AI_TILE, variant: 'cardAi' },
  { tile: MARKET_TILE, variant: 'cardSecond' },
  { tile: EVENTS_TILE, variant: 'cardEvents' },
];

/** Grid slot — 기부 on kiosks running the donation app, 오색시장 지도 otherwise.
 *  Mutually exclusive: the CMS carries a row for exactly one of them. See
 *  useHasDonationTile. */
const MAP_TILE: OsanHomeTile = { screen: 'map', label: '오색시장 지도', icon: 'map', bg: '#fdd089' };
const DONATION_TILE: OsanHomeTile = { screen: 'donation', label: '기부', icon: 'donation', bg: DONATION_ART_BG, artFull: true };

/** Grid tiles authored before the 기부/지도 slot. */
const TILES_BEFORE_SLOT: OsanHomeTile[] = [
  { screen: 'eat',     label: "'정이' 뭐먹지",      icon: 'eat',   bg: '#ff8486' },
  { screen: 'shop',    label: "'정이' 뭐사지(식품)", icon: 'shop',  bg: '#ffa680' },
  { screen: 'lodging', label: "'정이' 뭐사지(물품)", icon: 'goods', bg: '#5893ff' },
  { screen: 'taxfree', label: 'TAX-FREE',           icon: 'taxfree', bg: '#ff8fcd', iconW: '12.963cqw', iconH: '7.292cqh' },
  { screen: 'about',   label: '여기는 오색시장',     icon: 'about', bg: '#ffa565' },
  { screen: 'hello',   label: "안녕 '정이'",        icon: 'hello', bg: '#dbc7ff', alignBottom: true },
  { screen: 'help',    label: "도와줘 '정이'",      icon: 'help',  bg: '#9aea96' },
];
/** Grid tiles authored after the 기부/지도 slot. */
const TILES_AFTER_SLOT: OsanHomeTile[] = [
  { screen: 'exchange',  label: '환율',            icon: 'exchange',        bg: '#ffb2c5' },
  { screen: 'transport', label: '교통안내',         icon: 'transport',       bg: '#9c8ce4' },
  { screen: 'palace',    label: '전국시장(준비중)', icon: 'national-market', bg: '#ffa7a8' },
  { screen: 'museum',    label: '지역화폐',         icon: 'local-pay',       bg: '#94dfff' },
];

/** Join a home tile to its CMS button by screen key (see useOrderedTiles). */
const osanTileKey = (tile: OsanHomeTile): TileKey => ({ screen: tile.screen });

/** Home-tile screen id → Localization_Osaek key. Tiles without a sheet key
 *  (물품, TAX-FREE) keep their hardcoded label. */
const TILE_LABEL_KEYS: Partial<Record<string, string>> = {
  ai_search: 'MainButton_AI',
  market: 'MainButton_Goods',
  events: 'MainButton_Event',
  eat: 'MainButton_ToEat',
  shop: 'MainButton_ToBuy',
  about: 'MainButton_Here',
  hello: 'MainButton_Greeting',
  help: 'MainButton_ToHelp',
  map: 'MainButton_Map',
  exchange: 'MainButton_Exchange',
  transport: 'MainButton_Transport',
  palace: 'MainButton_TraditionalMarket',
  museum: 'MainButton_MarketPaper',
  donation: 'MainButton_Donation',
};

type Lang = SupportedLanguage;
function pick<T>(map: Partial<Record<Lang, T>>, lang: Lang): T {
  return (map[lang] ?? map.ko ?? (Object.values(map)[0] as T)) as T;
}

/** Promo (K-DRAMA slot) button label — base word only, since `withComingSoon`
 *  appends the (준비중) marker per language. Hardcoded rather than read from
 *  MainButton_Promotion: Localization_Osaek's row is 취사병이벤트 with empty
 *  en/ja/zh. Wording matches Localization_Jeju's own MainButton_Promotion row,
 *  minus its baked-in suffix. */
const KDRAMA_LABEL: Partial<Record<Lang, string>> = {
  ko: '프로모션',
  en: 'PROMOTION',
  ja: 'PROMOTION',
  zh: '促销活动',
  vi: 'CHƯƠNG TRÌNH KHUYẾN MÃI',
  th: 'โปรโมชั่น',
  ru: 'АКЦИЯ',
  id: 'PROMOSI',
};

const SEARCH_PLACEHOLDER: Partial<Record<Lang, string>> = {
  ko: '오색시장에 대해 검색해보세요!',
  en: 'Search about Osaek Market!',
  ja: 'オセク市場について検索しましょう！',
  zh: '搜索关于五色市场的内容！',
  vi: 'Tìm kiếm về chợ Osaek!',
  th: 'ค้นหาเกี่ยวกับตลาดโอแซก!',
  ru: 'Поиск о рынке Осэк!',
  id: 'Cari tentang Pasar Osaek!',
};

/** 물품 (non-food goods) tile has no Localization_Osaek key — translate inline. */
const LODGING_LABEL: Partial<Record<Lang, string>> = {
  ko: "'정이' 뭐사지(물품)",
  en: 'To buy (Goods)',
  ja: 'お買い物（物品）',
  zh: '我们买什么呢？(物品)',
  vi: 'Mua gì (Hàng hóa)',
  th: 'ซื้ออะไรดี (สินค้า)',
  ru: 'Что купить (Товары)',
  id: 'Mau beli apa (Barang)',
};

/** Language-selector button label. Must match the 언어선택 picker pill codes
 *  (LANG_META in OsanLanguage.tsx): ja → JP, zh → CN. */
const LANG_CODE: Partial<Record<Lang, string>> = {
  ko: 'KR', en: 'EN', ja: 'JP', vi: 'VN', zh: 'CN',
  th: 'TH', ru: 'RU', id: 'ID',
};
const langCode = (lang: Lang): string => LANG_CODE[lang] ?? lang.toUpperCase();

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** `2025-09-13(Mon)  ㅣ  06:00` — the 제주 home top-bar format. */
function formatDateTime(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}(${DAY_NAMES[d.getDay()]})  ㅣ  ${hh}:${mm}`;
}

/** A `<b>`-and-break run, as the sheet's NoticeContent stores it. */
interface Run {
  text: string;
  bold?: boolean;
}

const NOTICE_TOKENS = /(<\s*\/?\s*(?:b|strong)\s*>|<\s*br\s*\/?\s*>|\n)/gi;
const BOLD_TAG = /^<\s*\/?\s*(?:b|strong)\s*>$/i;
const CLOSING_TAG = /^<\s*\//;
const BREAK_TAG = /^<\s*br\s*\/?\s*>$/i;

/**
 * Split the notice into bold/plain runs (same rules as JejuHome's parseNotice):
 * `<b>` toggles, `</b>` clears, and the sheet's hard breaks become spaces so the
 * copy re-flows to the panel's width.
 */
function parseNotice(text: string): Run[] {
  const runs: Run[] = [];
  let bold = false;
  for (const tok of text.split(NOTICE_TOKENS)) {
    if (!tok) continue;
    if (BOLD_TAG.test(tok)) {
      bold = CLOSING_TAG.test(tok) ? false : !bold;
      continue;
    }
    if (tok === '\n' || BREAK_TAG.test(tok)) {
      runs.push({ text: ' ' });
      continue;
    }
    runs.push(bold ? { text: tok, bold: true } : { text: tok });
  }
  return runs;
}

/** 300-wide tile + 180 gap across, 412-tall tile + 80 gap down. */
const COL_STEP = 480;
const ROW_STEP = 492;
/** Low-reach reflows the grid to 6 columns × 2 rows of 230px tiles. */
const COL_STEP_LOW = 312.4;
const ROW_STEP_LOW = 374;
const COLS = 4;
const COLS_LOW = 6;

/** Search row geometry (mirrors .searchRow/.searchRowLow) — the keyboard tray
 *  opens flush under it. */
const SEARCH_ROW_TOP = 778;
const SEARCH_ROW_TOP_LOW = 2024;
const SEARCH_ROW_HEIGHT = 182;

/** A tile's coloured plate with its icon — the Osan tile face. */
function Plate({ tile, label, className }: { tile: OsanHomeTile; label: string; className: string }): JSX.Element {
  const url = osanIconUrl(tile.icon);
  const iconStyle: CSSProperties | undefined = tile.iconW ? { width: tile.iconW, height: tile.iconH } : undefined;
  return (
    <span
      className={[
        className,
        tile.alignBottom ? styles.plateBottom : '',
        tile.artFull ? styles.plateFull : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ backgroundColor: tile.bg }}
    >
      {url ? (
        <img src={url} alt="" draggable={false} style={iconStyle} />
      ) : (
        <span className={styles.plateFallback}>{label[0]}</span>
      )}
    </span>
  );
}

interface OsanHomeProps {
  controller: KioskController;
}

export function OsanHome({ controller }: OsanHomeProps): JSX.Element {
  const { navigate, startPhoto, kioskId } = controller;
  const weather = useWeatherStore((s) => s.weather);
  const forecast = useWeatherStore((s) => s.forecast);
  const playWeatherVideo = useWeatherVideo();
  const lang = useLanguageStore((s) => s.currentLanguage);
  const lowReach = useAccessibilityStore((s) => s.lowReach);

  // 날씨 panel — the controller's own idle reset early-returns on home, so this
  // closes it for the next visitor on the same clock.
  const [weatherOpen, setWeatherOpen] = useState(false);
  useInactivityReset({
    enabled: weatherOpen,
    timeoutMs: IDLE_TIMEOUT_MS,
    onIdle: () => setWeatherOpen(false),
  });

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const clock = useMemo(() => formatDateTime(now), [now]);

  // ── Grid: the 12 tiles, in CMS order when the layout is cached ──
  const hasDonation = useHasDonationTile(kioskId);
  const tiles: OsanHomeTile[] = useMemo(
    () => [...TILES_BEFORE_SLOT, hasDonation ? DONATION_TILE : MAP_TILE, ...TILES_AFTER_SLOT],
    [hasDonation],
  );
  const orderedTiles = useOrderedTiles(kioskId, tiles, osanTileKey);

  const labelFor = (tile: OsanHomeTile): string => {
    const key = TILE_LABEL_KEYS[tile.screen];
    const base = key ? t(key, lang) : tile.screen === 'lodging' ? pick(LODGING_LABEL, lang) : tile.label;
    return tile.screen === 'donation' && DONATION_COMING_SOON ? withComingSoon(base, lang) : base;
  };
  /** 전국시장, and — while soft-launching — 기부, look normal but do nothing. */
  const notReady = (tile: OsanHomeTile): boolean =>
    tile.screen === 'palace' || (tile.screen === 'donation' && DONATION_COMING_SOON);

  // ── Search ──
  const setSearchQuery = useSearchStore((s) => s.setQuery);
  const composer = useRef(new HangulComposer());
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const placeholder = pick(SEARCH_PLACEHOLDER, lang);

  const submitSearch = (): void => {
    const q = composer.current.value.trim();
    setFocused(false);
    if (q) {
      trackEvent({ name: 'button_clicked', payload: { screen: 'search_submit', query: q, kioskId } });
      setSearchQuery(q);
      navigate('search', '검색');
    }
  };

  const applyKey = (action: KeyAction): void => {
    const c = composer.current;
    switch (action.type) {
      case 'jamo':
        c.inputJamo(action.value);
        break;
      case 'literal':
        c.inputLiteral(action.value);
        break;
      case 'space':
        c.inputLiteral(' ');
        break;
      case 'backspace':
        c.backspace();
        break;
      case 'enter':
        submitSearch();
        return;
    }
    setQuery(c.value);
  };

  // ── Notice ──
  const noticeRuns = parseNotice(t('NoticeContent', lang));
  const noticeBody = noticeRuns.map((run, i) =>
    run.bold ? <b key={i}>{run.text}</b> : <span key={i}>{run.text}</span>,
  );

  const weatherSrc = weather ? weatherIconUrl(weatherIconName(weather.icon, weather.main)) : undefined;

  /* Params are optional because CSS Module lookups are typed `string | undefined`. */
  const low = (base?: string, alt?: string): string => `${base ?? ''} ${lowReach ? alt ?? '' : ''}`;
  const cols = lowReach ? COLS_LOW : COLS;
  const colStep = lowReach ? COL_STEP_LOW : COL_STEP;
  const rowStep = lowReach ? ROW_STEP_LOW : ROW_STEP;

  // Korean is laid out at the drawn sizes; the other languages run longer, so
  // the notice, the cards and the tile labels wrap through the band they have
  // and only then shrink — one factor per block (see jeju/fitText).
  const wide = lang !== 'ko';
  const noticeRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const fitKey = [
    lang,
    lowReach,
    noticeRuns.map((r) => r.text).join(''),
    CARDS.map((c) => labelFor(c.tile)).join('|'),
    orderedTiles.map(labelFor).join('|'),
  ].join('§');
  useFitText(noticeRef, styles.noticeLead, wide, 0.7, fitKey);
  useFitText(cardsRef, styles.cardText, wide, 0.75, fitKey);
  useFitText(gridRef, styles.tileText, wide, 0.7, fitKey);

  const cameraSrc = osanIconUrl('camera-btn');
  // Bottom promo banner: live API banner when active, else the bundled 오색시장 one.
  const banner = useRotatingBanner(osanIconUrl('banner'));

  return (
    <div className={styles.root}>
      {osanIconUrl('bg') && <img className={styles.bgImage} src={osanIconUrl('bg')} alt="" draggable={false} />}

      {/* ── Top bar ── */}
      <div className={low(styles.topBar, styles.topBarLow)}>
        <div className={styles.topLeft}>
          {osanIconUrl('location-pin') && (
            <img className={styles.locationIcon} src={osanIconUrl('location-pin')} alt="" draggable={false} />
          )}
          <span className={styles.siteName}>OSAEK MARKET</span>
        </div>
        <span className={styles.dateTime}>{clock}</span>
      </div>

      {/* ── 공지 panel + weather ── */}
      <div className={low(styles.notice, styles.noticeLow)}>
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

        {/* Tapping the weather opens the 날씨 panel AND plays today's condition
            clip on the customer display, as before. */}
        <button
          type="button"
          className={styles.weather}
          onClick={() => {
            playWeatherVideo();
            setWeatherOpen((open) => !open);
          }}
          aria-label="오늘 날씨"
          aria-expanded={weatherOpen}
        >
          <span className={styles.weatherTemp}>{weather ? `${Math.round(weather.tempC)}°` : '--°'}</span>
          {weatherSrc && <img src={weatherSrc} alt="" className={styles.weatherIcon} draggable={false} />}
        </button>
      </div>

      {/* ── Search row ── */}
      <div className={low(styles.searchRow, styles.searchRowLow)}>
        <button type="button" className={styles.searchHome} onClick={() => navigate('home', 'Home')} aria-label="홈">
          {osanIconUrl('home-btn') && (
            <img src={osanIconUrl('home-btn')} alt="" className={styles.searchHomeImg} draggable={false} />
          )}
        </button>

        <button
          type="button"
          className={low(styles.searchField, styles.searchFieldLow)}
          onClick={() => setFocused(true)}
        >
          <span className={`${styles.searchText} ${query ? styles.searchValue : styles.searchPlaceholder}`}>
            {query || placeholder}
            {focused && <span className={styles.searchCaret} />}
          </span>
          <SearchIcon className={styles.searchIcon} />
        </button>

        <button
          type="button"
          className={low(styles.langBtn, styles.langBtnLow)}
          onClick={() => navigate('language', '언어선택')}
        >
          {langCode(lang)}
        </button>
      </div>

      {/* ── Three feature cards ── */}
      <div className={low(styles.cards, styles.cardsLow)} ref={cardsRef}>
        {CARDS.map(({ tile, variant }) => (
          <button
            key={tile.screen}
            type="button"
            className={`${styles.card} ${styles[variant]}`}
            onClick={() => navigate(tile.screen, tile.label)}
          >
            <span className={styles.cardText}>
              <span className={styles.cardTitle}>{labelFor(tile)}</span>
            </span>
            <Plate tile={tile} label={labelFor(tile)} className={styles.cardPlate ?? ''} />
          </button>
        ))}
      </div>

      {/* ── Menu grid on its panel ── */}
      <div className={low(styles.panel, styles.panelLow)} />
      <div className={low(styles.grid, styles.gridLow)} ref={gridRef}>
        {orderedTiles.map((tile, i) => {
          const soon = notReady(tile);
          const label = labelFor(tile);
          return (
            <button
              key={tile.screen}
              type="button"
              className={low(styles.tile, styles.tileLow)}
              style={{ left: (i % cols) * colStep, top: Math.floor(i / cols) * rowStep }}
              aria-disabled={soon || undefined}
              onClick={soon ? (e) => e.preventDefault() : () => navigate(tile.screen, tile.label)}
            >
              <Plate tile={tile} label={label} className={low(styles.tilePlate, styles.tilePlateLow)} />
              <span className={`${low(styles.tileText, styles.tileTextLow)} ${wide ? styles.tileTextFit : ''}`}>
                <span className={styles.tileTitle}>{label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Bottom actions: K-DRAMA / 사진촬영 / 화장실 ── */}
      {/* K-DRAMA 준비중: keeps its full colour, but is not tappable. */}
      <div className={low(`${styles.kdrama} ${styles.kdramaSoon}`, styles.kdramaLow)} aria-disabled="true">
        {osanIconUrl('kdrama') && <img src={osanIconUrl('kdrama')} alt="" className={styles.kdramaLogo} draggable={false} />}
      </div>
      <span className={low(`${styles.actionLabel} ${styles.labelKdrama}`, styles.actionLabelLow)}>
        {withComingSoon(pick(KDRAMA_LABEL, lang), lang)}
      </span>

      <button type="button" className={low(styles.camera, styles.cameraLow)} onClick={startPhoto} aria-label="사진 촬영">
        {cameraSrc && <img src={cameraSrc} alt="" className={styles.actionImg} draggable={false} />}
      </button>

      <button
        type="button"
        className={low(styles.restroom, styles.restroomLow)}
        onClick={() => navigate('restroom', '화장실')}
        aria-label="화장실"
      >
        {osanIconUrl('restroom') && (
          <img src={osanIconUrl('restroom')} alt="" className={styles.actionImg} draggable={false} />
        )}
      </button>
      <span className={low(`${styles.actionLabel} ${styles.labelRestroom}`, styles.actionLabelLow)}>
        {t('MainButton_WC', lang)}
      </span>

      {/* Promo banner at the foot. In ♿ low-reach the same promo is drawn at the
          top by InsadongLowReachTop, so not here. */}
      {!lowReach && banner && (
        <button type="button" className={styles.banner} onClick={startPhoto} aria-label="가상 한복 체험">
          <img src={banner} alt="" className={styles.bannerImg} draggable={false} />
        </button>
      )}

      {/* The frame draws the rail at y2163 / ♿ y2403 in both layouts. */}
      <OsanLeftNav onHome={() => navigate('home', 'Home')} onBack={() => navigate('home', 'Back')} low />

      {/* 날씨 panel — over the whole home (and the ♿ bar); the keyboard below
          still opens on top of it. */}
      {weatherOpen && (
        <InsadongWeatherPanel
          forecast={forecast}
          lang={lang}
          onClose={() => setWeatherOpen(false)}
          sites={OSAN_WEATHER_SITES}
          ariaLabel="오산 날씨"
        />
      )}

      {/* Tray opens flush under the search row. */}
      <FloatingKeyboard
        open={focused}
        onKey={applyKey}
        onClose={() => setFocused(false)}
        lang={lang}
        top={(lowReach ? SEARCH_ROW_TOP_LOW : SEARCH_ROW_TOP) + SEARCH_ROW_HEIGHT}
      />
    </div>
  );
}
