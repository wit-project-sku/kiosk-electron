/**
 * Insadong home — laid out as the 제주 home (Figma 7212:64842, 제주>홈), with
 * Insadong's own colours, artwork, labels and destinations.
 *
 * Top to bottom: location + clock · 공지 panel with live weather · search row ·
 * 3 feature cards ('인사' 모하지 / 2nd tile / 인사동 이벤트) · 12-tile grid on a
 * white panel · K-DRAMA / 사진촬영 / 화장실 · rotating promo banner.
 *
 * ♿ low-reach re-lays the page at the 제주 low-reach coordinates; the mode bar
 * and promo banner above it come from InsadongKiosk (InsadongLowReachTop).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskScreenId, SupportedLanguage } from '@shared/types/kiosk';
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
import { getKioskLocation } from '@shared/config/kioskLocations';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { weatherIconName, weatherIconUrl } from '@renderer/assets/weather';
import { useHasDonationTile, useOrderedTiles, type TileKey } from '@renderer/lib/buttonLayout';
import { DONATION_COMING_SOON, withComingSoon } from '@shared/config/donation';
import { t } from '@renderer/lib/loc';
import { useFitText } from '../jeju/fitText';
import { FloatingKeyboard } from './keyboard/FloatingKeyboard';
import { HangulComposer } from './keyboard/hangul';
import type { KeyAction } from './keyboard/VirtualKeyboard';
import { InsadongLeftNav } from './InsadongLeftNav';
import { InsadongWeatherPanel } from './InsadongWeatherPanel';
import styles from './InsadongHome.module.css';

interface HomeTile {
  screen: KioskScreenId;
  label: string;
  icon: string;
}

/** Feature card 1 — the AI questionnaire. `card-ai` is the 250×215 robot
 *  illustration (R=아이콘_'인사'뭐하지(AI)-2), sized like 제주's AI card art. */
const AI_TILE: HomeTile = { screen: 'ai_search', label: "'인사' 모하지 (AI검색)", icon: 'card-ai' };
/** Feature card 3 — events. The 2nd card is location-specific (see getKioskLocation). */
const EVENTS_TILE: HomeTile = { screen: 'events', label: '인사동 이벤트', icon: 'events' };

/** Grid slot — 기부 on the kiosks running the donation app (남인사마당 W003),
 *  인사동 지도 on the rest. Mutually exclusive: the CMS carries a row for exactly
 *  one of them per kiosk. See useHasDonationTile. */
const DONATION_TILE: HomeTile = { screen: 'donation', label: '기부', icon: 'donation' };
const MAP_TILE: HomeTile = { screen: 'map', label: '인사동지도', icon: 'map' };

/** Grid tiles authored before the 기부/지도 slot. */
const TILES_BEFORE_SLOT: HomeTile[] = [
  { screen: 'eat', label: "'인사' 뭐먹지", icon: 'eat' },
  { screen: 'shop', label: "'인사' 뭐사지", icon: 'shop' },
  { screen: 'museum', label: '인사동미술관', icon: 'museum' },
  { screen: 'taxfree', label: 'TAX-FREE', icon: 'taxfree' },
  { screen: 'about', label: '여기는 인사동', icon: 'about' },
  { screen: 'hello', label: "안녕 '인사'", icon: 'hello' },
  { screen: 'help', label: "도와줘 '인사'", icon: 'help' },
];
/** Grid tiles authored after the 기부/지도 slot. */
const TILES_AFTER_SLOT: HomeTile[] = [
  { screen: 'exchange', label: '환율', icon: 'exchange' },
  { screen: 'transport', label: '교통안내', icon: 'transport' },
  { screen: 'lodging', label: '숙박안내', icon: 'lodging' },
  { screen: 'palace', label: '고궁안내', icon: 'palace' },
];

/** Home-tile screen id → Localization_Insa key. */
const TILE_LABEL_KEYS: Record<string, string> = {
  ai_search: 'MainButton_AI',
  events: 'MainButton_Event',
  eat: 'MainButton_ToEat',
  shop: 'MainButton_ToBuy',
  museum: 'MainButton_ToGallery',
  taxfree: 'MainButton_TaxFree',
  about: 'MainButton_Here',
  hello: 'MainButton_Greeting',
  help: 'MainButton_ToHelp',
  map: 'MainButton_Map',
  exchange: 'MainButton_Exchange',
  transport: 'MainButton_Transport',
  lodging: 'MainButton_ToStay',
  palace: 'MainButton_Palace',
  restroom: 'MainButton_WC',
  market: 'MainButton_Goods',
  insarang: 'MainButton_Insarang',
  donation: 'MainButton_Donation',
};

