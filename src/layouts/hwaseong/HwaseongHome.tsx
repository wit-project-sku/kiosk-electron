import { useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { KioskScreenId } from '@shared/types/kiosk';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { weatherIconUrl, weatherIconName } from '@renderer/assets/weather';
import { buttonText, pick } from '@renderer/lib/i18n';
import { useApiTileRows, type TileKey } from '@renderer/lib/buttonLayout';
import { t } from '@renderer/lib/loc';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';

/** Search-bar language button → the current language's display code. */
const LANG_CODE: Record<string, string> = { ko: 'KR', en: 'EN', ja: 'JP', zh: 'CN' };

/** Home notice card + search placeholder (localized; tiles use sheet keys). */
const NOTICE = {
  ko: "화성휴게소의 마스코트 'HUE'가 박술녀 한복을 입고 나와요. 여러분도 체험할 수 있도록 할게요. 한복을 입어보세요~",
  en: "Hwaseong SA's mascot 'HUE' appears in Master Park Sul-nyeo's hanbok. Come and try one on yourself too~",
  ja: '華城SAのマスコット「HUE」が朴術女(パク・スルニョ)の韓服を着て登場。皆さんもぜひ韓服を体験してみてください～',
  zh: '华城休息站的吉祥物“HUE”身着朴术女韩服登场。大家也来体验穿韩服吧～',
};
const SEARCH_PLACEHOLDER = {
  ko: '화성휴게소에 대해 검색해보세요!',
  en: 'Search about Hwaseong Service Area!',
  ja: '華城SAについて検索してみてください！',
  zh: '搜索关于华城休息站的信息！',
};
import { HangulComposer } from '../insadong/keyboard/hangul';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import styles from './HwaseongHome.module.css';

interface Props {
  controller: KioskController;
}

// ── Date formatting ────────────────────────────────────────────────
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dow = DAY_NAMES[d.getDay()];
  return `${y}-${m}-${day}(${dow})`;
}

// ── Tile definitions ───────────────────────────────────────────────
interface Tile {
  screen: KioskScreenId;
  /** Korean label — kept for analytics (button_type stays language-stable). */
  label: string;
  /** Localization_Hwaseong key — what the tile actually displays. */
  labelKey: string;
  icon: string; // hwaseongIconUrl key
}

// Icons are the actual Figma tile renders (fg-*), exported 1:1 from the
// matching Figma node so every tile is pixel-exact to the design. Each tile's
// visible text comes from the sheet (labelKey) so it switches with the language.
// Row 1: wide traffic card + 2 square tiles
const ROW1_WIDE: Tile = { screen: 'transport',  label: '전국도로교통상황', labelKey: 'MainButton_TrafficInfo', icon: 'fg-traffic'  };
// Per Figma 4167-176562: 전국시장 is the top row's 2nd tile, 전국휴게소 the 2nd
// row's 3rd tile. Only the LABEL/destination moved — each grid slot keeps its
// original icon art (so fg-reststop stays at row 1, fg-market at row 2).
const ROW1: HomeTile[] = [
  { screen: 'market',      label: '전국시장(준비중)', labelKey: 'MainButton_TraditionalMarket', icon: 'fg-reststop', disabled: true },
  { screen: 'events',      label: '화성시 이벤트',    labelKey: 'MainButton_Event',             icon: 'fg-event'    },
];

// Rows 2–4: 4 tiles each
const ROW2: Tile[] = [
  { screen: 'food_court',  label: "'휴' 뭐먹지", labelKey: 'MainButton_ToEat',       icon: 'fg-eat'     },
  { screen: 'shop',        label: "'휴' 뭐사지", labelKey: 'MainButton_ToBuy',       icon: 'fg-buy'     },
  { screen: 'convenience', label: '전국휴게소',   labelKey: 'MainButton_ServiceArea', icon: 'fg-market'  },
  { screen: 'taxfree',     label: 'TAX-FREE',    labelKey: 'MainButton_TaxFree',     icon: 'fg-taxfree' },
];

const ROW3: Tile[] = [
  { screen: 'tourism',   label: '화성휴게소',      labelKey: 'MainButton_Here',     icon: 'fg-resthome' },
  { screen: 'hello',     label: "안녕 '휴'",       labelKey: 'MainButton_Greeting', icon: 'fg-hello'    },
  { screen: 'help',      label: "도와줘 '휴'",     labelKey: 'MainButton_ToHelp',   icon: 'fg-help'     },
  { screen: 'parking',   label: '화성휴게소 지도', labelKey: 'MainButton_SAMap',    icon: 'fg-map'      },
];

/** A tile plus optional flags: `disabled` (준비중), `wide` (the 2-col traffic card),
 *  and an explicit DB `slot`. `slot` disambiguates tiles that share a screen key
 *  (the three `rest_info` tiles → slots 16/17/18) so each joins to a distinct API row. */
