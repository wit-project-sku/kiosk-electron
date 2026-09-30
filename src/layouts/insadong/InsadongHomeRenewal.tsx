import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskScreenId, SupportedLanguage } from '@shared/types/kiosk';
import { SearchIcon } from '@layouts/components/SearchIcon';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { trackEvent } from '@renderer/lib/analytics';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { useWeatherVideo } from '@renderer/hooks/useWeatherVideo';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { weatherIconName, weatherIconUrl } from '@renderer/assets/weather';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useHasDonationTile } from '@renderer/lib/buttonLayout';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { DONATION_COMING_SOON, withComingSoon } from '@shared/config/donation';
import { t, tExact } from '@renderer/lib/loc';
import { barrierFreeTitle } from './barrierFree';
import { useFitText } from '@layouts/components/fitText';
import { FloatingKeyboard } from './keyboard/FloatingKeyboard';
import { HangulComposer } from './keyboard/hangul';
import type { KeyAction } from './keyboard/VirtualKeyboard';
import { InsadongLeftNav } from './InsadongLeftNav';
import styles from './InsadongHomeRenewal.module.css';

/**
 * 인사동 리뉴얼 홈 — Figma page `인사동 리뉴얼`:
 *   · 7516:63421 — the 지도 variant
 *   · 7574:68827 — the 기부 variant
 *
 * The two frames are the SAME screen; they differ in exactly one grid cell, and
 * that cell is the 지도/기부 swap the CMS already decides per kiosk
 * ({@link useHasDonationTile}). So one component draws both frames.
 *
 * W001, W002 and W003 all draw this frame. W003 only swaps the middle quick
 * card label (위드마켓) and, when the CMS says so, grid slot 10 (기부).
 * The three quick-card illustrations are the Jeju home art: card-ai, card-market, card-events.
 *   · AI검색 · 인사랑 · 인사동 이벤트 leave the tile grid for three wide quick cards;
 *   · the grid drops 4×4 → 3×4 and every tile gains a grey sub-caption;
 *   · the tile squircles are repainted in a lighter pastel palette;
 *   · the scalloped bottom bar is gone — K-DRAMA is back in place of 스마트관광;
 *   · the header date carries the clock, and 공지's vertical lettering becomes a rule.
 */

interface HomeTile {
  screen: KioskScreenId;
  /** Korean label as authored in Figma — the fallback when the sheet has no row. */
  label: string;
  /** Korean sub-caption as authored in Figma — same fallback role. */
  sub: string;
  icon: string;
}

/**
 * The twelve grid tiles in Figma reading order. Slot 10 is filled at render time
 * with 지도 or 기부 — see {@link DONATION_TILE} / {@link MAP_TILE}.
 *
 * Icons are the `renewal-*` set, NOT the bare names. The renewal repaints every
 * squircle in a lighter pastel and re-exports 여기는 인사동 / 기부, but the bare
 * names stay in this folder for the older home component, so the renewal uses
 * its own `renewal-*` copies rather than overwriting them.
 */
const GRID_TILES: readonly HomeTile[] = [
  { screen: 'eat', label: "'인사' 뭐먹지", sub: '맛집 추천', icon: 'renewal-eat' },
  { screen: 'shop', label: "'인사' 뭐사지", sub: '쇼핑 추천', icon: 'renewal-shop' },
  { screen: 'lodging', label: '숙박안내', sub: '인사 숙소 모음', icon: 'renewal-lodging' },
  { screen: 'palace', label: '고궁안내', sub: '한국의 전통 궁', icon: 'renewal-palace' },
  { screen: 'about', label: '여기는 인사동', sub: '관광지 추천', icon: 'renewal-about' },
  { screen: 'hello', label: "안녕 '인사'", sub: "'인사' 소개", icon: 'renewal-hello' },
  { screen: 'help', label: "도와줘 '인사'", sub: '편의시설 안내', icon: 'renewal-help' },
  { screen: 'museum', label: '인사동 미술관', sub: '전시 안내', icon: 'renewal-museum' },
  { screen: 'exchange', label: '환율', sub: '환율 계산기', icon: 'renewal-exchange' },
  // ── slot 10: 지도 ⇄ 기부 ──
  { screen: 'transport', label: '교통안내', sub: '대중교통', icon: 'renewal-transport' },
  { screen: 'taxfree', label: 'TAX-FREE', sub: '면세혜택', icon: 'renewal-taxfree' },
];

