/**
 * 화성휴게소 home — laid out as the 제주 home (Figma 7212:64842, 제주>홈), with
 * Hwaseong's own colours, tile artwork, labels and destinations.
 *
 * Top to bottom: location + clock · 공지 panel with live weather · search row ·
 * 3 feature cards (전국도로교통상황 / 전국시장 / 화성시 이벤트) · 12-tile grid on a
 * white panel · 스마트 관광 / 사진촬영 / 화장실 strip · rotating promo banner.
 *
 * ♿ low-reach re-lays the page at the 제주 low-reach coordinates; the mode bar
 * and promo banner above it come from HwaseongKiosk (InsadongLowReachTop).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { IDLE_TIMEOUT_MS, type KioskController } from '@renderer/hooks/useKioskController';
import type { KioskScreenId } from '@shared/types/kiosk';
import { HWASEONG_WEATHER_SITES } from '@shared/config/weatherSites';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { useWeatherVideo } from '@renderer/hooks/useWeatherVideo';
import { useInactivityReset } from '@renderer/hooks/useInactivityReset';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { weatherIconUrl, weatherIconName } from '@renderer/assets/weather';
import { buttonText, pick } from '@renderer/lib/i18n';
import { useHasDonationTile, useOrderedTiles, type TileKey } from '@renderer/lib/buttonLayout';
import { DONATION_COMING_SOON, withComingSoon } from '@shared/config/donation';
import { t } from '@renderer/lib/loc';
import { SearchIcon } from '@layouts/components/SearchIcon';
import { useFitText } from '../jeju/fitText';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';
import { HangulComposer } from '../insadong/keyboard/hangul';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import { InsadongWeatherPanel } from '../insadong/InsadongWeatherPanel';
import { HwaseongBanner } from './HwaseongBanner';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import styles from './HwaseongHome.module.css';

/** Search-bar language button → the current language's display code. */
const LANG_CODE: Record<string, string> = { ko: 'KR', en: 'EN', ja: 'JP', zh: 'CN', vi: 'VN', th: 'TH', ru: 'RU', id: 'ID' };

/** Search placeholder. The notice copy comes from the sheet (NoticeContent). */
const SEARCH_PLACEHOLDER = {
  ko: '화성휴게소에 대해 검색해보세요!',
  en: 'Search about Hwaseong Service Area!',
  ja: '華城SAについて検索してみてください！',
  zh: '搜索关于华城休息站的信息！',
  vi: 'Tìm kiếm về trạm dừng Hwaseong!',
  th: 'ค้นหาเกี่ยวกับจุดพักรถฮวาซอง!',
  ru: 'Поиск о зоне отдыха Хвасон!',
  id: 'Cari tentang Rest Area Hwaseong!',
};

// ── Tile definitions ───────────────────────────────────────────────
interface Tile {
  screen: KioskScreenId;
  /** Korean label — kept for analytics (button_type stays language-stable). */
  label: string;
  /** Localization_Hwaseong key — what the tile actually displays. */
  labelKey: string;
  icon: string; // hwaseongIconUrl key
}

/** A tile plus optional flags: `disabled` (준비중) and an explicit DB `slot`.
 *  `slot` disambiguates tiles that share a screen key (the three `rest_info`
 *  tiles → slots 16/17/18) so each joins to a distinct API row. */
type HomeTile = Tile & { disabled?: boolean; slot?: number };

// Icons are the actual Figma tile renders (fg-*) — the rounded plate is part of
// the art. Each tile's visible text comes from the sheet (labelKey).
// Per Figma 4167-176562: 전국시장 keeps the fg-reststop art, 전국휴게소 fg-market.
const TRAFFIC_TILE: HomeTile = { screen: 'transport', label: '전국도로교통상황', labelKey: 'MainButton_TrafficInfo', icon: 'fg-traffic' };
const MARKET_TILE: HomeTile = { screen: 'market', label: '전국시장(준비중)', labelKey: 'MainButton_TraditionalMarket', icon: 'fg-reststop', disabled: true };
const EVENTS_TILE: HomeTile = { screen: 'events', label: '화성시 이벤트', labelKey: 'MainButton_Event', icon: 'fg-event' };

