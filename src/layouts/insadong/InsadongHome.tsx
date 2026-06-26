import { useEffect, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import type { KioskScreenId, SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { trackEvent } from '@renderer/lib/analytics';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { weatherIconName, weatherIconUrl } from '@renderer/assets/weather';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { t } from '@renderer/lib/loc';
import { FloatingKeyboard } from './keyboard/FloatingKeyboard';
import { HangulComposer } from './keyboard/hangul';
import type { KeyAction } from './keyboard/VirtualKeyboard';
import styles from './InsadongHome.module.css';

interface HomeTile {
  screen: KioskScreenId;
  label: string;
  icon: string;
  wide?: boolean;
}

/**
 * The AI tile is always first; the 2nd tile is location-specific (인사랑(준비중)
 * for W001/W002, 위드마켓 for W003 — see getKioskLocation). The rest are shared.
 */
const AI_TILE: HomeTile = { screen: 'ai_search', label: "'인사' 모하지 (AI검색)", icon: 'ai-search', wide: true };
const REST_TILES: HomeTile[] = [
  { screen: 'events', label: '인사동 이벤트', icon: 'events' },
  { screen: 'eat', label: "'인사' 뭐먹지", icon: 'eat' },
  { screen: 'shop', label: "'인사' 뭐사지", icon: 'shop' },
  { screen: 'museum', label: '인사동미술관', icon: 'museum' },
  { screen: 'taxfree', label: 'TAX-FREE', icon: 'taxfree' },
  { screen: 'about', label: '여기는 인사동', icon: 'about' },
  { screen: 'hello', label: "안녕 '인사'", icon: 'hello' },
  { screen: 'help', label: "도와줘 '인사'", icon: 'help' },
  { screen: 'map', label: '인사동지도', icon: 'map' },
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
};

type Lang = SupportedLanguage;
type Run = { t: string; b?: boolean };
function pick<T>(map: Partial<Record<Lang, T>>, lang: Lang): T {
  return (map[lang] ?? map.ko ?? (Object.values(map)[0] as T)) as T;
}

/**
 * Parse the sheet-driven `NoticeContent` string into lines of normal/bold runs.
 * Convention (from Localization_Insa): `\n` = line break, `<b>…</b>` = bold.
 * Bold may span a line break, so tokenize across the whole string rather than
 * splitting by line first.
 */
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

/** K-DRAMA promo button label. Hardcoded because the sheet key
 *  (MainButton_Promotion) has no en/ja/zh values yet. */
const KDRAMA_LABEL: Partial<Record<Lang, string>> = {
  ko: '취사병 전설이 되다',
  en: 'Cook Soldier: Legend',
  ja: '炊事兵、伝説になる',
  zh: '炊事兵成为传说',
};

/** Search field placeholder per language. */
const SEARCH_PLACEHOLDER: Partial<Record<Lang, string>> = {
  ko: '인사동에 대해 검색해보세요!',
  en: 'Search about Insadong!',
  ja: '仁寺洞について検索してみましょう！',
  zh: '搜索关于仁寺洞的内容！',
};

/** Language-selector button label per language. */
const LANG_CODE: Partial<Record<Lang, string>> = {
  ko: 'KR', en: 'EN', ja: 'JA', vi: 'VI', zh: 'ZH',
};
const langCode = (lang: Lang): string => LANG_CODE[lang] ?? lang.toUpperCase();

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}(${WEEKDAYS[d.getDay()]})`;
}

/** A real grid tile: exported Figma illustration (or fallback) + real label. */
function Tile({
  tile,
  label,
  onClick,
  disabled,
}: {
  tile: HomeTile;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}): JSX.Element {
  const url = iconUrl(tile.icon);
  return (
    <button
      type="button"
      className={tile.wide ? `${styles.tile} ${styles.tileWide}` : styles.tile}
      aria-disabled={disabled || undefined}
      onClick={disabled ? (e) => e.preventDefault() : onClick}
    >
      <span className={styles.tileArt}>
        {url ? <img src={url} alt="" draggable={false} /> : <span className={styles.tileFallback}>{label}</span>}
      </span>
      <span className={styles.tileLabel}>{label}</span>
    </button>
  );
}

interface InsadongHomeProps {
  controller: KioskController;
  debug?: boolean;
}

/** Insadong home screen — real components + real Figma assets + exact colours. */
export function InsadongHome({ controller }: InsadongHomeProps): JSX.Element {
  const { navigate, startPhoto, kioskId } = controller;
  const weather = useWeatherStore((s) => s.weather);
  const lang = useLanguageStore((s) => s.currentLanguage);

  // Sheet-driven (Localization_Insa): NoticeContent = body, Notice = vertical badge.
  const noticeLines = parseNotice(t('NoticeContent', lang));
  const badge = t('Notice', lang).split('\n').map((s) => s.trim()).filter(Boolean);
  const placeholder = pick(SEARCH_PLACEHOLDER, lang);

  // The 2nd home tile is location-specific (인사랑(준비중) vs 위드마켓).
  const tiles: HomeTile[] = [AI_TILE, getKioskLocation(kioskId).secondTile, ...REST_TILES];

  const setSearchQuery = useSearchStore((s) => s.setQuery);
  const composer = useRef(new HangulComposer());
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [now, setNow] = useState(() => new Date());
  // Bottom promo banner rotates every 30 minutes, synced across all screens.
  const banner = useRotatingBanner();

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

  const weatherSrc = weather ? weatherIconUrl(weatherIconName(weather.icon, weather.main)) : undefined;
  const cameraSrc = iconUrl('camera');
  const bottomBarSrc = iconUrl('bottom-bar');

  return (
    <>
      {iconUrl('bg') && <img className={styles.bgImage} src={iconUrl('bg')} alt="" draggable={false} />}
      <div className={styles.home}>
        <div className={styles.topBlock}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <MapPin className={styles.pin} strokeWidth={2.4} />
            <span>INSADONG</span>
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
            onClick={() => void window.api.kiosk.advanceVideo()}
            aria-label="다음 영상"
          >
            {weatherSrc && <img className={styles.weatherGlyph} src={weatherSrc} alt="" draggable={false} />}
            <span className={styles.temp}>{weather ? `${weather.tempC}°` : '—'}</span>
          </button>
        </div>
        </div>

        <div className={styles.content}>
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
            <Search className={styles.searchIcon} strokeWidth={2.4} />
          </button>
          <button type="button" className={styles.krBtn} onClick={() => navigate('language', '언어선택')}>
            {langCode(lang)}
          </button>
        </div>


        <div className={styles.grid}>
          {tiles.map((tile) => {
            const key = TILE_LABEL_KEYS[tile.screen];
            const label = key ? t(key, lang) : tile.label;
            // 인사랑(준비중) is not ready yet — looks normal, does nothing on tap.
            const comingSoon = tile.screen === 'insarang';
            return (
              <Tile
                key={tile.screen}
                tile={tile}
                label={label}
                disabled={comingSoon}
                onClick={() => navigate(tile.screen, tile.label)}
              />
            );
          })}
        </div>
        </div>

        <div className={styles.bottomRow}>
          {bottomBarSrc && <img className={styles.bottomBarBg} src={bottomBarSrc} alt="" draggable={false} />}
          <button type="button" className={styles.kdramaItem} onClick={() => navigate('kdrama', 'K-DRAMA')}>
            <span className={styles.kdramaIcon}>{iconUrl('kdrama') && <img src={iconUrl('kdrama')} alt="" draggable={false} />}</span>
            <span className={styles.navLabel}>{pick(KDRAMA_LABEL, lang)}</span>
          </button>
          <button type="button" className={styles.cameraBtn} onClick={startPhoto} aria-label="AI 한복 촬영">
            {cameraSrc && <img src={cameraSrc} alt="" draggable={false} />}
          </button>
          <button type="button" className={styles.restroomItem} onClick={() => navigate('restroom', '화장실')}>
            <span className={styles.navIcon}>{iconUrl('restroom') && <img src={iconUrl('restroom')} alt="" draggable={false} />}</span>
            <span className={styles.navLabel}>{t('MainButton_WC', lang)}</span>
          </button>
        </div>

        {banner && (
          <button type="button" className={styles.banner} onClick={startPhoto} aria-label="가상 한복 체험">
            <img src={banner} className={styles.bannerImg} alt="" draggable={false} />
          </button>
        )}
      </div>

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={() => navigate('home', 'Home')} aria-label="홈으로">
          {iconUrl('home-btn') && <img src={iconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={() => navigate('home', 'Back')} aria-label="뒤로">
          {iconUrl('back-arrow') && <img src={iconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>

      <FloatingKeyboard open={focused} onKey={applyKey} onClose={() => setFocused(false)} lang={lang} />
    </>
  );
}
