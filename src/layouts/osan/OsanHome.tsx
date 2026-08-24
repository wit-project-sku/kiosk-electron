import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskScreenId, SupportedLanguage } from '@shared/types/kiosk';
import { SearchIcon } from '@layouts/components/SearchIcon';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { trackEvent } from '@renderer/lib/analytics';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { useWeatherVideo } from '@renderer/hooks/useWeatherVideo';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { weatherIconName, weatherIconUrl } from '@renderer/assets/weather';
import { useHasDonationTile, useOrderedTiles, type TileKey } from '@renderer/lib/buttonLayout';
import { DONATION_COMING_SOON, withComingSoon } from '@shared/config/donation';
import { t } from '@renderer/lib/loc';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';
import { HangulComposer } from '../insadong/keyboard/hangul';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import { OsanLeftNav } from './OsanLeftNav';
import styles from './OsanHome.module.css';

interface OsanHomeTile {
  screen: KioskScreenId;
  label: string;
  icon: string;
  bg: string;
  wide?: boolean;
  /** Anchor the icon to the bottom of the box (e.g. full-body 정이 illustration). */
  alignBottom?: boolean;
  /** Explicit icon size (CSS length) overriding the default 85% — exact Figma dims. */
  iconW?: string;
  iconH?: string;
  /**
   * The art IS the whole tile face (an opaque square), not a glyph to centre on
   * `bg`. Fills the box edge-to-edge instead of the default 85% inset — without
   * this, `bg` shows as a frame around the artwork.
   */
  artFull?: boolean;
}

/** Mint fill of donation.png (sampled from the art itself). The PNG is a rounded
 *  square whose CORNERS are transparent, so the box behind it must match or the
 *  corners show a different colour. */
const DONATION_ART_BG = '#cbeae5';

/** Grid slot 14 — 기부 on kiosks running the donation app (오색시장 W004), 오색시장
 *  지도 otherwise. Mutually exclusive: the CMS carries a row for exactly one of
 *  them, so rendering both drops the grid to authored order. See
 *  useHasDonationTile. */
const MAP_TILE: OsanHomeTile = { screen: 'map', label: '오색시장 지도', icon: 'map', bg: '#fdd089' };
// Unlike every other Osan icon (a transparent glyph centred on `bg`), the 기부 art
// is an opaque mint square that IS the tile face — so it fills the box and `bg`
// only matters for the artwork's own rounded corners, which are transparent.
// Hence mint, not the 지도 tile's orange: that orange was showing as a frame.
const DONATION_TILE: OsanHomeTile = { screen: 'donation', label: '기부', icon: 'donation', bg: DONATION_ART_BG, artFull: true };

/** Tiles authored before slot 14 (the 기부/지도 slot at the end of row 3). */
const TILES_BEFORE_SLOT14: OsanHomeTile[] = [
  // Row 1 — AI wide tile + 2 regular
  { screen: 'ai_search', label: "'정이' 모하지 (AI검색)", icon: 'ai-search',       bg: '#1c7bd4', wide: true, iconW: '16.78cqw', iconH: '5.594cqh' },
  { screen: 'market',    label: '위드마켓',               icon: 'market',           bg: '#ffcc99', iconW: '5.995cqw', iconH: '5.625cqh' },
  { screen: 'events',    label: '오산시 이벤트',           icon: 'events',           bg: '#ffa680' },
  // Row 2
  { screen: 'eat',     label: "'정이' 뭐먹지",      icon: 'eat',            bg: '#ff8486' },
  { screen: 'shop',    label: "'정이' 뭐사지(식품)", icon: 'shop',           bg: '#ffa680' },
  { screen: 'lodging', label: "'정이' 뭐사지(물품)", icon: 'goods',          bg: '#5893ff' },
  { screen: 'taxfree', label: 'TAX-FREE',           icon: 'taxfree',        bg: '#ff8fcd', iconW: '12.963cqw', iconH: '7.292cqh' },
  // Row 3
  { screen: 'about',     label: '여기는 오색시장', icon: 'about',           bg: '#ffa565' },
  { screen: 'hello',     label: "안녕 '정이'",    icon: 'hello',           bg: '#dbc7ff', alignBottom: true },
  { screen: 'help',      label: "도와줘 '정이'",  icon: 'help',            bg: '#9aea96' },
];
/** Tiles authored after slot 14. */
const TILES_AFTER_SLOT14: OsanHomeTile[] = [
  // Row 4
  { screen: 'exchange',  label: '환율',    icon: 'exchange',        bg: '#ffb2c5' },
  { screen: 'transport', label: '교통안내', icon: 'transport',       bg: '#9c8ce4' },
  { screen: 'palace',    label: '전국시장(준비중)', icon: 'national-market', bg: '#ffa7a8' },
  { screen: 'museum',    label: '지역화폐', icon: 'local-pay',       bg: '#94dfff' },
];