/**
 * K-DRAMA soft-launch gate (2026-09-30).
 *
 * The screen behind it is not finished, so the home button is inert. It keeps
 * its art, its colour and its label — the only thing that changes is that the
 * tap goes nowhere, which is what was asked for: no 준비중 marker, no greying.
 *
 * Flip to false to go live; nothing else needs to change. The screen itself
 * (InsadongKiosk's `kdrama` route) is untouched and still reachable in code.
 */
const KDRAMA_COMING_SOON = true;

/** Grid slot 10, chosen per kiosk by {@link useHasDonationTile}. */
const MAP_TILE: HomeTile = { screen: 'map', label: '인사동 지도', sub: '탐나는전', icon: 'renewal-map' };
const DONATION_TILE: HomeTile = { screen: 'donation', label: '기부', sub: '교복 기부', icon: 'renewal-donation' };

/** Where slot 10 sits in {@link GRID_TILES} (after 환율, before 교통안내). */
const SLOT_10 = 9;

/** Home-tile screen id → Localization_Insa key for the 38px label line. */
const TILE_LABEL_KEYS: Record<string, string> = {
  eat: 'MainButton_ToEat',
  shop: 'MainButton_ToBuy',
  lodging: 'MainButton_ToStay',
  palace: 'MainButton_Palace',
  about: 'MainButton_Here',
  hello: 'MainButton_Greeting',
  help: 'MainButton_ToHelp',
  museum: 'MainButton_ToGallery',
  exchange: 'MainButton_Exchange',
  map: 'MainButton_Map',
  donation: 'MainButton_Donation',
  transport: 'MainButton_Transport',
  taxfree: 'MainButton_TaxFree',
  ai_search: 'MainButton_AI',
  insarang: 'MainButton_Insarang',
  market: 'MainButton_Goods',
  events: 'MainButton_Event',
};

/**
 * Sheet keys for the renewal's 25px sub-caption line.
 *
 * ★ `_Subtext`, not `_Sub` (corrected 2026-09-30). The map was authored against
 * a guessed `_Sub` suffix and the sheet uses `_Subtext`, so `tExact` returned ''
 * for all seventeen and EVERY tile silently fell back to its Figma Korean — in
 * all eight languages, on every kiosk, since the renewal shipped. Nothing looked
 * broken because falling back is the designed behaviour for a missing row; only
 * reading the synced table showed it. Verified against the kiosk's own
 * translations table: e.g. MainButton_ToEat_Subtext is filled 8/8
 * ("맛집 추천" / "Restaurant Recommendations" / "おすすめのレストラン").
 *
 * `subOf` also tries a `_SubText` spelling, because the sheet really does spell
 * 뭐사지 that way — see there.
 *
 * `Goods` (the 위드마켓 quick card at W003) has NO row under any spelling, so it
 * is the one caption still served by its Korean fallback. Left pointing at the
 * consistent name so it starts working the day the operator adds it.
 */
const TILE_SUB_KEYS: Record<string, string> = {
  eat: 'MainButton_ToEat_Subtext',
  shop: 'MainButton_ToBuy_Subtext',
  lodging: 'MainButton_ToStay_Subtext',
  palace: 'MainButton_Palace_Subtext',
  about: 'MainButton_Here_Subtext',
  hello: 'MainButton_Greeting_Subtext',
  help: 'MainButton_ToHelp_Subtext',
  museum: 'MainButton_ToGallery_Subtext',
  exchange: 'MainButton_Exchange_Subtext',
  map: 'MainButton_Map_Subtext',
  donation: 'MainButton_Donation_Subtext',
  transport: 'MainButton_Transport_Subtext',
  taxfree: 'MainButton_TaxFree_Subtext',
  ai_search: 'MainButton_AI_Subtext',
  insarang: 'MainButton_Insarang_Subtext',
  market: 'MainButton_Goods_Subtext',
  events: 'MainButton_Event_Subtext',
};

/**
 * The middle quick card is the ONE per-location difference on the renewal home:
 * 인사랑(준비중) at W001/W002, 위드마켓 at W003. Both Figma frames draw 인사랑 because
 * neither is a W003 frame; the kiosk config has carried this split since before
 * the renewal, so it drives the card rather than being hardcoded per frame.
 *
 * 인사랑 is 준비중 (rendered in full colour but inert); 위드마켓 is a live web screen.
 */