/** Join a home tile to its CMS button by screen key (see useOrderedTiles). */
const tileKey = (tile: HomeTile): TileKey => ({ screen: tile.screen });

type Lang = SupportedLanguage;
function pick<T>(map: Partial<Record<Lang, T>>, lang: Lang): T {
  return (map[lang] ?? map.ko ?? (Object.values(map)[0] as T)) as T;
}

/** Promo (K-DRAMA slot) button label — base word only, since `withComingSoon`
 *  appends the (준비중) marker per language. Hardcoded rather than read from
 *  MainButton_Promotion: that row still holds the old 취사병 drama title, while
 *  the tile now reads 프로모션. Wording matches Localization_Jeju's own
 *  MainButton_Promotion row, minus its baked-in suffix. */
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

/** Search field placeholder per language. */
const SEARCH_PLACEHOLDER: Partial<Record<Lang, string>> = {
  ko: '인사동에 대해 검색해보세요!',
  en: 'Search about Insadong!',
  ja: '仁寺洞について検索してみましょう！',
  zh: '搜索关于仁寺洞的内容！',
  vi: 'Tìm kiếm về Insadong!',
  th: 'ค้นหาเกี่ยวกับอินซาดง!',
  ru: 'Поиск об Инсадоне!',
  id: 'Cari tentang Insadong!',
};

/** Language-selector button label. Must match the 언어선택 picker pill codes
 *  (LANG_META in InsadongLanguage.tsx): ja → JP, zh → CN. */
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
 * copy re-flows to the panel's width instead of the breaks the cell carries.
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

type CardVariant = 'cardAi' | 'cardSecond' | 'cardEvents';

interface InsadongHomeProps {
  controller: KioskController;
  debug?: boolean;
}

