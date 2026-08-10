/**
 * 제주공항 (W006) home — Figma node 6117:48085 (제주>홈).
 *
 * Built from the real node via get_design_context; every position/size in
 * JejuHome.module.css is the exact Figma value. All artwork is exported from its
 * OWN Figma node (see assets/icons/jeju), so no icon is matched by filename —
 * that guesswork is what produced missing icons on the Osan round.
 *
 * Layout, top to bottom: location + clock · 공지 card with live weather ·
 * 항공편 안내 board · search row · 3 feature cards · 12-tile grid on a white
 * panel · K-DRAMA / 사진촬영 / 화장실 · hanbok banner.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { KioskScreenId } from '@shared/types/kiosk';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { useWeatherVideo } from '@renderer/hooks/useWeatherVideo';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { weatherIconUrl, weatherIconName } from '@renderer/assets/weather';
import { pick } from '@renderer/lib/i18n';
import { DONATION_COMING_SOON, withComingSoon } from '@shared/config/donation';
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
 * Notice copy. The Figma shows September seasonal text; it is authored here (and
 * translated) exactly like Hwaseong's NOTICE until a Localization_Jeju sheet
 * exists — at which point this moves to a sheet key like every other string.
 */
const NOTICE = {
  ko: '9월 제주는 살이 통통하게 오른 은갈치와 고등어 같은 가을 해산물과 상큼한 황금향이 맛과 향이 가장 뛰어난 제철입니다.',
  en: 'September in Jeju is peak season for plump autumn seafood — silver hairtail and mackerel — and for fragrant, tangy golden hallabong.',
  ja: '9月の済州は、身の締まったタチウオやサバなどの秋の海の幸と、爽やかな黄金香が最も美味しい旬の季節です。',
  zh: '九月的济州岛，正是肉质肥美的带鱼、青花鱼等秋季海鲜与清甜黄金香最当季的时节。',
};

const SEARCH_PLACEHOLDER = {
  ko: '제주에 대해 검색해보세요!',
  en: 'Search about Jeju!',
  ja: '済州について検索してみてください！',
  zh: '搜索关于济州的信息！',
  vi: 'Tìm kiếm về Jeju!',
  th: 'ค้นหาเกี่ยวกับเชจู!',
  ru: 'Поиск о Чеджу!',
  id: 'Cari tentang Jeju!',
};

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

// ── 항공편 안내 board ───────────────────────────────────────────────────
/**
 * The flight board's five columns. `x` is the Figma centre of each column.
 *
 * TODO(제주 W006): `PLACEHOLDER_FLIGHT` is the literal sample row drawn in the
 * Figma — there is NO flight data source wired. The kiosk has no airport API
 * today (ShopService/EventsService/WeatherService are the only feeds), so this
 * renders fixed sample values. Wire it to a real departures feed before this
 * board goes in front of travellers; a board showing a stale 대한항공 16:05 to
 * everyone is worse than no board.
 */
const FLIGHT_COLUMNS = [
  { key: 'airline',     head: '항공사',  x: 560 },
  { key: 'destination', head: '목적지',  x: 866 },
  { key: 'time',        head: '시간',    x: 1166 },
  { key: 'gate',        head: '게이트',  x: 1400 },
  { key: 'status',      head: '상태',    x: 1680 },
] as const;

const PLACEHOLDER_FLIGHT: Record<(typeof FLIGHT_COLUMNS)[number]['key'], string> = {
  airline: '대한항공',
  destination: '김해(PUS)',
  time: '16:05',
  gate: '7',
  status: '탑승 중',
};

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
   * Corner radius of this tile's plate, in Figma px. Defaults to 45 (.tileArt).
   * It has to be per-tile because the exported plates carry opaque grey corners
   * (Figma flattens backdrop-blur nodes), and the CSS clip that hides them must
   * match each plate's own radius — 탐나오 is drawn at 85.799, not 45.
   */
  radius?: number;
}

/** The 12 grid tiles, in Figma reading order (4 columns × 3 rows). */
const TILES: Tile[] = [
  { screen: 'eat',      label: "'제주'뭐먹지", sub: '맛집 추천',      icon: 'tile-eat'      },
  { screen: 'shop',     label: "'제주'뭐사지", sub: '쇼핑 추천',      icon: 'tile-shop'     },
  { screen: 'lodging',  label: '숙박안내',     sub: '제주 숙소 모음', icon: 'tile-lodging'  },
  { screen: 'taxfree',  label: 'TAX-FREE',    sub: '면세혜택',       icon: 'tile-taxfree'  },
  { screen: 'about',    label: '여기는 제주도', sub: '관광지 추천',    icon: 'tile-about'    },
  { screen: 'hello',    label: "안녕 '하영'",  sub: '하영 소개',      icon: 'tile-hello'    },
  { screen: 'help',     label: "도와줘 '하영'", sub: '편의시설 안내',  icon: 'tile-help'     },
  { screen: 'rentcar',  label: '렌트카',       sub: '간편 예약',      icon: 'tile-rentcar'  },
  { screen: 'exchange', label: '환율',         sub: '환율계산기',     icon: 'tile-exchange' },
  { screen: 'donation', label: '기부',         sub: '교복 기부',      icon: 'tile-donation' },
  { screen: 'tamnao',   label: '탐나오',       sub: '제주공공플랫폼', icon: 'tile-tamnao', radius: 85.799 },
  { screen: 'localpay', label: '지역화폐',     sub: '탐나는전',       icon: 'tile-localpay' },
];

const COL_STEP = 471;
const ROW_STEP = 325;

