/**
 * 롯데 home (W011~W013) — Figma A-01 (화면정의서 2026-11-13; W011 8746:1402 · W012 8746:1585 ·
 * W013 8746:1754). 롯데시네마-led: 3 cards (뭐하지 = 영화 전후 코스 · 위드마켓 · 이벤트), 4 tiles
 * (롯데시네마 · 영화 나눔 · 뭐먹지 · 뭐사지), 3 cards (여기는 롯데 · 안녕 · 오늘의 사연), the building
 * art with one 건물 단추 per building (→ 건물 안내), and the bottom actions.
 *
 * ♿ (배리어프리) re-lays the page low for a seated visitor — the 제주 home's low-reach shape
 * (mode bar · 573 promo · everything touchable re-stacked lower), in 롯데 colours. The 4 tiles
 * and the 3 cards under them share ONE icon row there, as 제주 sets its tiles 6 to a row. See the
 * LOW-REACH block at the end of LotteHome.module.css.
 *
 * The left rail carries ♿ and 음성 안내 as the frame draws them. 음성 안내 turns voice guidance on
 * and off (LotteVoiceButton; lines from the 롯데 sheet's Text-to-speech_Script).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import type { Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { KioskScreenId } from '@shared/types/kiosk';
import { lotteIconUrl } from '@renderer/assets/icons/lotte';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { weatherIconName, weatherIconUrl } from '@renderer/assets/weather';
import { useWeatherVideo } from '@renderer/hooks/useWeatherVideo';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { useFitText } from '@layouts/components/fitText';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';
import { HangulComposer } from '../insadong/keyboard/hangul';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import { LotteCinemaBoard } from './LotteCinemaBoard';
import { LotteVoiceButton } from './LotteVoiceButton';
import { LotteWeatherPanel } from './LotteWeatherPanel';
import { guideIndexFor } from './lotteBuildingData';
import { useLotteNav } from './lotteNav';
import { lt } from './lotteText';
import { lotteSite } from './lotteSample';
import { useVoiceIntro } from '../jeju/voice/intro';
import { BARRIER_FREE, modeBarVars } from './lowReach';
import styles from './LotteHome.module.css';

type Copy = { ko: string; en: string; ja: string; zh: string };

const LANG_CODE: Record<string, string> = {
  ko: 'KR',
  en: 'EN',
  ja: 'JP',
  zh: 'CN',
  vi: 'VN',
  th: 'TH',
  ru: 'RU',
  id: 'ID',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number): string => String(n).padStart(2, '0');
const formatDateTime = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}(${DAY_NAMES[d.getDay()]})  ㅣ  ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const SEARCH_PLACEHOLDER: Copy = {
  ko: '롯데에 대해 검색해보세요!',
  en: 'Search about LOTTE!',
  ja: 'ロッテについて検索してみてください！',
  zh: '搜索关于乐天的信息！',
};

const COPY: Record<string, { title: Copy; sub: Copy }> = {
  ai_search: {
    title: { ko: "'롯데' 뭐하지", en: 'LOTTE To Do', ja: 'ロッテで何する', zh: '在乐天做什么' },
    sub: { ko: '영화 전후 코스', en: 'Before & after the movie', ja: '映画の前後コース', zh: '观影前后路线' },
  },
  market: {
    title: { ko: '위드마켓', en: 'With Market', ja: 'ウィズマーケット', zh: 'With Market' },
    sub: { ko: '굿즈 만들기', en: 'Make goods', ja: 'グッズ作り', zh: '制作周边' },
  },
  events: {
    title: { ko: '롯데 이벤트', en: 'LOTTE Events', ja: 'ロッテイベント', zh: '乐天活动' },
    sub: { ko: '롯데 행사', en: 'Events & offers', ja: '催事・特典', zh: '活动与优惠' },
  },
  eat: {
    title: { ko: "'롯데' 뭐먹지", en: 'LOTTE To Eat', ja: 'ロッテで何食べる', zh: '在乐天吃什么' },
    sub: { ko: '맛집 추천', en: 'Restaurants', ja: 'グルメ', zh: '美食推荐' },
  },
  shop: {
    title: { ko: "'롯데' 뭐사지", en: 'LOTTE To Buy', ja: 'ロッテで何買う', zh: '在乐天买什么' },
    sub: { ko: '쇼핑 추천', en: 'Shopping', ja: 'ショッピング', zh: '购物推荐' },
  },
  cinema: {
    title: { ko: '롯데시네마', en: 'LOTTE Cinema', ja: 'ロッテシネマ', zh: '乐天影城' },
    sub: { ko: '상영 시간표', en: 'Showtimes', ja: '上映時間', zh: '放映时间' },
  },
  about: {
    title: { ko: '여기는 롯데', en: 'This is LOTTE', ja: 'ここはロッテ', zh: '这里是乐天' },
    sub: { ko: '시설 소개', en: 'About this place', ja: '施設紹介', zh: '设施介绍' },
  },
  hello: {
    title: { ko: '안녕 롯데', en: 'Hello LOTTE', ja: 'こんにちはロッテ', zh: '你好乐天' },
    sub: { ko: '캐릭터 소개', en: 'Meet the character', ja: 'キャラクター紹介', zh: '角色介绍' },
  },
  movie_share: {
    title: { ko: '영화 나눔', en: 'Movie Sharing', ja: '映画シェア', zh: '电影分享' },
    sub: { ko: '5편 보면 1편 나눔', en: 'Watch 5, share 1', ja: '5本観たら1本シェア', zh: '看5部分享1部' },
  },
  stories: {
    title: { ko: '오늘의 사연', en: "Today's Stories", ja: '今日のストーリー', zh: '今日故事' },
    sub: { ko: '사연 보기', en: 'View stories', ja: 'ストーリーを見る', zh: '查看故事' },
  },
};

/** Localization_Lotte rows for each home entry: [title, subtitle]. COPY is the authored fallback. */
const SHEET_KEYS: Record<string, readonly [string, string]> = {
  ai_search: ['MainButton_AI', 'MainButton_AI_Subtext'],
  market: ['MainButton_Goods', 'MainButton_Goods_Subtext'],
  events: ['MainButton_Event', 'MainButton_Event_Subtext'],
  eat: ['MainButton_ToEat', 'MainButton_ToEat_Subtext'],
  shop: ['MainButton_ToBuy', 'MainButton_ToBuy_SubText'],
  cinema: ['MainButton_Cinema', 'MainButton_Cinema_Subtext'],
  about: ['MainButton_Here', 'MainButton_Here_Subtext'],
  hello: ['MainButton_Greeting', 'MainButton_Greeting_Subtext'],
  movie_share: ['MainButton_FilmShare', 'MainButton_FilmShare_Subtext'],
  stories: ['MainButton_Story', 'MainButton_Story_Subtext'],
};

