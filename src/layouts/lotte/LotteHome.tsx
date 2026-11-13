/**
 * 롯데 home (W011~W013). The geometry is the 제주공항 home's (JejuHome, 4 · 3 · 4 grid) with these
 * changes asked for on 2026-11-09: 3 cards · 4 tiles (two empty) · 3 cards · an empty row kept
 * for three large buttons · the bottom actions. The notice block carries the 롯데시네마 board in
 * place of the 운항 정보 board.
 *
 * Not on this screen yet: ♿ and voice guidance, which are 제주 hardware-led features.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { KioskScreenId } from '@shared/types/kiosk';
import { lotteIconUrl } from '@renderer/assets/icons/lotte';
import { weatherIconName, weatherIconUrl } from '@renderer/assets/weather';
import { useWeatherVideo } from '@renderer/hooks/useWeatherVideo';
import type { Lang } from '@renderer/lib/i18n';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { useFitText } from '@layouts/components/fitText';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';
import { HangulComposer } from '../insadong/keyboard/hangul';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import { LotteCinemaBoard } from './LotteCinemaBoard';
import { LotteWeatherPanel } from './LotteWeatherPanel';
import { lotteSite } from './lotteSample';
import styles from './LotteHome.module.css';

type Copy = { ko: string; en: string; ja: string; zh: string };
const say = (c: Copy, lang: Lang): string =>
  (c as Partial<Record<Lang, string>>)[lang] ?? (lang === 'ko' ? c.ko : c.en);

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
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}(${DAY_NAMES[d.getDay()]})  ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const SEARCH_PLACEHOLDER: Copy = {
  ko: '롯데에 대해 검색해보세요!',
  en: 'Search about LOTTE!',
  ja: 'ロッテについて検索してみてください！',
  zh: '搜索关于乐天的信息！',
};

const COPY: Record<string, { title: Copy; sub: Copy }> = {
  ai_search: {
    title: { ko: "'롯데' 뭐하지", en: 'LOTTE To Do', ja: 'ロッテで何する', zh: '在乐天做什么' },
    sub: { ko: '취향별 추천', en: 'Picks for you', ja: 'おすすめ', zh: '为您推荐' },
  },
  market: {
    title: { ko: '위드마켓', en: 'With Market', ja: 'ウィズマーケット', zh: 'With Market' },
    sub: { ko: '굿즈 만들기', en: 'Make goods', ja: 'グッズ作り', zh: '制作周边' },
  },
  events: {
    title: { ko: '롯데 이벤트', en: 'LOTTE Events', ja: 'ロッテイベント', zh: '乐天活动' },
    sub: { ko: '행사·혜택', en: 'Events & offers', ja: '催事・特典', zh: '活动与优惠' },
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
  help: {
    title: { ko: '롯데 시설안내', en: 'LOTTE Guide', ja: 'ロッテ施設案内', zh: '乐天设施指南' },
    sub: { ko: '층별·편의시설', en: 'Floors & facilities', ja: 'フロア・施設', zh: '楼层与设施' },
  },
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
  { screen: 'help', label: '롯데 시설안내', icon: 'card-guide', variant: 'cardWide3' },
];

const COL_STEP = 480;
const TILES: readonly { screen: KioskScreenId; label: string; icon: string }[] = [
  { screen: 'eat', label: '롯데 뭐먹지', icon: 'tile-eat' },
  { screen: 'shop', label: '롯데 뭐사지', icon: 'tile-shop' },
  { screen: 'cinema', label: '상영 시간표', icon: 'tile-cinema' },
];
/** The fourth tile of the row: its feature is not decided yet (2026-11-09). */
const COMING_SOON_COL = TILES.length;

const BUILDING_X = [276, 792, 1163, 1520];
const COMING_SOON: Copy = { ko: '(준비중)', en: '(Coming soon)', ja: '(準備中)', zh: '(筹备中)' };
const SEARCH_ROW_BOTTOM = 1318;
const FILLME_LABEL: Copy = {
  ko: '스마트 헬스케어',
  en: 'Smart Healthcare',
  ja: 'スマートヘルスケア',
  zh: '智能健康',
};
const RESTROOM_LABEL: Copy = { ko: '화장실', en: 'Restroom', ja: 'トイレ', zh: '洗手间' };