/** Search row geometry (mirrors .searchRow in the CSS) — the inline keyboard
 *  tray is positioned from it, so the two can't drift apart. */
const SEARCH_ROW_TOP = 1138;
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
  // Bottom promo: live API banner when one is active, else the bundled 한복 banner.
  const banner = useRotatingBanner(jejuIconUrl('banner-hanbok'));
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
  const tileLabel = (tile: Tile): string =>
    tile.screen === 'donation' && donationPending ? withComingSoon(tile.label, lang) : tile.label;

  return (
    <div className={styles.root}>
      {jejuIconUrl('bg') && (
        <img src={jejuIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          {jejuIconUrl('ico-location') && (
            <img src={jejuIconUrl('ico-location')} alt="" className={styles.locationIcon} draggable={false} />
          )}
          <span className={styles.siteName}>JEJUDO ISLAND</span>
        </div>
        <span className={styles.dateTime}>{clock}</span>
      </div>

      {/* ── 공지 card + weather ── */}
      <div className={styles.notice}>
        <div className={styles.noticeRule} />
        <p className={styles.noticeText}>{pick(NOTICE, lang)}</p>

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

      {/* ── 항공편 안내 (placeholder data — see PLACEHOLDER_FLIGHT) ── */}
      <div className={styles.flight}>
        <p className={styles.flightTitle}>항공편 안내</p>
        <div className={styles.flightRule} />
        {FLIGHT_COLUMNS.map((col) => (
          <div key={col.key} className={styles.flightCol}>
            <span className={styles.flightHead} style={{ left: col.x }}>{col.head}</span>
            <span className={styles.flightValue} style={{ left: col.x }}>
              {PLACEHOLDER_FLIGHT[col.key]}
            </span>
          </div>
        ))}
      </div>

      {/* ── Search row ── */}
      <div className={styles.searchRow}>
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

        <div className={styles.searchField} onClick={() => setSearching(true)} role="button">
          <span className={`${styles.searchText} ${query ? styles.searchValue : styles.searchPlaceholder}`}>
            {query || pick(SEARCH_PLACEHOLDER, lang)}
            {searching && <span className={styles.searchCaret} />}
          </span>
          {jejuIconUrl('ico-search') && (
            <img src={jejuIconUrl('ico-search')} alt="" className={styles.searchIcon} draggable={false} />
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

      {/* ── Three feature cards ── */}
      <div className={styles.cards}>
        {CARDS.map((card) => (
          <button
            key={card.screen}
            type="button"
            className={`${styles.card} ${styles[card.variant]}`}
            onClick={() => go(card.screen, card.label)}
          >
            <span className={styles.cardTitle}>{card.label}</span>
            <span className={styles.cardSub}>{card.sub}</span>
            {jejuIconUrl(card.icon) && (
              <img src={jejuIconUrl(card.icon)} alt="" className={styles.cardArt} draggable={false} />
            )}
          </button>
        ))}
      </div>

      {/* ── Menu grid ── */}
      <div className={styles.panel} />
      <div className={styles.grid}>
        {TILES.map((tile, i) => {
          const art = jejuIconUrl(tile.icon);
          const disabled = tile.screen === 'donation' && donationPending;
          return (
            <button
              key={tile.screen}
              type="button"
              className={`${styles.tile} ${disabled ? styles.tileDisabled : ''}`}
              style={{ left: (i % 4) * COL_STEP, top: Math.floor(i / 4) * ROW_STEP }}
              onClick={disabled ? undefined : () => go(tile.screen, tile.label)}
              disabled={disabled}
            >
              {art ? (
                <img
                  src={art}
                  alt=""
                  className={styles.tileArt}
                  style={tile.radius ? { borderRadius: tile.radius } : undefined}
                  draggable={false}
                />
              ) : (
                <span className={styles.tileArtMissing}>{tile.label[0]}</span>
              )}
              <span className={styles.tileText}>
                <span className={styles.tileTitle}>{tileLabel(tile)}</span>
                <span className={styles.tileSub}>{tile.sub}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Bottom actions ── */}
      <button type="button" className={styles.kdrama} onClick={() => go('kdrama', 'K-DRAMA')} aria-label="K-DRAMA">
        {jejuIconUrl('btn-kdrama') && (
          <img src={jejuIconUrl('btn-kdrama')} alt="" className={styles.actionImg} draggable={false} />
        )}
      </button>
      <span className={`${styles.actionLabel} ${styles.labelKdrama}`}>K-DRAMA</span>

      <button type="button" className={styles.camera} onClick={() => controller.startPhoto()} aria-label="사진촬영">
        {jejuIconUrl('btn-camera') && (
          <img src={jejuIconUrl('btn-camera')} alt="" className={styles.actionImg} draggable={false} />
        )}
      </button>

      <button type="button" className={styles.restroom} onClick={() => go('restroom', '화장실')} aria-label="화장실">
        {jejuIconUrl('ico-restroom') && (
          <img src={jejuIconUrl('ico-restroom')} alt="" className={styles.actionImg} draggable={false} />
        )}
      </button>
      <span className={`${styles.actionLabel} ${styles.labelRestroom}`}>화장실</span>

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
        <img src={jejuIconUrl('ico-accessibility')} alt="" className={styles.accessibility} draggable={false} />
      )}

      {/* ── Bottom banner ── */}
      <div className={styles.banner}>
        {banner && <img src={banner} alt="" className={styles.bannerImg} draggable={false} />}
      </div>

      {/* Inline search keyboard — shows in place, no navigation until Enter.
          `top` must track the search row (1138 + 182 = 1320) so the tray opens
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