const QUICK_SECOND: Record<string, { label: string; sub: string }> = {
  insarang: { label: '인사랑', sub: '굿즈 만들기' },
  market: { label: '위드마켓', sub: '마켓 구경하기' },
};

/** Jeju home card art, reused on the three quick cards.
 *  뭐하지 → card-ai, 인사랑 and 위드마켓 → card-market, 이벤트 → card-events. */
const QUICK_ART = {
  ai: jejuIconUrl('card-ai'),
  market: jejuIconUrl('card-market'),
  events: jejuIconUrl('card-events'),
};

type Lang = SupportedLanguage;
type Run = { t: string; b?: boolean };

function pick<T>(map: Partial<Record<Lang, T>>, lang: Lang): T {
  return (map[lang] ?? map.ko ?? (Object.values(map)[0] as T)) as T;
}

/**
 * Parse the sheet-driven `NoticeContent` string into inline runs.
 * `<b>…</b>` is the only thing that turns bold — the rest stays regular, so a
 * sheet row can emphasise a phrase without the whole notice going bold.
 * Newlines are spaces: the card wraps the copy itself (Figma is three lines),
 * rather than honouring a fourth hard break from the sheet.
 */
function parseNotice(text: string): Run[] {
  const runs: Run[] = [];
  let bold = false;
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n+/g, ' ');
  for (const tok of normalized.split(/(<\/?b>)/gi)) {
    if (tok === '') continue;
    if (/^<b>$/i.test(tok)) bold = true;
    else if (/^<\/b>$/i.test(tok)) bold = false;
    else runs.push({ t: tok, b: bold });
  }
  return runs;
}

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

/** Language-selector button label per language. Must match the 언어선택 picker
 *  pill codes (LANG_META in InsadongLanguage.tsx): ja → JP, zh → CN. */
const LANG_CODE: Partial<Record<Lang, string>> = {
  ko: 'KR', en: 'EN', ja: 'JP', vi: 'VN', zh: 'CN',
  th: 'TH', ru: 'RU', id: 'ID',
};
const langCode = (lang: Lang): string => LANG_CODE[lang] ?? lang.toUpperCase();

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** `2025-09-13(Mon)  ㅣ  06:00` — Figma 7507:52073. The renewal puts the clock
 *  beside the date; the separator and its double spaces are literal. */
function formatDateTime(d: Date): string {
  const p2 = (n: number): string => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}(${WEEKDAYS[d.getDay()]})`;
  return `${date}  ㅣ  ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** A grid tile: exported Figma squircle + label + the renewal's sub-caption. */
function Tile({
  tile,
  label,
  sub,
  onClick,
  disabled,
  longLang,
}: {
  tile: HomeTile;
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
  /** lang !== 'ko' — the caption band grows and joins the shared shrink. */
  longLang: boolean;
}): JSX.Element {
  const url = iconUrl(tile.icon);
  return (
    <button
      type="button"
      className={styles.tile}
      aria-disabled={disabled || undefined}
      onClick={disabled ? (e) => e.preventDefault() : onClick}
    >
      <span className={styles.tileArt}>
        {url ? <img src={url} alt="" draggable={false} /> : <span className={styles.tileFallback}>{label}</span>}
      </span>
      <span className={`${styles.tileCaption} ${longLang ? styles.tileCaptionLong : ''}`}>
        <span className={styles.tileLabel}>{label}</span>
        <span className={styles.tileSub}>{sub}</span>
      </span>
    </button>
  );
}

interface InsadongHomeRenewalProps {
  controller: KioskController;
  debug?: boolean;
}

/** 검색장 — `.searchRow` in the CSS; the keyboard tray opens flush under it. */
const SEARCH_ROW_TOP = 778;
const SEARCH_ROW_HEIGHT = 182;
/** What ♿ adds to the upper block (the mode bar + the promo) — see `.homeLow`. */
const LOW_REACH_SHIFT = 718.759;