/** The three feature cards, in the 제주 card slots. */
const CARDS: ReadonlyArray<{ tile: HomeTile; variant: 'cardWide' | 'cardSecond' | 'cardThird' }> = [
  { tile: TRAFFIC_TILE, variant: 'cardWide' },
  { tile: MARKET_TILE, variant: 'cardSecond' },
  { tile: EVENTS_TILE, variant: 'cardThird' },
];
const CARD_SCREENS: ReadonlySet<string> = new Set(CARDS.map((c) => c.tile.screen));

const TILES_BEFORE_SLOT: HomeTile[] = [
  { screen: 'food_court',  label: "'휴' 뭐먹지",     labelKey: 'MainButton_ToEat',       icon: 'fg-eat'      },
  { screen: 'shop',        label: "'휴' 뭐사지",     labelKey: 'MainButton_ToBuy',       icon: 'fg-buy'      },
  { screen: 'convenience', label: '전국휴게소',       labelKey: 'MainButton_ServiceArea', icon: 'fg-market'   },
  { screen: 'taxfree',     label: 'TAX-FREE',        labelKey: 'MainButton_TaxFree',     icon: 'fg-taxfree'  },
  { screen: 'tourism',     label: '화성휴게소',       labelKey: 'MainButton_Here',        icon: 'fg-resthome' },
  { screen: 'hello',       label: "안녕 '휴'",       labelKey: 'MainButton_Greeting',    icon: 'fg-hello'    },
  { screen: 'help',        label: "도와줘 '휴'",     labelKey: 'MainButton_ToHelp',      icon: 'fg-help'     },
];

/** Grid slot 14 — 기부 on kiosks running the donation app, 화성휴게소 지도
 *  otherwise. Mutually exclusive: the CMS carries a row for exactly one of them.
 *  See useHasDonationTile. */
const MAP_TILE: HomeTile = { screen: 'parking', label: '화성휴게소 지도', labelKey: 'MainButton_SAMap', icon: 'fg-map' };
const DONATION_TILE: HomeTile = { screen: 'donation', label: '기부', labelKey: 'MainButton_Donation', icon: 'fg-donation' };

const TILES_AFTER_SLOT: HomeTile[] = [
  { screen: 'exchange',  label: '환율',          labelKey: 'MainButton_Exchange',    icon: 'fg-exchange' },
  { screen: 'rest_info', label: '문화재(준비중)', labelKey: 'MainButton_Property',    icon: 'fg-heritage', disabled: true, slot: 16 },
  { screen: 'rest_info', label: 'K-컬처(준비중)', labelKey: 'MainButton_KCulture',    icon: 'fg-kculture', disabled: true, slot: 17 },
  { screen: 'rest_info', label: '지역화폐',       labelKey: 'MainButton_MarketPaper', icon: 'fg-localpay', slot: 18 },
];

/** Every home tile in authored order — the cards first, then the grid. */
function allTilesFor(hasDonation: boolean): HomeTile[] {
  const slot14: HomeTile = hasDonation ? { ...DONATION_TILE, disabled: DONATION_COMING_SOON } : MAP_TILE;
  return [...CARDS.map((c) => c.tile), ...TILES_BEFORE_SLOT, slot14, ...TILES_AFTER_SLOT];
}

/** Join a Hwaseong tile to its CMS button — by explicit slot when the screen key
 *  is shared (rest_info), else by screen key. */
const hwaseongTileKey = (tile: HomeTile): TileKey => ({ screen: tile.screen, slot: tile.slot });

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

/** A tile's Figma render (plate included), or a lettered placeholder. */
function TileArt({ tile, label, className }: { tile: HomeTile; label: string; className: string }): JSX.Element {
  const src = hwaseongIconUrl(tile.icon);
  return (
    <span className={className}>
      {src ? <img src={src} alt="" draggable={false} /> : <span className={styles.artFallback}>{label[0]}</span>}
    </span>
  );
}

interface Props {
  controller: KioskController;
}

