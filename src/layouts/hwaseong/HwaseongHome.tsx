import { useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { KioskScreenId } from '@shared/types/kiosk';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { useWeatherVideo } from '@renderer/hooks/useWeatherVideo';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { weatherIconUrl, weatherIconName } from '@renderer/assets/weather';
import { buttonText, pick } from '@renderer/lib/i18n';
import { useApiTileRows, useHasDonationTile, type TileKey } from '@renderer/lib/buttonLayout';
import { DONATION_COMING_SOON, withComingSoon } from '@shared/config/donation';
import { t } from '@renderer/lib/loc';
import { SearchIcon } from '@layouts/components/SearchIcon';
import { WeatherEffects } from '@layouts/components/weather/WeatherEffects';
import { useWeatherFxPreviewHandlers } from '@layouts/components/weather/useWeatherFxPreviewHandlers';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';

/** Search-bar language button → the current language's display code. */
const LANG_CODE: Record<string, string> = { ko: 'KR', en: 'EN', ja: 'JP', zh: 'CN', vi: 'VN', th: 'TH', ru: 'RU', id: 'ID' };

/** Search placeholder. The notice card + 공/지 badge come from the sheet
 *  (NoticeContent / Notice), like Insadong and Osan. */
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
import { HangulComposer } from '../insadong/keyboard/hangul';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import { HwaseongBanner } from './HwaseongBanner';
import { HwaseongLeftNav } from './HwaseongLeftNav';
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

type NoticeRun = { t: string; b?: boolean };

/** Same as Insadong/Osan: `\n` = line break, `<b>…</b>` = bold. */
function parseNotice(text: string): NoticeRun[][] {
  const lines: NoticeRun[][] = [[]];
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

const ROW3_HEAD: Tile[] = [
  { screen: 'tourism',   label: '화성휴게소',      labelKey: 'MainButton_Here',     icon: 'fg-resthome' },
  { screen: 'hello',     label: "안녕 '휴'",       labelKey: 'MainButton_Greeting', icon: 'fg-hello'    },
  { screen: 'help',      label: "도와줘 '휴'",     labelKey: 'MainButton_ToHelp',   icon: 'fg-help'     },
];

/** Row 3's last tile (grid slot 14) — 기부 on kiosks running the donation app,
 *  화성휴게소 지도 otherwise. Mutually exclusive: the CMS carries a row for exactly
 *  one of them, so rendering both drops the grid to authored order. See
 *  useHasDonationTile. */
const MAP_TILE: Tile = { screen: 'parking', label: '화성휴게소 지도', labelKey: 'MainButton_SAMap', icon: 'fg-map' };
const DONATION_TILE: Tile = { screen: 'donation', label: '기부', labelKey: 'MainButton_Donation', icon: 'fg-donation' };

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

/** Row 3 with its slot-14 tile resolved (기부 vs 지도). 기부 is inert while
 *  soft-launching (준비중) — same as the other disabled tiles. */
function row3For(hasDonation: boolean): HomeTile[] {
  const slot14: HomeTile = hasDonation
    ? { ...DONATION_TILE, disabled: DONATION_COMING_SOON }
    : MAP_TILE;
  return [...ROW3_HEAD, slot14];
}

/** Flat tile list in authored order — reordered to the CMS layout by useApiTileRows.
 *  ROW1_WIDE is the 2-column traffic card (wide flag is local: the API span is null). */
function allTilesFor(hasDonation: boolean): HomeTile[] {
  return [{ ...ROW1_WIDE, wide: true }, ...ROW1, ...ROW2, ...row3For(hasDonation), ...ROW4];
}

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
  const playWeatherVideo = useWeatherVideo();
  const weatherFx = useWeatherFxPreviewHandlers(playWeatherVideo);
  const today = useMemo(() => formatDate(new Date()), []);
  const lang = useLanguageStore((s) => s.currentLanguage);
  // Sheet-driven (Localization_Hwaseong): NoticeContent = body, Notice = vertical badge.
  const noticeLines = parseNotice(t('NoticeContent', lang));
  const noticeBadge = t('Notice', lang)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const setStoreQuery = useSearchStore((s) => s.setQuery);
  // Tile label: curated override (proper ja/zh) → sheet value. Active tiles
  // strip a stale "(준비중)" suffix (e.g. a cached 전국시장(준비중)); only the
  // genuinely-disabled tiles keep their 준비중 marker.
  const L = (key: string): string => buttonText(key, lang) ?? t(key, lang);
  const TILE = (key: string, keepPending = false): string =>
    keepPending ? L(key) : L(key).replace(/\s*\(준비중\)\s*/g, '').trim();
  // 기부 resolves through labelKey like every other tile (MainButton_Donation now
  // carries all 8 languages in every location's sheet); the localized "(준비중)"
  // suffix is appended while soft-launching.
  // TAX-FREE stays the hardcoded brand string in every language — same as Osan,
  // which omits MainButton_TaxFree from TILE_LABEL_KEYS and uses tile.label.
  const tileLabel = (tile: HomeTile): string => {
    if (tile.screen === 'taxfree') return 'TAX-FREE';
    const base = TILE(tile.labelKey, tile.disabled);
    if (tile.screen !== 'donation') return base;
    return DONATION_COMING_SOON ? withComingSoon(base, lang) : base;
  };

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

  // Slot 14 is 기부 or 화성휴게소 지도 depending on whether this kiosk runs the
  // donation app — resolved before ordering so both the CMS and authored paths agree.
  const hasDonation = useHasDonationTile(controller.kioskId);
  const allTiles = useMemo(() => allTilesFor(hasDonation), [hasDonation]);
  const row3 = useMemo(() => row3For(hasDonation), [hasDonation]);

  // CMS-driven menu order (grouped into rows by line, sorted by position). null →
  // keep the authored rows below (offline / partial data / any cell collision).
  const dynamicRows = useApiTileRows(controller.kioskId, allTiles, hwaseongTileKey);

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
            {hwaseongIconUrl('location-pin') && (
              <img
                src={hwaseongIconUrl('location-pin')}
                alt=""
                className={styles.locationIcon}
                draggable={false}
              />
            )}
            <span className={styles.siteName}>HWASEONG SA</span>
          </div>
          <span className={styles.headerDate}>{today}</span>
        </div>

        {/* Row 2: notice + weather */}
        <div className={styles.headerBottomRow}>
          {/* Notice card — layout matches Insadong/Osan so EN INFO + long copy wrap inside. */}
          <div className={styles.notice}>
            <div className={styles.noticeBadge}>
              {noticeBadge.map((ch, i) => (
                <span key={i}>{ch}</span>
              ))}
            </div>
            <div className={styles.noticeDivider} />
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

          {/* Weather card — tap plays today's condition clip on the customer
              display (Weather_Rain/Cold/Sunny), same as the other kiosks. */}
          <div
            className={styles.weatherCard}
            role="button"
            aria-label="오늘 날씨 영상"
            onClick={weatherFx.onClick}
            onPointerDown={weatherFx.onPointerDown}
            onPointerUp={weatherFx.onPointerUp}
            onPointerLeave={weatherFx.onPointerLeave}
            onPointerCancel={weatherFx.onPointerCancel}
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
            <div style={{ width: 180, height: 180, borderRadius: '50%', background: 'var(--kiosk-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
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
            <SearchIcon className={styles.searchIcon} />
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
                      label={tileLabel(tile)}
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
                    <SquareTile key={tile.screen + tile.label} tile={tile} label={tileLabel(tile)} onClick={() => go(tile)} />
                  ))}
                </div>

                {/* Row 3 — its slot-14 tile (기부) can be disabled while 준비중, so
                    pass disabled + keepPending like ROW1/ROW4 do. */}
                <div className={styles.menuRow}>
                  {row3.map((tile) => (
                    <SquareTile key={tile.screen + tile.label} tile={tile} label={tileLabel(tile)} onClick={() => go(tile)} disabled={tile.disabled} />
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

      <WeatherEffects />

      <HwaseongLeftNav onHome={() => controller.navigate('home')} />

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
          aria-label={t('MainButton_WC', lang)}
        >
          {/* Covers the Korean label baked into fg-bottomnav.png so language can switch. */}
          <span className={styles.bottomNavWcLabel}>{t('MainButton_WC', lang)}</span>
        </button>
      </div>

      <HwaseongBanner onClick={() => controller.startPhoto()} />

      {/* Inline search keyboard — shows in place, no navigation */}
      <FloatingKeyboard open={searching} onKey={applyKey} onClose={() => setSearching(false)} lang={lang} />
    </div>
  );
}