type HomeTile = Tile & { disabled?: boolean; wide?: boolean; slot?: number };

const ROW4: HomeTile[] = [
  { screen: 'exchange',  label: '환율',          labelKey: 'MainButton_Exchange',    icon: 'fg-exchange' },
  { screen: 'rest_info', label: '문화재(준비중)', labelKey: 'MainButton_Property',    icon: 'fg-heritage', disabled: true, slot: 16 },
  { screen: 'rest_info', label: 'K-컬처(준비중)', labelKey: 'MainButton_KCulture',    icon: 'fg-kculture', disabled: true, slot: 17 },
  { screen: 'rest_info', label: '지역화폐',       labelKey: 'MainButton_MarketPaper', icon: 'fg-localpay', slot: 18 },
];

/** Flat tile list in authored order — reordered to the CMS layout by useApiTileRows.
 *  ROW1_WIDE is the 2-column traffic card (wide flag is local: the API span is null). */
const ALL_TILES: HomeTile[] = [{ ...ROW1_WIDE, wide: true }, ...ROW1, ...ROW2, ...ROW3, ...ROW4];

/** Join a Hwaseong tile to its CMS button — by explicit slot when the screen key
 *  is shared (rest_info), else by screen key (see useApiTileRows). */
const hwaseongTileKey = (t: HomeTile): TileKey => ({ screen: t.screen, slot: t.slot });

// ── Sub-components ──────────────────────────────────────────────────
function SquareTile({ tile, label, onClick, disabled }: { tile: Tile; label: string; onClick: () => void; disabled?: boolean }) {
  const src = hwaseongIconUrl(tile.icon);
  return (
    <div className={`${styles.tileWrap} ${disabled ? styles.tileDisabled : ''}`} onClick={disabled ? undefined : onClick}>
      <div className={styles.tileCard}>
        {src ? (
          <img src={src} alt={label} className={styles.tileCardImg} draggable={false} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, color: '#999' }}>
            {label[0]}
          </div>
        )}
      </div>
      <span className={styles.tileLabel}>{label}</span>
    </div>
  );
}

/** The wide traffic-style card (spans 2 columns). */
function WideTile({ tile, label, onClick }: { tile: Tile; label: string; onClick: () => void }) {
  const src = hwaseongIconUrl(tile.icon);
  return (
    <div className={styles.tileWrapWide} onClick={onClick}>
      <div className={styles.tileCardWide}>
        {src ? (
          <img src={src} alt={label} className={styles.tileCardImg} draggable={false} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#fff48d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
            🚗
          </div>
        )}
      </div>
      <span className={styles.tileLabel}>{label}</span>
    </div>
  );
}

/** Renders a tile as the wide traffic card (tile.wide) or a square tile. */
function TileView({ tile, label, onClick, disabled }: { tile: HomeTile; label: string; onClick: () => void; disabled?: boolean }) {
  if (tile.wide) return <WideTile tile={tile} label={label} onClick={onClick} />;
  return <SquareTile tile={tile} label={label} onClick={onClick} disabled={disabled} />;
}