export function InsadongHomeRenewal({ controller }: InsadongHomeRenewalProps): JSX.Element {
  const { navigate, startPhoto, kioskId } = controller;
  const weather = useWeatherStore((s) => s.weather);
  const playWeatherVideo = useWeatherVideo();
  const lang = useLanguageStore((s) => s.currentLanguage);
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  /* Korean is what every band in the stylesheet was drawn around; every other
     language runs longer. See "Other languages" at the foot of the CSS. */
  const longLang = lang !== 'ko';
  const gridRef = useRef<HTMLDivElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);
  const kdramaRef = useRef<HTMLDivElement>(null);
  const restroomRef = useRef<HTMLDivElement>(null);

  // Sheet-driven (Localization_Insa): NoticeContent = the 공지 body.
  const noticeLines = parseNotice(t('NoticeContent', lang));
  const placeholder = pick(SEARCH_PLACEHOLDER, lang);

  /* 지도 ⇄ 기부 — restored as alternatives by the renewal (the pre-renewal 4×4
     carried both). The CMS is the authority; the authored `hasDonation` flag
     covers a cold start with no cached buttons. */
  const hasDonation = useHasDonationTile(kioskId);
  /* Optional in the type because KADA has no home grid; every INSADONG-family
     location defines it, so the 인사랑 default never actually fires here. */
  const secondScreen = getKioskLocation(kioskId).secondTile?.screen ?? 'insarang';
  const second = QUICK_SECOND[secondScreen] ?? QUICK_SECOND.insarang!;
  const secondSoon = secondScreen === 'insarang';
  const tiles: HomeTile[] = useMemo(() => {
    const out = [...GRID_TILES];
    out.splice(SLOT_10, 0, hasDonation ? DONATION_TILE : MAP_TILE);
    return out;
  }, [hasDonation]);

  const setSearchQuery = useSearchStore((s) => s.setQuery);
  const composer = useRef(new HangulComposer());
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [now, setNow] = useState(() => new Date());
  // Bottom promo banner rotates every 30 minutes, synced across all screens.
  const banner = useRotatingBanner();

  // The header now shows a clock, so it has to tick every minute, not every hour.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

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

/**
 * Quick-card titles drop a trailing parenthetical.
 *
 * The sheet's MainButton_* rows were written for the pre-renewal grid, where one
 * line carried both name and descriptor — "'인사' 모하지(AI검색)", "인사랑(준비중)".
 * The renewal gives every card its own sub-line, so the parenthetical would be
 * said twice; 인사랑's 준비중 is already expressed by the card being inert.
 * Grid tiles are untouched — they still render the sheet row verbatim.
 */