/** 건물 단추 rows, in site.buildings order. A department store's one button is `Building_Btn@W012`. */
const BUILDING_KEYS: Record<string, readonly string[]> = {
  W011: ['Building_Btn_LotteWorld', 'Building_Btn_Dept', 'Building_Btn_Tower', 'Building_Btn_Mall'],
};

interface CardDef {
  screen: KioskScreenId;
  /** Analytics label — navigate() joins it to the buttons table. */
  label: string;
  icon: string;
  variant: 'cardAi' | 'cardMarket' | 'cardEvents' | 'cardWide1' | 'cardWide2' | 'cardWide3';
}

const TOP_CARDS: readonly CardDef[] = [
  { screen: 'ai_search', label: '롯데 뭐하지', icon: 'card-ai', variant: 'cardAi' },
  { screen: 'market', label: '위드마켓', icon: 'card-market', variant: 'cardMarket' },
  { screen: 'events', label: '롯데 이벤트', icon: 'card-events', variant: 'cardEvents' },
];
const MID_CARDS: readonly CardDef[] = [
  { screen: 'about', label: '여기는 롯데', icon: 'card-about', variant: 'cardWide1' },
  { screen: 'hello', label: '안녕 롯데', icon: 'card-hello', variant: 'cardWide2' },
  { screen: 'stories', label: '오늘의 사연', icon: 'card-story', variant: 'cardWide3' },
];