export function LotteHome({ controller }: { controller: KioskController }): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const weather = useWeatherStore((s) => s.weather);
  const setStoreQuery = useSearchStore((s) => s.setQuery);
  const playWeatherVideo = useWeatherVideo();
  const site = lotteSite(controller.kioskId);

  const [weatherOpen, setWeatherOpen] = useState(false);
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
  useFitText(cardsRef, styles.cardText, wide, 0.75, lang);
  useFitText(gridRef, styles.tileText, wide, 0.7, lang);

  const titleOf = (screen: string): string => say(COPY[screen]!.title, lang);

  const renderCard = (c: CardDef): ReactElement => {
    const title = <span className={styles.cardTitle}>{titleOf(c.screen)}</span>;
    const sub = <span className={styles.cardSub}>{say(COPY[c.screen]!.sub, lang)}</span>;
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
    <div className={styles.root}>
      <div className={styles.topBar}>
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
        <div className={styles.notice}>
          <div className={styles.noticeLead}>
            <div className={styles.noticeRule} />
            <p className={styles.noticeText}>{site.notice}</p>
          </div>
          <div
            className={styles.weather}
            role="button"
            aria-label="날씨"
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

      <div className={styles.searchRow}>
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
        <div className={styles.searchField} onClick={() => setSearching(true)} role="button">
          <span
            className={`${styles.searchText} ${query ? styles.searchValue : styles.searchPlaceholder}`}
          >
            {query || say(SEARCH_PLACEHOLDER, lang)}
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
          className={styles.langBtn}
          onClick={() => go('language', '언어선택')}
          aria-label="언어선택"
        >
          {LANG_CODE[lang] ?? 'KR'}
        </button>
      </div>

      <div className={styles.cardRows} ref={cardsRef}>
        <div className={styles.cards}>{TOP_CARDS.map(renderCard)}</div>
        <div className={`${styles.cards} ${styles.cardsMid}`}>{MID_CARDS.map(renderCard)}</div>
      </div>

      <div className={`${styles.panel} ${styles.panelCards ?? ''}`} />
      <div className={styles.grid} ref={gridRef}>
        {TILES.map((tile, i) => (
          <button
            key={tile.screen}
            type="button"
            className={styles.tile}
            style={{ left: i * COL_STEP, top: 0 }}
            onClick={() => go(tile.screen, tile.label)}
          >
            <img
              src={lotteIconUrl(tile.icon)}
              alt=""
              className={styles.tileArt}
              draggable={false}
            />
            <span className={`${styles.tileText} ${wide ? styles.tileTextFit : ''}`}>
              <span className={styles.tileTitle}>{titleOf(tile.screen)}</span>
              <span className={styles.tileSub}>{say(COPY[tile.screen]!.sub, lang)}</span>
            </span>
          </button>
        ))}
      </div>

      <div className={styles.comingSoon} style={{ left: 198 + COMING_SOON_COL * COL_STEP }}>
        <span className={styles.comingPlate} />
        <span className={styles.comingLabel}>{say(COMING_SOON, lang)}</span>
      </div>

      {site.art && lotteIconUrl(site.art) ? (
        <img src={lotteIconUrl(site.art)} alt="" className={styles.skyline} draggable={false} />
      ) : (
        <div className={`${styles.skyline} ${styles.skylineHold}`}>
          {site.buildings[0]} 건물 그림 자리
        </div>
      )}
      {site.buildings.map((b, i) => (
        <span
          key={b}
          className={styles.skylineLabel}
          style={site.buildings.length > 1 ? { left: BUILDING_X[i] } : { left: 730, width: 700 }}
        >
          {b}
        </span>
      ))}

      <button
        type="button"
        className={styles.fillme}
        onClick={() => go('fillme', '필미')}
        aria-label={say(FILLME_LABEL, lang)}
      >
        <img
          src={lotteIconUrl('btn-fillme')}
          alt=""
          className={styles.actionImg}
          draggable={false}
        />
      </button>
      <span className={`${styles.actionLabel} ${styles.labelFillme}`}>
        {say(FILLME_LABEL, lang)}
      </span>

      <button
        type="button"
        className={styles.camera}
        onClick={() => controller.startPhoto()}
        aria-label="사진촬영"
      >
        <img
          src={lotteIconUrl('btn-camera')}
          alt=""
          className={styles.actionImg}
          draggable={false}
        />
      </button>

      <button
        type="button"
        className={styles.restroom}
        onClick={() => go('restroom', '화장실')}
        aria-label="화장실"
      >
        <img
          src={lotteIconUrl('ico-restroom')}
          alt=""
          className={styles.actionImg}
          draggable={false}
        />
      </button>
      <span className={`${styles.actionLabel} ${styles.labelRestroom}`}>
        {say(RESTROOM_LABEL, lang)}
      </span>

      {weatherOpen && <LotteWeatherPanel lang={lang} onClose={() => setWeatherOpen(false)} />}

      <FloatingKeyboard
        open={searching}
        onKey={applyKey}
        onClose={() => setSearching(false)}
        lang={lang}
        top={SEARCH_ROW_BOTTOM}
      />
    </div>
  );
}