export function HwaseongHome({ controller }: Props): JSX.Element {
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

  // Tile label: curated override (proper ja/zh) → sheet value. Active tiles
  // strip a stale "(준비중)" suffix (e.g. a cached 전국시장(준비중)); only the
  // genuinely-disabled tiles keep their 준비중 marker.
  const L = (key: string): string => buttonText(key, lang) ?? t(key, lang);
  const tileLabel = (tile: HomeTile): string => {
    // TAX-FREE stays the hardcoded brand string in every language.
    if (tile.screen === 'taxfree') return 'TAX-FREE';
    const base = tile.disabled ? L(tile.labelKey) : L(tile.labelKey).replace(/\s*\(준비중\)\s*/g, '').trim();
    if (tile.screen !== 'donation') return base;
    return DONATION_COMING_SOON ? withComingSoon(base, lang) : base;
  };

  // ── Grid: the 12 tiles, in CMS order when the layout is cached ──
  const hasDonation = useHasDonationTile(kioskId);
  const allTiles = useMemo(() => allTilesFor(hasDonation), [hasDonation]);
  const orderedTiles = useOrderedTiles(kioskId, allTiles, hwaseongTileKey);
  const gridTiles = useMemo(() => orderedTiles.filter((tile) => !CARD_SCREENS.has(tile.screen)), [orderedTiles]);

  // navigate() resolves the DB button id and fires the button_clicked analytics.
  const go = (tile: HomeTile): void => navigate(tile.screen, tile.label);

  // ── Search ──
  const setStoreQuery = useSearchStore((s) => s.setQuery);
  const composer = useRef(new HangulComposer());
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const applyKey = (action: KeyAction): void => {
    const c = composer.current;
    switch (action.type) {
      case 'jamo':      c.inputJamo(action.value);    break;
      case 'literal':   c.inputLiteral(action.value); break;
      case 'space':     c.inputLiteral(' ');          break;
      case 'backspace': c.backspace();                break;
      case 'enter':
        // Only on Enter do we leave the home page → show results.
        setStoreQuery(c.value.trim());
        setSearching(false);
        navigate('search');
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
    CARDS.map((c) => tileLabel(c.tile)).join('|'),
    gridTiles.map(tileLabel).join('|'),
  ].join('§');
  useFitText(noticeRef, styles.noticeLead, wide, 0.7, fitKey);
  useFitText(cardsRef, styles.cardText, wide, 0.75, fitKey);
  useFitText(gridRef, styles.tileText, wide, 0.7, fitKey);

  const wcLabel = t('MainButton_WC', lang);

  return (
    <div className={styles.root}>
      {hwaseongIconUrl('bg') && <img className={styles.bgImage} src={hwaseongIconUrl('bg')} alt="" draggable={false} />}

      {/* ── Top bar ── */}
      <div className={low(styles.topBar, styles.topBarLow)}>
        <div className={styles.topLeft}>
          {hwaseongIconUrl('location-pin') && (
            <img className={styles.locationIcon} src={hwaseongIconUrl('location-pin')} alt="" draggable={false} />
          )}
          <span className={styles.siteName}>HWASEONG SA</span>
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
        <button type="button" className={styles.searchHome} onClick={() => navigate('home')} aria-label="홈">
          {hwaseongIconUrl('ico-home') ? (
            <img src={hwaseongIconUrl('ico-home')} alt="" className={styles.searchHomeImg} draggable={false} />
          ) : (
            <svg className={styles.searchHomeImg} viewBox="0 0 175 175" fill="none">
              <circle cx="87.5" cy="87.5" r="87.5" fill="var(--kiosk-primary)" />
              <path d="M50 92L87.5 55L125 92V130H102V104H73V130H50V92Z" fill="#fff" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className={low(styles.searchField, styles.searchFieldLow)}
          onClick={() => setSearching(true)}
        >
          <span className={`${styles.searchText} ${query ? styles.searchValue : styles.searchPlaceholder}`}>
            {query || pick(SEARCH_PLACEHOLDER, lang)}
            {searching && <span className={styles.searchCaret} />}
          </span>
          <SearchIcon className={styles.searchIcon} />
        </button>

        <button
          type="button"
          className={low(styles.langBtn, styles.langBtnLow)}
          onClick={() => navigate('language')}
        >
          {LANG_CODE[lang] ?? 'KR'}
        </button>
      </div>

      {/* ── Three feature cards ── */}
      <div className={low(styles.cards, styles.cardsLow)} ref={cardsRef}>
        {CARDS.map(({ tile, variant }) => (
          <button
            key={tile.screen}
            type="button"
            className={`${styles.card} ${styles[variant]}`}
            aria-disabled={tile.disabled || undefined}
            onClick={tile.disabled ? (e) => e.preventDefault() : () => go(tile)}
          >
            <span className={styles.cardText}>
              <span className={styles.cardTitle}>{tileLabel(tile)}</span>
            </span>
            <TileArt tile={tile} label={tileLabel(tile)} className={styles.cardArt ?? ''} />
          </button>
        ))}
      </div>

      {/* ── Menu grid on its panel ── */}
      <div className={low(styles.panel, styles.panelLow)} />
      <div className={low(styles.grid, styles.gridLow)} ref={gridRef}>
        {gridTiles.map((tile, i) => {
          const label = tileLabel(tile);
          return (
            <button
              key={`${tile.screen}-${tile.slot ?? ''}`}
              type="button"
              className={low(styles.tile, styles.tileLow)}
              style={{ left: (i % cols) * colStep, top: Math.floor(i / cols) * rowStep }}
              aria-disabled={tile.disabled || undefined}
              onClick={tile.disabled ? (e) => e.preventDefault() : () => go(tile)}
            >
              <TileArt tile={tile} label={label} className={low(styles.tileArt, styles.tileArtLow)} />
              <span className={`${low(styles.tileText, styles.tileTextLow)} ${wide ? styles.tileTextFit : ''}`}>
                <span className={styles.tileTitle}>{label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Bottom strip: 스마트 관광(준비중) / 사진촬영 / 화장실 ──
          One Figma render (strip + three buttons + labels) with tap zones over it. */}
      <div className={low(styles.bottomNav, styles.bottomNavLow)}>
        {hwaseongIconUrl('fg-bottomnav') && (
          <img src={hwaseongIconUrl('fg-bottomnav')} alt="" className={styles.bottomNavImg} draggable={false} />
        )}
        {/* 스마트 관광 — 준비중: not tappable. */}
        <div className={styles.bottomNavZoneLeft} aria-label="스마트 관광(준비중)" />
        <button type="button" className={styles.bottomNavZoneCenter} onClick={startPhoto} aria-label="AR 한복체험" />
        <button
          type="button"
          className={styles.bottomNavZoneRight}
          onClick={() => navigate('restroom', '화장실')}
          aria-label={wcLabel}
        >
          {/* Covers the Korean label baked into fg-bottomnav.png so language can switch. */}
          <span className={styles.bottomNavWcLabel}>{wcLabel}</span>
        </button>
      </div>

      {/* Promo banner at the foot. In ♿ low-reach the same promo is drawn at the
          top by InsadongLowReachTop, so not here. */}
      {!lowReach && <HwaseongBanner onClick={startPhoto} />}

      {/* The frame draws the rail at y2163 / ♿ y2403 in both layouts. */}
      <HwaseongLeftNav onHome={() => navigate('home')} low />

      {/* 날씨 panel — over the whole home (and the ♿ bar); the keyboard below
          still opens on top of it. */}
      {weatherOpen && (
        <InsadongWeatherPanel
          forecast={forecast}
          lang={lang}
          onClose={() => setWeatherOpen(false)}
          sites={HWASEONG_WEATHER_SITES}
          ariaLabel="화성 날씨"
        />
      )}

      {/* Tray opens flush under the search row. */}
      <FloatingKeyboard
        open={searching}
        onKey={applyKey}
        onClose={() => setSearching(false)}
        lang={lang}
        top={(lowReach ? SEARCH_ROW_TOP_LOW : SEARCH_ROW_TOP) + SEARCH_ROW_HEIGHT}
      />
    </div>
  );
}