const COL_STEP = 480;
/** ♿: 7 icons of 210 across the low panel's 1780 inner width — (1780 − 210) / 6. */
const COL_STEP_LOW = 261.67;
/**
 * `plate` tiles draw their plate in CSS with the art centred on it (the A-01 frame's own build);
 * the others are the bundled 300×300 plate exports.
 */
const TILES: readonly {
  screen: KioskScreenId;
  label: string;
  icon: string;
  plate?: 'tilePlateCinema' | 'tilePlateShare' | 'tilePlateCard';
}[] = [
  { screen: 'cinema', label: '롯데시네마', icon: 'tile-cinema-logo', plate: 'tilePlateCinema' },
  { screen: 'movie_share', label: '영화 나눔', icon: 'tile-share', plate: 'tilePlateShare' },
  { screen: 'eat', label: '롯데 뭐먹지', icon: 'tile-eat' },
  { screen: 'shop', label: '롯데 뭐사지', icon: 'tile-shop' },
];
/** ♿: the second card row (여기는 롯데 · 안녕 · 오늘의 사연) joins the tiles — card art on a plate. */
const TILES_LOW: typeof TILES = [
  ...TILES,
  ...MID_CARDS.map((c) => ({ screen: c.screen, label: c.label, icon: c.icon, plate: 'tilePlateCard' as const })),
];

/** 건물 단추 lefts (A-01 W011, y3194). A single-building site centres its one button (y3200). */
const BUILDING_X = [306, 805, 1193, 1533];
/**
 * Other languages place the same four 건물 단추 by their CENTRES — Korean's left + half its
 * rendered width (229.9 · 262.8 · 295.6 · 262.8 in Pretendard Bold 38) — so a longer label grows
 * evenly both ways instead of running into the next button. Each may be at most as wide as the
 * distance to its nearest neighbour's centre, less a 14px gutter; past that the label wraps to two
 * lines and then shrinks (useFitText). Korean keeps the frame's lefts exactly (BUILDING_X).
 */
const BUILDING_CX = [420.95, 936.4, 1340.8, 1664.4];
const buildingMaxWidth = (i: number): number => {
  const gaps = [BUILDING_CX[i]! - (BUILDING_CX[i - 1] ?? -Infinity), (BUILDING_CX[i + 1] ?? Infinity) - BUILDING_CX[i]!];
  return Math.min(...gaps, 2 * (BUILDING_CX[i]! - 150)) - 14;
};
const SEARCH_ROW_BOTTOM = 1277;
/** ♿: the search row drops to y1796 (182 tall). */
const SEARCH_ROW_BOTTOM_LOW = 1978;
/** ♿: 건물 단추 tops — the art drops 24 (2663 → 2687), the buttons with it. */
const BUILDING_TOP_LOW = 3218;
const BUILDING_TOP_LOW_SINGLE = 3224;
const FILLME_LABEL: Copy = {
  ko: '스마트 헬스케어',
  en: 'Smart Healthcare',
  ja: 'スマートヘルスケア',
  zh: '智能健康',
};
/** The caption under the button — A-01 writes it without the space the button's name has. */
const FILLME_CAPTION: Copy = { ...FILLME_LABEL, ko: '스마트헬스케어' };
const RESTROOM_LABEL: Copy = { ko: '화장실', en: 'Restroom', ja: 'トイレ', zh: '洗手间' };

const VOICE_WEATHER = ['lotte.weather'] as const;