export function InsadongHome({ controller }: InsadongHomeProps): JSX.Element {
  const { navigate, startPhoto, kioskId } = controller;
  const weather = useWeatherStore((s) => s.weather);
  const forecast = useWeatherStore((s) => s.forecast);
  const playWeatherVideo = useWeatherVideo();
  const lang = useLanguageStore((s) => s.currentLanguage);
  const lowReach = useAccessibilityStore((s) => s.lowReach);

  // 날씨 panel. The controller's own idle reset early-returns while the kiosk is
  // already on home, so it would leave this open for the next visitor — armed
  // only while the panel is up, on the same clock.
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

  // ── Feature cards: AI · location-specific 2nd tile · events ──
  const secondTile = getKioskLocation(kioskId).secondTile as HomeTile | undefined;
  const cards = useMemo(
    () =>
      [
        { tile: AI_TILE, variant: 'cardAi' as CardVariant },
        ...(secondTile ? [{ tile: secondTile, variant: 'cardSecond' as CardVariant }] : []),
        { tile: EVENTS_TILE, variant: 'cardEvents' as CardVariant },
      ],
    [secondTile],
  );

  // ── Grid: the 12 remaining tiles, in CMS order when the layout is cached ──
  const hasDonation = useHasDonationTile(kioskId);
  const tiles: HomeTile[] = useMemo(
    () => [...TILES_BEFORE_SLOT, hasDonation ? DONATION_TILE : MAP_TILE, ...TILES_AFTER_SLOT],
    [hasDonation],
  );
  const orderedTiles = useOrderedTiles(kioskId, tiles, tileKey);

  const labelFor = (tile: HomeTile): string => {
    const key = TILE_LABEL_KEYS[tile.screen];
    const base = key ? t(key, lang) : tile.label;
    return tile.screen === 'donation' && DONATION_COMING_SOON ? withComingSoon(base, lang) : base;
  };
  /** 인사랑(준비중) and — while soft-launching — 기부(준비중) look normal but do nothing. */
  const comingSoon = (tile: HomeTile): boolean =>
    tile.screen === 'insarang' || (tile.screen === 'donation' && DONATION_COMING_SOON);

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
    cards.map((c) => labelFor(c.tile)).join('|'),
    orderedTiles.map(labelFor).join('|'),
  ].join('§');
  useFitText(noticeRef, styles.noticeLead, wide, 0.7, fitKey);
  useFitText(cardsRef, styles.cardText, wide, 0.75, fitKey);
  useFitText(gridRef, styles.tileText, wide, 0.7, fitKey);

  const cameraSrc = iconUrl('camera');
  // Bottom promo banner — rotates on the shared 30-minute clock.
  const banner = useRotatingBanner();

  return (
    <div className={styles.root}>
      {iconUrl('bg') && <img className={styles.bgImage} src={iconUrl('bg')} alt="" draggable={false} />}

      {/* ── Top bar ── */}
      <div className={low(styles.topBar, styles.topBarLow)}>
        <div className={styles.topLeft}>
          {iconUrl('location-pin') && (
            <img className={styles.locationIcon} src={iconUrl('location-pin')} alt="" draggable={false} />
          )}
          <span className={styles.siteName}>INSADONG</span>
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
          {iconUrl('home-btn') && (
            <img src={iconUrl('home-btn')} alt="" className={styles.searchHomeImg} draggable={false} />
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
        {cards.map(({ tile, variant }) => {
          const soon = comingSoon(tile);
          const art = iconUrl(tile.icon);
          return (
            <button
              key={tile.screen}
              type="button"
              className={`${styles.card} ${styles[variant]} ${soon ? styles.cardSoon : ''}`}
              aria-disabled={soon || undefined}
              onClick={soon ? (e) => e.preventDefault() : () => navigate(tile.screen, tile.label)}
            >
              <span className={styles.cardText}>
                <span className={styles.cardTitle}>{labelFor(tile)}</span>
              </span>
              {art && <img src={art} alt="" className={styles.cardArt} draggable={false} />}
            </button>
          );
        })}
      </div>

      {/* ── Menu grid on its panel ── */}
      <div className={low(styles.panel, styles.panelLow)} />
      <div className={low(styles.grid, styles.gridLow)} ref={gridRef}>
        {orderedTiles.map((tile, i) => {
          const soon = comingSoon(tile);
          const art = iconUrl(tile.icon);
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
              {art ? (
                <img src={art} alt="" className={low(styles.tileArt, styles.tileArtLow)} draggable={false} />
              ) : (
                <span className={low(styles.tileArtMissing, styles.tileArtLow)}>{label[0]}</span>
              )}
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
        {iconUrl('kdrama') && <img src={iconUrl('kdrama')} alt="" className={styles.actionImg} draggable={false} />}
      </div>
      <span className={low(`${styles.actionLabel} ${styles.labelKdrama}`, styles.actionLabelLow)}>
        {withComingSoon(pick(KDRAMA_LABEL, lang), lang)}
      </span>

      <button type="button" className={low(styles.camera, styles.cameraLow)} onClick={startPhoto} aria-label="AI 한복 촬영">
        {cameraSrc && <img src={cameraSrc} alt="" className={styles.actionImg} draggable={false} />}
      </button>

      <button
        type="button"
        className={low(styles.restroom, styles.restroomLow)}
        onClick={() => navigate('restroom', '화장실')}
        aria-label="화장실"
      >
        {iconUrl('restroom') && (
          <img src={iconUrl('restroom')} alt="" className={styles.actionImg} draggable={false} />
        )}
      </button>
      <span className={low(`${styles.actionLabel} ${styles.labelRestroom}`, styles.actionLabelLow)}>
        {t('MainButton_WC', lang)}
      </span>

      {/* Promo banner at the foot (Figma 7212:65245). In ♿ low-reach the same
          promo is drawn at the top by InsadongLowReachTop, so not here. */}
      {!lowReach && banner && (
        <button type="button" className={styles.banner} onClick={startPhoto} aria-label="가상 한복 체험">
          <img src={banner} alt="" className={styles.bannerImg} draggable={false} />
        </button>
      )}

      {/* The frame draws the rail at y2163 / ♿ y2403 in both layouts. */}
      <InsadongLeftNav onHome={() => navigate('home', 'Home')} onBack={() => navigate('home', 'Back')} low />

      {/* 날씨 panel — over the whole home (and the ♿ bar); the keyboard below
          still opens on top of it. */}
      {weatherOpen && (
        <InsadongWeatherPanel forecast={forecast} lang={lang} onClose={() => setWeatherOpen(false)} />
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