const stripParenthetical = (label: string): string =>
  label.replace(/\s*[(（][^)）]*[)）]\s*$/, '').trim() || label;

  /** Label/sub for a tile: sheet row first, Figma's Korean copy as the fallback. */
  const labelOf = (screen: string, fallback: string): string =>
    (TILE_LABEL_KEYS[screen] ? tExact(TILE_LABEL_KEYS[screen] as string, lang) : '') || fallback;
  /**
   * Sub-caption for a tile: sheet row first, Figma's Korean copy as the fallback.
   *
   * Two spellings are tried because the sheet carries both: fifteen rows are
   * `..._Subtext` and 뭐사지's is `MainButton_ToBuy_SubText`, with a capital T.
   * `tExact` is case-SENSITIVE, so without the second attempt that one tile
   * alone would keep falling back. Tolerating it here rather than hardcoding
   * the typo in the map means the tile keeps working whichever way the operator
   * eventually settles the sheet.
   */
  const subOf = (screen: string, fallback: string): string => {
    const key = TILE_SUB_KEYS[screen];
    if (!key) return fallback;
    return tExact(key, lang) || tExact(key.replace(/_Subtext$/, '_SubText'), lang) || fallback;
  };

  const weatherSrc = weather ? weatherIconUrl(weatherIconName(weather.icon, weather.main)) : undefined;

  /* One shrink factor per group, never per box — see fitText's "One factor per
     group". The grid's twelve captions are one group; the three quick cards are
     another; each bottom caption is fitted alone because they sit on separate
     buttons with the camera between them. */
  useFitText(gridRef, styles.tileCaptionLong, longLang, 0.62,
    `${lang}|${tiles.map((x) => `${labelOf(x.screen, x.label)}/${subOf(x.screen, x.sub)}`).join('|')}`);
  useFitText(quickRef, styles.quickTitleLong, longLang, 0.6,
    `${lang}|${labelOf('ai_search', "'인사' 뭐하지")}|${labelOf(secondScreen, second.label)}|${labelOf('events', '인사동 이벤트')}`);
  useFitText(kdramaRef, styles.navLabelLong, longLang, 0.55, `${lang}|K-DRAMA`);
  useFitText(restroomRef, styles.navLabelLong, longLang, 0.55, `${lang}|${t('MainButton_WC', lang)}`);

  return (
    <>
      {/* No plate here: 인사>홈 is a flat #FBF8F3 frame. The blossom background
          belongs to the sub-pages (언어선택 / 검색 / 검색상세), which load bg.png. */}
      <div className={lowReach ? `${styles.home} ${styles.homeLow}` : styles.home}>
        {lowReach && <div className={styles.modeBar}>{barrierFreeTitle(lang)}</div>}
        {/* ── 상단 위치/날짜 ── */}
        <header className={styles.header}>
          <div className={styles.brand}>
            {iconUrl('location-pin') && (
              <img className={styles.pin} src={iconUrl('location-pin')} alt="" draggable={false} />
            )}
            <span>INSADONG</span>
          </div>
          <span className={styles.date}>{formatDateTime(now)}</span>
        </header>

        {/* ── 공지 / 날씨 ── */}
        <div className={styles.infoCard}>
          <span className={styles.noticeRule} />
          <p className={styles.noticeText}>
            <span className={styles.noticeBody}>
              {noticeLines.map((run, i) => (
                <span key={i} className={run.b ? styles.noticeBold : undefined}>
                  {run.t}
                </span>
              ))}
            </span>
          </p>
          <button
            type="button"
            className={styles.weather}
            onClick={playWeatherVideo}
            aria-label="오늘 날씨 영상"
          >
            <span className={styles.weatherInner}>
              <span className={styles.temp}>{weather ? `${weather.tempC}˚` : '—'}</span>
              {weatherSrc && <img className={styles.weatherGlyph} src={weatherSrc} alt="" draggable={false} />}
            </span>
          </button>
        </div>

        {/* ── 검색장 ── */}
        <div className={styles.searchRow}>
          <button type="button" className={styles.homeBtn} aria-label="홈">
            {iconUrl('home-btn') && <img src={iconUrl('home-btn')} alt="" draggable={false} />}
          </button>
          <button type="button" className={styles.searchInput} onClick={() => setFocused(true)}>
            <span className={styles.inputTextWrap}>
              {query ? (
                <span className={styles.inputText}>{query}</span>
              ) : (
                <span className={styles.inputPlaceholder}>{placeholder}</span>
              )}
              {focused && <span className={styles.caret} />}
            </span>
            <SearchIcon className={styles.searchIcon} />
          </button>
          <button type="button" className={styles.krBtn} onClick={() => navigate('language', '언어선택')}>
            {langCode(lang)}
          </button>
        </div>

        {/* ── 퀵 카드 3종 ── */}
        <div ref={quickRef} className={styles.quickRow}>
          <button
            type="button"
            className={`${styles.quickCard} ${styles.quickAi}`}
            onClick={() => navigate('ai_search', "'인사' 뭐하지")}
          >
            {QUICK_ART.ai && (
              <img className={styles.quickArt} src={QUICK_ART.ai} alt="" draggable={false} />
            )}
            <span className={`${styles.quickTitle} ${longLang ? styles.quickTitleLong : ''}`}>
              {stripParenthetical(labelOf('ai_search', "'인사' 뭐하지"))}
            </span>
            <span className={`${styles.quickSub} ${longLang ? styles.quickSubLong : ''}`}>
              {subOf('ai_search', 'AI 검색하기')}
            </span>
          </button>

          {/* 인사랑(준비중) at W001/W002 — full colour, simply not tappable —
              or 위드마켓 at W003, which opens its pre-warmed web screen. */}
          {(() => {
            const art = QUICK_ART.market;
            const body = (
              <>
                {art && <img className={styles.quickArt} src={art} alt="" draggable={false} />}
                <span className={`${styles.quickTitle} ${longLang ? styles.quickTitleLong : ''}`}>
                  {/* Read from the sheet's 인사랑 rows on EVERY kiosk. `MainButton_Goods` (the old
                      위드마켓 row) is gone from Localization_Insa, so looking it up on W003 always
                      missed and drew the hardcoded "위드마켓" while the sheet says 인사랑(준비중). */}
                  {labelOf('insarang', second.label)}
                </span>
                <span className={`${styles.quickSub} ${longLang ? styles.quickSubLong : ''}`}>
                  {subOf('insarang', second.sub)}
                </span>
              </>
            );
            return secondSoon ? (
              <div className={`${styles.quickCard} ${styles.quickInsarang} ${styles.soon}`} aria-disabled="true">
                {body}
              </div>
            ) : (
              <button
                type="button"
                className={`${styles.quickCard} ${styles.quickInsarang}`}
                onClick={() => navigate(secondScreen as KioskScreenId, second.label)}
              >
                {body}
              </button>
            );
          })()}

          <button
            type="button"
            className={`${styles.quickCard} ${styles.quickEvents}`}
            onClick={() => navigate('events', '인사동 이벤트')}
          >
            {QUICK_ART.events && (
              <img className={styles.quickArt} src={QUICK_ART.events} alt="" draggable={false} />
            )}
            <span className={`${styles.quickTitle} ${longLang ? styles.quickTitleLong : ''}`}>
              {stripParenthetical(labelOf('events', '인사동 이벤트'))}
            </span>
            <span className={`${styles.quickSub} ${longLang ? styles.quickSubLong : ''}`}>
              {subOf('events', '인사동 행사')}
            </span>
          </button>
        </div>

        {/* ── 메인 그리드 ── */}
        <div className={styles.gridCard}>
          <div ref={gridRef} className={styles.grid}>
            {tiles.map((tile) => {
              // 기부 is soft-launching: normal slot + colour, but inert.
              const disabled = tile.screen === 'donation' && DONATION_COMING_SOON;
              const base = labelOf(tile.screen, tile.label);
              return (
                <Tile
                  key={tile.screen}
                  tile={tile}
                  label={disabled ? withComingSoon(base, lang) : base}
                  sub={subOf(tile.screen, tile.sub)}
                  disabled={disabled}
                  longLang={longLang}
                  onClick={() => navigate(tile.screen, tile.label)}
                />
              );
            })}
          </div>
        </div>

        {/* ── 하단 버튼 3종 (no scalloped bar in the renewal) ── */}
        <div className={styles.bottomRow}>
          <button
            type="button"
            className={`${styles.navItem} ${styles.navKdrama}`}
            /* K-DRAMA is not ready — see KDRAMA_COMING_SOON. Deliberately
               `aria-disabled` + a swallowed click, NOT the `disabled`
               attribute and NOT the `.soon` class: the button must look
               EXACTLY as it does today (same art, same colour, no 준비중
               marker) and simply not go anywhere. Same treatment the grid
               tiles use for 기부 / 인사랑. */
            aria-disabled={KDRAMA_COMING_SOON || undefined}
            onClick={
              KDRAMA_COMING_SOON ? (e) => e.preventDefault() : () => navigate('kdrama', 'K-DRAMA')
            }
            aria-label="K-DRAMA"
          >
            {iconUrl('nav-kdrama') && <img src={iconUrl('nav-kdrama')} alt="" draggable={false} />}
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${styles.navCamera}`}
            onClick={startPhoto}
            aria-label="AI 한복 촬영"
          >
            {iconUrl('nav-camera') && <img src={iconUrl('nav-camera')} alt="" draggable={false} />}
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${styles.navRestroom}`}
            onClick={() => navigate('restroom', '화장실')}
            aria-label="화장실"
          >
            {iconUrl('nav-restroom') && <img src={iconUrl('nav-restroom')} alt="" draggable={false} />}
          </button>
          <div
            ref={kdramaRef}
            className={`${styles.navLabel} ${styles.navLabelKdrama} ${longLang ? styles.navLabelLong : ''}`}
          >
            K-DRAMA
          </div>
          <div
            ref={restroomRef}
            className={`${styles.navLabel} ${styles.navLabelRestroom} ${longLang ? styles.navLabelLong : ''}`}
          >
            {t('MainButton_WC', lang)}
          </div>
        </div>

        {banner && (
          <button type="button" className={styles.banner} onClick={startPhoto} aria-label="가상 한복 체험">
            <img src={banner} className={styles.bannerImg} alt="" draggable={false} />
          </button>
        )}
      </div>

      <InsadongLeftNav
        onHome={() => navigate('home', 'Home')}
        onBack={() => navigate('home', 'Back')}
      />

      {/* `top` must track the search bar or the tray opens ON it: the shared
          default is 900, which is where the OLD home's bar ended, but the
          renewal's runs 778..960 — so the keyboard covered its bottom 59px.
          ♿ carries the bar down with the rest of the upper block. */}
      <FloatingKeyboard
        open={focused}
        onKey={applyKey}
        onClose={() => setFocused(false)}
        lang={lang}
        top={SEARCH_ROW_TOP + SEARCH_ROW_HEIGHT + (lowReach ? LOW_REACH_SHIFT : 0)}
      />
    </>
  );
}