export function LotteHome({ controller }: { controller: KioskController }): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const weather = useWeatherStore((s) => s.weather);
  const setStoreQuery = useSearchStore((s) => s.setQuery);
  const playWeatherVideo = useWeatherVideo();
  const site = lotteSite(controller.kioskId);
  const toggleLowReach = useAccessibilityStore((s) => s.toggleLowReach);
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const openBuilding = useLotteNav((s) => s.openBuilding);
  /** `base` always, plus `alt` while ♿ is on. */
  const low = (base?: string, alt?: string): string => `${base ?? ''} ${lowReach ? alt ?? '' : ''}`;
  const promo = useRotatingBanner(lotteIconUrl('banner-page'));
  const tiles = lowReach ? TILES_LOW : TILES;

  const [weatherOpen, setWeatherOpen] = useState(false);
  useVoiceIntro(weatherOpen ? VOICE_WEATHER : null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const clock = useMemo(() => formatDateTime(now), [now]);

  const composer = useRef(new HangulComposer());
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
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
        setStoreQuery(c.value.trim());
        setSearching(false);
        controller.navigate('search', '검색');
        return;
    }
    setQuery(c.value);
  };

  const go = (screen: KioskScreenId, label: string): void => controller.navigate(screen, label);
  const wide = lang !== 'ko';
  const cardsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  /* The 건물 단추 share one --fit: four labels at four sizes would read as broken. */
  const buildingsRef = useRef<HTMLDivElement>(null);
  useFitText(cardsRef, styles.cardText, wide, 0.75, lang);
  /* lowReach is in the key: ♿ swaps the 4-tile grid for the 7-icon row, a different column. */
  useFitText(gridRef, styles.tileText, wide, 0.7, `${lang}|${lowReach}`);
  /* The label, not the pill: it is capped at two lines (max-height), so a third line or a word
     wider than its button reads as overflow and the group shrinks. */
  useFitText(buildingsRef, styles.buildingLabel, wide, 0.7, `${lang}|${lowReach}`);

  const kioskId = controller.kioskId;
  const titleOf = (screen: string): string =>
    lt(SHEET_KEYS[screen]![0], lang, screen === 'hello' ? { ...COPY.hello!.title, ko: site.helloTitle } : COPY[screen]!.title, kioskId);
  const subOf = (screen: string): string => lt(SHEET_KEYS[screen]![1], lang, COPY[screen]!.sub, kioskId);
  const buildingLabel = (b: string, i: number): string =>
    lt(BUILDING_KEYS[kioskId]?.[i] ?? 'Building_Btn', lang, b, kioskId);

  const renderCard = (c: CardDef): ReactElement => {
    const title = <span className={styles.cardTitle}>{titleOf(c.screen)}</span>;
    const sub = <span className={styles.cardSub}>{subOf(c.screen)}</span>;
    const art = lotteIconUrl(c.icon);
    return (
      <button
        key={c.screen}
        type="button"
        className={`${styles.card} ${styles[c.variant]}`}
        onClick={() => go(c.screen, c.label)}
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
        {art && <img src={art} alt="" className={styles.cardArt} draggable={false} />}
      </button>
    );
  };

  const weatherIcon = weather
    ? weatherIconUrl(weatherIconName(weather.icon, weather.main))
    : lotteIconUrl('weather-sun');

  return (
    /* --lotte-mode-bar sizes the ♿ bar and places the promo flush under it (lowReach.ts). */
    <div className={styles.root} style={modeBarVars} lang={lang}>
      {lowReach && (
        <div className={styles.modeBar}>
          {sheetText('BarrierFree_Title', lang as Lang, BARRIER_FREE)}
        </div>
      )}
      {lowReach && promo && (
        <div className={styles.hero}>
          <img src={promo} alt="" className={styles.heroImg} draggable={false} />
        </div>
      )}

      <div className={low(styles.topBar, styles.topBarLow)}>
        <div className={styles.topLeft}>
          {lotteIconUrl('ico-location') && (
            <img
              src={lotteIconUrl('ico-location')}
              alt=""
              className={styles.locationIcon}
              draggable={false}
            />
          )}
          <span className={styles.siteName}>{site.short}</span>
        </div>
        <span className={styles.dateTime}>{clock}</span>
      </div>

      <div
        className={
          weatherOpen ? `${styles.noticeGroup} ${styles.noticeGroupBehind}` : styles.noticeGroup
        }
      >
        <div className={low(styles.notice, styles.noticeLow)}>
          <div className={styles.noticeLead}>
            <div className={styles.noticeRule} />
            <p className={styles.noticeText}>{lt('Home_Notice', lang, site.notice, kioskId)}</p>
          </div>
          <div
            className={styles.weather}
            role="button"
            aria-label={lt('Weather_Title', lang, '날씨')}
            aria-expanded={weatherOpen}
            onClick={() => {
              playWeatherVideo();
              setWeatherOpen((open) => !open);
            }}
          >
            <span className={styles.weatherTemp}>
              {weather ? `${Math.round(weather.tempC)}˚` : '--˚'}
            </span>
            {weatherIcon && (
              <img src={weatherIcon} alt="" className={styles.weatherIcon} draggable={false} />
            )}
          </div>
        </div>
        <LotteCinemaBoard controller={controller} lang={lang} />
      </div>

      <div className={low(styles.searchRow, styles.searchRowLow)}>
        <button
          type="button"
          className={styles.searchHome}
          onClick={() => go('home', '홈')}
          aria-label="홈"
        >
          {lotteIconUrl('ico-home-search') && (
            <img
              src={lotteIconUrl('ico-home-search')}
              alt=""
              className={styles.searchHomeImg}
              draggable={false}
            />
          )}
        </button>
        <div className={low(styles.searchField, styles.searchFieldLow)} onClick={() => setSearching(true)} role="button">
          <span
            className={`${styles.searchText} ${query ? styles.searchValue : styles.searchPlaceholder}`}
          >
            {query || lt('Main_Search', lang, SEARCH_PLACEHOLDER)}
            {searching && <span className={styles.searchCaret} />}
          </span>
          {lotteIconUrl('ico-search') && (
            <img
              src={lotteIconUrl('ico-search')}
              alt=""
              className={styles.searchIcon}
              draggable={false}
            />
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

      <div className={styles.cardRows} ref={cardsRef}>
        <div className={low(styles.cards, styles.cardsLow)}>{TOP_CARDS.map(renderCard)}</div>
        {/* ♿: these three sit in the icon row instead (TILES_LOW). */}
        {!lowReach && <div className={`${styles.cards} ${styles.cardsMid}`}>{MID_CARDS.map(renderCard)}</div>}
      </div>

      <div className={low(styles.panel, styles.panelLow)} />
      <div className={low(styles.grid, styles.gridLow)} ref={gridRef}>
        {tiles.map((tile, i) => (
          <button
            key={tile.screen}
            type="button"
            className={low(styles.tile, styles.tileLow)}
            style={{ left: i * (lowReach ? COL_STEP_LOW : COL_STEP), top: 0 }}
            onClick={() => go(tile.screen, tile.label)}
          >
            {tile.plate ? (
              <span className={`${styles.tilePlate} ${styles[tile.plate]} ${lowReach ? styles.tilePlateLow : ''}`}>
                <img src={lotteIconUrl(tile.icon)} alt="" draggable={false} />
              </span>
            ) : (
              <img
                src={lotteIconUrl(tile.icon)}
                alt=""
                className={low(styles.tileArt, styles.tileArtLow)}
                draggable={false}
              />
            )}
            <span
              className={`${styles.tileText} ${tile.plate ? styles[`${tile.plate}Text`] : ''} ${wide ? styles.tileTextFit : ''} ${lowReach ? styles.tileTextLow : ''}`}
            >
              <span className={styles.tileTitle}>{titleOf(tile.screen)}</span>
              <span className={styles.tileSub}>{subOf(tile.screen)}</span>
            </span>
          </button>
        ))}
      </div>

      {site.art && lotteIconUrl(site.art) ? (
        <img src={lotteIconUrl(site.art)} alt="" className={low(styles.skyline, styles.skylineLow)} draggable={false} />
      ) : (
        <div className={`${styles.skyline} ${styles.skylineHold} ${lowReach ? styles.skylineLow : ''}`}>
          {site.buildings[0]} 건물 그림 자리
        </div>
      )}
      <div ref={buildingsRef}>
      {site.buildings.map((b, i) => {
        const single = site.buildings.length === 1;
        const pos: CSSProperties = single
          ? { left: '50%', top: lowReach ? BUILDING_TOP_LOW_SINGLE : 3200, transform: 'translateX(-50%)' }
          : wide
            ? {
                left: BUILDING_CX[i] ?? BUILDING_X[i],
                maxWidth: buildingMaxWidth(i),
                transform: 'translateX(-50%)',
                ...(lowReach ? { top: BUILDING_TOP_LOW } : {}),
              }
            : { left: BUILDING_X[i], ...(lowReach ? { top: BUILDING_TOP_LOW } : {}) };
        return (
          <button
            key={b}
            type="button"
            className={styles.buildingBtn}
            style={pos}
            onClick={() => {
              openBuilding(guideIndexFor(controller.kioskId, b));
              go('building', `건물 안내-${b}`);
            }}
          >
            <span className={styles.buildingLabel}>{buildingLabel(b, i)}</span>
            <span className={styles.buildingChevron}>›</span>
          </button>
        );
      })}
      </div>

      <div className={styles.rail}>
        {lotteIconUrl('nav-left') && (
          <img src={lotteIconUrl('nav-left')} alt="" className={styles.railImg} draggable={false} />
        )}
        <button
          type="button"
          className={`${styles.railZone} ${styles.railHome}`}
          onClick={() => go('home', '홈')}
          aria-label="홈"
        />
        <button
          type="button"
          className={`${styles.railZone} ${styles.railBack}`}
          onClick={() => go('home', '홈')}
          aria-label="뒤로"
        />
      </div>
      <button
        type="button"
        className={`${styles.railBtn} ${styles.railA11y} ${lowReach ? styles.railBtnOn : ''}`}
        onClick={toggleLowReach}
        aria-label="낮은 화면"
        aria-pressed={lowReach}
      >
        <img src={lotteIconUrl('rail-a11y')} alt="" draggable={false} />
      </button>
      {/* 음성 안내 (the 롯데 sheet's Text-to-speech_Script) — see lotteVoice.ts. */}
      <LotteVoiceButton className={`${styles.railBtn} ${styles.railVoice}`} onClass={styles.railBtnOn} />

      <button
        type="button"
        className={low(styles.fillme, styles.fillmeLow)}
        onClick={() => go('fillme', '필미')}
        aria-label={lt('MainButton_SmartHealthCare', lang, FILLME_LABEL)}
      >
        <img
          src={lotteIconUrl('btn-fillme')}
          alt=""
          className={styles.actionImg}
          draggable={false}
        />
      </button>
      <span className={`${styles.actionLabel} ${styles.labelFillme} ${lowReach ? styles.actionLabelLow : ''}`}>
        {lt('MainButton_SmartHealthCare', lang, FILLME_CAPTION)}
      </span>

      <button
        type="button"
        className={low(styles.camera, styles.cameraLow)}
        onClick={() => controller.startPhoto()}
        aria-label="사진촬영"
      >
        <img
          src={lotteIconUrl('btn-camera-a01')}
          alt=""
          className={styles.actionImg}
          draggable={false}
        />
      </button>

      <button
        type="button"
        className={low(styles.restroom, styles.restroomLow)}
        onClick={() => go('restroom', '화장실')}
        aria-label="화장실"
      >
        <img
          src={lotteIconUrl('ico-restroom-a01')}
          alt=""
          className={styles.actionImg}
          draggable={false}
        />
      </button>
      <span className={`${styles.actionLabel} ${styles.labelRestroom} ${lowReach ? styles.actionLabelLow : ''}`}>
        {lt('MainButton_WC', lang, RESTROOM_LABEL)}
      </span>

      {weatherOpen && <LotteWeatherPanel lang={lang} onClose={() => setWeatherOpen(false)} />}

      <FloatingKeyboard
        open={searching}
        onKey={applyKey}
        onClose={() => setSearching(false)}
        lang={lang}
        top={lowReach ? SEARCH_ROW_BOTTOM_LOW : SEARCH_ROW_BOTTOM}
      />
    </div>
  );
}