// ── Main component ──────────────────────────────────────────────────
export function HwaseongHome({ controller }: Props): JSX.Element {
  const weather = useWeatherStore((s) => s.weather);
  const today = useMemo(() => formatDate(new Date()), []);
  const lang = useLanguageStore((s) => s.currentLanguage);
  const setStoreQuery = useSearchStore((s) => s.setQuery);
  // Tile label: curated override (proper ja/zh) → sheet value. Active tiles
  // strip a stale "(준비중)" suffix (e.g. a cached 전국시장(준비중)); only the
  // genuinely-disabled tiles keep their 준비중 marker.
  const L = (key: string): string => buttonText(key, lang) ?? t(key, lang);
  const TILE = (key: string, keepPending = false): string =>
    keepPending ? L(key) : L(key).replace(/\s*\(준비중\)\s*/g, '').trim();

  // Inline search keyboard (no navigation on tap — keyboard shows in place).
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
        // Only on Enter do we leave the home page → show results.
        setStoreQuery(c.value.trim());
        setSearching(false);
        controller.navigate('search');
        return;
    }
    setQuery(c.value);
  }

  function go(tile: Tile): void {
    // navigate() resolves the DB button id (buttonCatalog) and fires the
    // button_clicked + menu-touch analytics — same path as the other kiosks.
    controller.navigate(tile.screen, tile.label);
  }

  // CMS-driven menu order (grouped into rows by line, sorted by position). null →
  // keep the authored rows below (offline / partial data / any cell collision).
  const dynamicRows = useApiTileRows(controller.kioskId, ALL_TILES, hwaseongTileKey);

  const weatherIcon = weather
    ? weatherIconUrl(weatherIconName(weather.icon, weather.main))
    : undefined;

  return (
    <div className={styles.root}>
      {/* ── Background layers ── */}
      <div className={styles.bgBase} />
      {hwaseongIconUrl('bg') && (
        <img
          src={hwaseongIconUrl('bg')}
          alt=""
          className={styles.bgImage}
          draggable={false}
        />
      )}

      {/* ── Header ─────────────────────────────────── */}
      <div className={styles.header}>
        {/* Row 1: site name + date */}
        <div className={styles.headerTopRow}>
          <div className={styles.headerLeft}>
            {/* Location pin icon (Figma 5431:19607) */}
            <svg
              className={styles.locationIcon}
              xmlns="http://www.w3.org/2000/svg"
              width="71"
              height="90"
              viewBox="0 0 71 90"
              fill="none"
            >
              <g filter="url(#hw_loc_shadow)">
                <path
                  d="M35.5 82C35.5 82 67 53.4783 67 32.087C67 14.3658 52.897 0 35.5 0C18.103 0 4 14.3658 4 32.087C4 53.4783 35.5 82 35.5 82Z"
                  fill="#005AB4"
                />
                <path
                  d="M45.5638 30.7507C45.5638 36.4116 41.0586 41.0007 35.5013 41.0007C29.9439 41.0007 25.4388 36.4116 25.4388 30.7507C25.4388 25.0897 29.9439 20.5007 35.5013 20.5007C41.0586 20.5007 45.5638 25.0897 45.5638 30.7507Z"
                  fill="white"
                />
              </g>
              <defs>
                <filter
                  id="hw_loc_shadow"
                  x="0"
                  y="0"
                  width="71"
                  height="90"
                  filterUnits="userSpaceOnUse"
                  colorInterpolationFilters="sRGB"
                >
                  <feFlood floodOpacity="0" result="BackgroundImageFix" />
                  <feColorMatrix
                    in="SourceAlpha"
                    type="matrix"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    result="hardAlpha"
                  />
                  <feOffset dy="4" />
                  <feGaussianBlur stdDeviation="2" />
                  <feComposite in2="hardAlpha" operator="out" />
                  <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
                  <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
                  <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
                </filter>
              </defs>
            </svg>
            <span className={styles.siteName}>HWASEONG SA</span>
          </div>
          <span className={styles.headerDate}>{today}</span>
        </div>

        {/* Row 2: notice + weather */}
        <div className={styles.headerBottomRow}>
          {/* Notice card */}
          <div className={styles.noticeCard}>
            <div className={styles.noticeInner}>
              <div className={styles.noticeLabel}>
                <p style={{ margin: 0 }}>공</p>
                <p style={{ margin: 0 }}>지</p>
              </div>
              <div className={styles.noticeDivider} />
              <div className={styles.noticeText}>
                <p style={{ margin: 0 }} className={styles.noticeMedium}>{pick(NOTICE, lang)}</p>
              </div>
            </div>
          </div>

          {/* Weather card — tap advances the customer-display video (다음 영상),
              same as the other kiosks. */}
          <div
            className={styles.weatherCard}
            role="button"
            aria-label="다음 영상"
            onClick={() => void window.api.kiosk.advanceVideo()}
          >
            {weatherIcon && (
              <img src={weatherIcon} alt="" className={styles.weatherIconImg} draggable={false} />
            )}
            {weather ? (
              <span className={styles.weatherTemp}>{Math.round(weather.tempC)}˚</span>
            ) : (
              <span className={styles.weatherTemp}>--˚</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Content (search + menu grid) ─────────────── */}
      <div className={styles.content}>
        {/* Search bar */}
        <div className={styles.searchBar}>
          {hwaseongIconUrl('ico-home') ? (
            <img
              src={hwaseongIconUrl('ico-home')}
              alt=""
              className={styles.searchHomeIcon}
              draggable={false}
              onClick={() => controller.navigate('home')}
            />
          ) : (
            <div style={{ width: 180, height: 180, borderRadius: '50%', background: '#005ab4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              onClick={() => controller.navigate('home')}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="white"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            </div>
          )}

          <div className={styles.searchField} onClick={() => setSearching(true)}>
            <span className={styles.searchFieldText}>
              {query ? (
                <span className={styles.searchValue}>{query}</span>
              ) : (
                <span className={styles.searchPlaceholder}>{pick(SEARCH_PLACEHOLDER, lang)}</span>
              )}
              {searching && <span className={styles.searchCaret} />}
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="77" viewBox="0 0 80 77" fill="none" className={styles.searchIcon}>
              <path d="M60.8219 58.9L75.5 72.5M70.7667 36.2333C70.7667 53.7592 55.9324 67.9667 37.6333 67.9667C19.3343 67.9667 4.5 53.7592 4.5 36.2333C4.5 18.7075 19.3343 4.5 37.6333 4.5C55.9324 4.5 70.7667 18.7075 70.7667 36.2333Z" stroke="#005AB4" strokeWidth="9" strokeLinecap="round"/>
            </svg>
          </div>

          <div className={styles.langBtn} onClick={() => controller.navigate('language')}>
            <span className={styles.langBtnText}>{LANG_CODE[lang] ?? 'KR'}</span>
          </div>
        </div>

        {/* Menu grid — API-ordered when a full layout is cached, else authored. */}
        <div className={styles.menuGrid}>
          {dynamicRows
            ? dynamicRows.map((row, i) => (
                <div key={i} className={styles.menuRow}>
                  {row.map((tile) => (
                    <TileView
                      key={tile.screen + tile.label}
                      tile={tile}
                      label={TILE(tile.labelKey, tile.disabled)}
                      onClick={() => go(tile)}
                      disabled={tile.disabled}
                    />
                  ))}
                </div>
              ))
            : (
              <>
                {/* Row 1: wide + 2 */}
                <div className={styles.menuRow}>
                  {/* Wide traffic tile */}
                  <WideTile tile={ROW1_WIDE} label={TILE(ROW1_WIDE.labelKey)} onClick={() => go(ROW1_WIDE)} />

                  {/* 2 square tiles */}
                  {ROW1.map((tile) => (
                    <SquareTile key={tile.screen + tile.label} tile={tile} label={TILE(tile.labelKey, tile.disabled)} onClick={() => go(tile)} disabled={tile.disabled} />
                  ))}
                </div>

                {/* Row 2 */}
                <div className={styles.menuRow}>
                  {ROW2.map((tile) => (
                    <SquareTile key={tile.screen + tile.label} tile={tile} label={TILE(tile.labelKey)} onClick={() => go(tile)} />
                  ))}
                </div>

                {/* Row 3 */}
                <div className={styles.menuRow}>
                  {ROW3.map((tile) => (
                    <SquareTile key={tile.screen + tile.label} tile={tile} label={TILE(tile.labelKey)} onClick={() => go(tile)} />
                  ))}
                </div>

                {/* Row 4 */}
                <div className={styles.menuRow}>
                  {ROW4.map((tile) => (
                    <SquareTile key={tile.screen + tile.label} tile={tile} label={TILE(tile.labelKey, tile.disabled)} onClick={() => go(tile)} disabled={tile.disabled} />
                  ))}
                </div>
              </>
            )}
        </div>
      </div>

      {/* ── Left nav (single Figma render: home + back) ── */}
      <div className={styles.leftNav}>
        {hwaseongIconUrl('fg-leftnav') && (
          <img src={hwaseongIconUrl('fg-leftnav')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        {/* Transparent click zones over the two icons */}
        <button
          type="button"
          className={styles.leftNavZoneHome}
          onClick={() => controller.navigate('home')}
          aria-label="홈"
        />
        <button
          type="button"
          className={styles.leftNavZoneBack}
          onClick={() => controller.navigate('home')}
          aria-label="뒤로"
        />
      </div>

      {/* ── Bottom nav (single Figma render incl. labels) ── */}
      <div className={styles.bottomNav}>
        {hwaseongIconUrl('fg-bottomnav') && (
          <img src={hwaseongIconUrl('fg-bottomnav')} alt="" className={styles.bottomNavImg} draggable={false} />
        )}

        {/* Transparent click zones over the three buttons (Figma coords) */}
        {/* 스마트 관광 — 준비중: not clickable, no navigation */}
        <div className={styles.bottomNavZoneLeft} aria-label="스마트 관광(준비중)" />
        <button
          type="button"
          className={styles.bottomNavZoneCenter}
          onClick={() => controller.startPhoto()}
          aria-label="AR 한복체험"
        />
        <button
          type="button"
          className={styles.bottomNavZoneRight}
          onClick={() => controller.navigate('restroom', '화장실')}
          aria-label="화장실"
        />
      </div>

      {/* ── Bottom banner (Figma render) ─────────────── */}
      <div className={styles.bottomBanner}>
        {hwaseongIconUrl('fg-banner') && (
          <img
            src={hwaseongIconUrl('fg-banner')}
            alt=""
            className={styles.bottomBannerImg}
            draggable={false}
          />
        )}
      </div>

      {/* Inline search keyboard — shows in place, no navigation */}
      <FloatingKeyboard open={searching} onKey={applyKey} onClose={() => setSearching(false)} lang={lang} lightBackspace />
    </div>
  );
}