/** Join a home tile to its CMS button by screen key (see useOrderedTiles). */
const osanTileKey = (t: OsanHomeTile): TileKey => ({ screen: t.screen });

/** Home-tile screen id → Localization_Osaek key (4-language label from the sheet).
 *  Tiles without a sheet key (물품, TAX-FREE) keep their hardcoded label. */
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
type Run = { t: string; b?: boolean };

function parseNotice(text: string): Run[][] {
  const lines: Run[][] = [[]];
  let bold = false;
  for (const tok of text.split(/(<b>|<\/b>|\n)/g)) {
    if (tok === '') continue;
    if (tok === '<b>') bold = true;
    else if (tok === '</b>') bold = false;
    else if (tok === '\n') lines.push([]);
    else lines[lines.length - 1]!.push({ t: tok, b: bold });
  }
  return lines;
}

function pick<T>(map: Partial<Record<Lang, T>>, lang: Lang): T {
  return (map[lang] ?? map.ko ?? (Object.values(map)[0] as T)) as T;
}

const KDRAMA_LABEL: Partial<Record<Lang, string>> = {
  ko: '취사병 전설이 되다',
  en: 'Cook Soldier: Legend',
  ja: '炊事兵、伝説になる',
  zh: '炊事兵成为传说',
  vi: 'Anh nuôi trở thành huyền thoại',
  th: 'พลทหารครัวสู่ตำนาน',
  ru: 'Повар-солдат: легенда',
  id: 'Prajurit Juru Masak Jadi Legenda',
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

/** Language-selector button label per language. Must match the 언어선택 picker
 *  pill codes (LANG_META in OsanLanguage.tsx): ja → JP, zh → CN. */
const LANG_CODE: Partial<Record<Lang, string>> = {
  ko: 'KR', en: 'EN', ja: 'JP', vi: 'VN', zh: 'CN',
  th: 'TH', ru: 'RU', id: 'ID',
};
const langCode = (lang: Lang): string => LANG_CODE[lang] ?? lang.toUpperCase();

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}(${WEEKDAYS[d.getDay()]})`;
}

function OsanTile({
  tile,
  label,
  onClick,
  disabled = false,
}: {
  tile: OsanHomeTile;
  label: string;
  onClick: () => void;
  /** Not-ready page (e.g. 전국시장 준비중): inert click, but colours unchanged. */
  disabled?: boolean;
}): JSX.Element {
  const url = osanIconUrl(tile.icon);
  return (
    <button
      type="button"
      className={tile.wide ? `${styles.tile} ${styles.tileWide}` : styles.tile}
      onClick={onClick}
      aria-disabled={disabled || undefined}
      style={disabled ? { pointerEvents: 'none' } : undefined}
    >
      <span
        className={[
          styles.tileBox,
          tile.alignBottom ? styles.tileBoxBottom : '',
          tile.artFull ? styles.tileBoxFull : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ backgroundColor: tile.bg }}
      >
        {url ? (
          <img
            src={url}
            alt=""
            draggable={false}
            style={tile.iconW ? { width: tile.iconW, height: tile.iconH } : undefined}
          />
        ) : (
          <span className={styles.tileFallback}>{label}</span>
        )}
      </span>
      <span className={styles.tileLabel}>{label}</span>
    </button>
  );
}

interface OsanHomeProps {
  controller: KioskController;
}

export function OsanHome({ controller }: OsanHomeProps): JSX.Element {
  const { navigate, startPhoto, kioskId } = controller;
  const weather = useWeatherStore((s) => s.weather);
  const playWeatherVideo = useWeatherVideo();
  const lang = useLanguageStore((s) => s.currentLanguage);

  const noticeLines = parseNotice(t('NoticeContent', lang));
  const badge = t('Notice', lang)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const placeholder = pick(SEARCH_PLACEHOLDER, lang);

  // Slot 14 is 기부 or 오색시장 지도 depending on whether this kiosk runs the
  // donation app.
  const hasDonation = useHasDonationTile(kioskId);
  const tiles: OsanHomeTile[] = useMemo(
    () => [...TILES_BEFORE_SLOT14, hasDonation ? DONATION_TILE : MAP_TILE, ...TILES_AFTER_SLOT14],
    [hasDonation],
  );
  // Re-order tiles to match the CMS layout (line/position); the 4-column grid
  // auto-flows them. Falls back to authored order when uncached.
  const orderedTiles = useOrderedTiles(kioskId, tiles, osanTileKey);

  const setSearchQuery = useSearchStore((s) => s.setQuery);
  const composer = useRef(new HangulComposer());
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [now, setNow] = useState(() => new Date());
  // Bottom promo banner: live API banner when active, else the bundled 오색시장 one.
  const banner = useRotatingBanner(osanIconUrl('banner'));

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
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
      case 'jamo':     c.inputJamo(action.value);    break;
      case 'literal':  c.inputLiteral(action.value); break;
      case 'space':    c.inputLiteral(' ');           break;
      case 'backspace': c.backspace();                break;
      case 'enter':    submitSearch(); return;
    }
    setQuery(c.value);
  };

  const weatherSrc = weather
    ? weatherIconUrl(weatherIconName(weather.icon, weather.main))
    : undefined;
  const bottomBarSrc = osanIconUrl('bottom-bar');

  return (
    <>
      {osanIconUrl('bg') && (
        <img className={styles.bgImage} src={osanIconUrl('bg')} alt="" draggable={false} />
      )}

      <div className={styles.home}>
        {/* ── Top block: brand + date + notice + weather ── */}
        <div className={styles.topBlock}>
          <header className={styles.header}>
            <div className={styles.brand}>
              {osanIconUrl('location-pin') && (
                <img className={styles.pin} src={osanIconUrl('location-pin')} alt="" draggable={false} />
              )}
              <span>OSAEK MARKET</span>
            </div>
            <span className={styles.date}>{formatDate(now)}</span>
          </header>

          <div className={styles.infoRow}>
            <div className={styles.notice}>
              <span className={styles.noticeBadge}>
                {badge.map((ch, i) => (
                  <span key={i}>{ch}</span>
                ))}
              </span>
              <span className={styles.noticeDivider} />
              <p className={styles.noticeText}>
                {noticeLines.map((line, i) => (
                  <span key={i} className={styles.noticeLine}>
                    {line.map((run, j) => (
                      <span key={j} className={run.b ? styles.noticeBold : undefined}>
                        {run.t}
                      </span>
                    ))}
                  </span>
                ))}
              </p>
            </div>
            <button
              type="button"
              className={styles.weather}
              onClick={playWeatherVideo}
              aria-label="오늘 날씨 영상"
            >
              {weatherSrc && (
                <img className={styles.weatherGlyph} src={weatherSrc} alt="" draggable={false} />
              )}
              <span className={styles.temp}>{weather ? `${weather.tempC}°` : '—'}</span>
            </button>
          </div>
        </div>

        {/* ── Content: search row + tile grid ── */}
        <div className={styles.content}>
          <div className={styles.searchRow}>
            <button type="button" className={styles.homeBtn} aria-label="홈">
              {osanIconUrl('home-btn') && (
                <img src={osanIconUrl('home-btn')} alt="" draggable={false} />
              )}
            </button>
            <button
              type="button"
              className={styles.searchInput}
              onClick={() => setFocused(true)}
            >
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
            <button
              type="button"
              className={styles.krBtn}
              onClick={() => navigate('language', '언어선택')}
            >
              {langCode(lang)}
            </button>
          </div>

          <div className={styles.grid}>
            {orderedTiles.map((tile) => {
              const key = TILE_LABEL_KEYS[tile.screen];
              const base = key
                ? t(key, lang)
                : tile.screen === 'lodging'
                  ? pick(LODGING_LABEL, lang)
                  : tile.label;
              // 전국시장, and — while soft-launching — 기부, are not ready yet: keep
              // the tile visible/coloured but inert.
              const donationSoon = tile.screen === 'donation' && DONATION_COMING_SOON;
              const notReady = tile.screen === 'palace' || donationSoon;
              const label = donationSoon ? withComingSoon(base, lang) : base;
              return (
                <OsanTile
                  key={tile.screen}
                  tile={tile}
                  label={label}
                  disabled={notReady}
                  onClick={notReady ? () => {} : () => navigate(tile.screen, tile.label)}
                />
              );
            })}
          </div>
        </div>

        {/* ── Bottom row: K-DRAMA + camera + 화장실 ── */}
        <div className={styles.bottomRow}>
          {bottomBarSrc && (
            <img className={styles.bottomBarBg} src={bottomBarSrc} alt="" draggable={false} />
          )}
          <button
            type="button"
            className={styles.kdramaItem}
            onClick={() => navigate('kdrama', 'K-DRAMA')}
          >
            <span className={styles.kdramaIcon}>
              {osanIconUrl('kdrama') && (
                <img src={osanIconUrl('kdrama')} alt="" draggable={false} />
              )}
            </span>
            <span className={styles.navLabel}>{pick(KDRAMA_LABEL, lang)}</span>
          </button>
          <button
            type="button"
            className={styles.cameraBtn}
            onClick={startPhoto}
            aria-label="사진 촬영"
          >
            {osanIconUrl('camera-btn') && (
              <img
                className={styles.cameraImg}
                src={osanIconUrl('camera-btn')}
                alt=""
                draggable={false}
              />
            )}
          </button>
          <button
            type="button"
            className={styles.restroomItem}
            onClick={() => navigate('restroom', '화장실')}
          >
            <span className={styles.navIcon}>
              {osanIconUrl('restroom') && (
                <img src={osanIconUrl('restroom')} alt="" draggable={false} />
              )}
            </span>
            <span className={styles.navLabel}>{t('MainButton_WC', lang)}</span>
          </button>
        </div>

        {/* Bottom promo banner (가상 한복 체험) */}
        {banner && (
          <button
            type="button"
            className={styles.banner}
            onClick={startPhoto}
            aria-label="가상 한복 체험"
          >
            <img
              className={styles.bannerImg}
              src={banner}
              alt=""
              draggable={false}
            />
          </button>
        )}
      </div>

      {/* Left nav — home + back */}
      <OsanLeftNav
        onHome={() => navigate('home', 'Home')}
        onBack={() => navigate('home', 'Back')}
      />

      <FloatingKeyboard
        open={focused}
        onKey={applyKey}
        onClose={() => setFocused(false)}
        lang={lang}
      />
    </>
  );
}
