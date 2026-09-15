/**
 * 날씨 — the overlay the home weather card opens, shared by the Insadong,
 * 오색시장 and 화성휴게소 kiosks. The same panel as 제주's (JejuWeatherPanel,
 * Figma 6516:74521, 2026-09-14 redraw): a frosted 2000-wide panel over the home
 * screen with its close button in a tab rising from the top-right corner, 오늘
 * on its own lighter card, six day rows, three PLACE columns — each place with
 * its own glyph and its own low/high per day — and a "※ 출처" line at the foot.
 *
 * The columns come from the kiosk's own site list (weatherSites.ts), fed by
 * `WeatherForecast.sites`, which WeatherService fetches for these layouts. A
 * column whose site has not answered draws blank rather than borrowing the
 * kiosk's own `forecast.days`.
 */
import type { WeatherForecast, WeatherSiteDay } from '@shared/types/weather';
import { INSADONG_WEATHER_SITES, type WeatherSite } from '@shared/config/weatherSites';
import { weatherIconUrl, weatherIconName } from '@renderer/assets/weather';
import type { Lang } from '@renderer/lib/i18n';
import styles from './InsadongWeatherPanel.module.css';

type Labels = Partial<Record<Lang, string>>;

interface Props {
  forecast: WeatherForecast | null;
  lang: Lang;
  onClose: () => void;
  /** The three place columns, left to right. Defaults to Insadong's. */
  sites?: readonly WeatherSite<string>[];
  /** The dialog's accessible name. */
  ariaLabel?: string;
}

const CLOSE_LABEL: Labels = {
  ko: '닫기', en: 'Close', ja: '閉じる', zh: '关闭',
  vi: 'Đóng', th: 'ปิด', ru: 'Закрыть', id: 'Tutup',
};

/** Six rows — WeatherService's FORECAST_DAYS. */
const ROWS = 6;
/** Row glyph tops, panel-relative (the 제주 panel's 2026-09-14 bands). */
const ROW_TOPS = [258, 719, 1172, 1700, 2228, 2756] as const;
/** Rules between rows 2/3 … 5/6 — the 오늘 card separates the first two. */
const RULE_TOPS = [1093, 1580, 2108, 2636] as const;

/**
 * The foot line. The forecast comes from OpenWeather (WeatherService calls
 * api.openweathermap.org), so that is the source named — the same line 제주's
 * panel draws. One form in every language: it names a data provider.
 */
const SOURCE = '※ 출처: OpenWeather';

/** Column heads by site id — no Localization rows for this panel yet. */
const SITE_LABELS: Record<string, Labels> = {
  'jongno-gu': {
    ko: '종로구', en: 'Jongno-gu', ja: '鍾路区', zh: '钟路区',
    vi: 'Jongno-gu', th: 'จงโนกู', ru: 'Чонно-гу', id: 'Jongno-gu',
  },
  'jung-gu': {
    ko: '중구', en: 'Jung-gu', ja: '中区', zh: '中区',
    vi: 'Jung-gu', th: 'จุงกู', ru: 'Чун-гу', id: 'Jung-gu',
  },
  'gangnam-gu': {
    ko: '강남구', en: 'Gangnam-gu', ja: '江南区', zh: '江南区',
    vi: 'Gangnam-gu', th: 'คังนัมกู', ru: 'Каннам-гу', id: 'Gangnam-gu',
  },
  'osan-si': {
    ko: '오산시', en: 'Osan', ja: '烏山市', zh: '乌山市',
    vi: 'Osan', th: 'โอซาน', ru: 'Осан', id: 'Osan',
  },
  'hwaseong-si': {
    ko: '화성시', en: 'Hwaseong', ja: '華城市', zh: '华城市',
    vi: 'Hwaseong', th: 'ฮวาซอง', ru: 'Хвасон', id: 'Hwaseong',
  },
  'pyeongtaek-si': {
    ko: '평택시', en: 'Pyeongtaek', ja: '平沢市', zh: '平泽市',
    vi: 'Pyeongtaek', th: 'พย็องแท็ก', ru: 'Пхёнтхэк', id: 'Pyeongtaek',
  },
  'suwon-si': {
    ko: '수원시', en: 'Suwon', ja: '水原市', zh: '水原市',
    vi: 'Suwon', th: 'ซูวอน', ru: 'Сувон', id: 'Suwon',
  },
};

const RELATIVE_DAYS: Record<'today' | 'tomorrow', Labels> = {
  today: { ko: '오늘', en: 'Today', ja: '今日', zh: '今天', vi: 'Hôm nay', th: 'วันนี้', ru: 'Сегодня', id: 'Hari ini' },
  tomorrow: { ko: '내일', en: 'Tmr', ja: '明日', zh: '明天', vi: 'Mai', th: 'พรุ่งนี้', ru: 'Завтра', id: 'Besok' },
};

/** Sunday-first, matching `Date.getDay()`. */
const WEEKDAYS: Partial<Record<Lang, readonly string[]>> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ja: ['日', '月', '火', '水', '木', '金', '土'],
  zh: ['日', '一', '二', '三', '四', '五', '六'],
  vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  th: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  id: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
};

/** Column axes, left to right — the frame draws exactly three places. */
const COLUMNS = [styles.col1, styles.col2, styles.col3];

const pick = (map: Labels | undefined, lang: Lang): string => map?.[lang] ?? map?.ko ?? '';
const pad2 = (n: number): string => String(n).padStart(2, '0');

function dayLabel(date: Date, offset: number, lang: Lang): string {
  if (offset === 0) return pick(RELATIVE_DAYS.today, lang);
  if (offset === 1) return pick(RELATIVE_DAYS.tomorrow, lang);
  return (WEEKDAYS[lang] ?? WEEKDAYS.ko ?? [])[date.getDay()] ?? '';
}

interface Cell {
  id: string;
  day: WeatherSiteDay | null;
}

interface Row {
  key: string;
  label: string;
  date: string;
  cells: Cell[];
}

/**
 * Six rows from today, dated by the clock rather than the payload — a cached
 * outlook that went stale overnight leaves its past days unmatched, and a cell
 * with nothing for its date draws no glyph and dashes.
 */
function buildRows(forecast: WeatherForecast | null, lang: Lang, sites: readonly WeatherSite<string>[]): Row[] {
  const bySite = sites.map((site) => ({
    id: site.id,
    days: new Map(
      (forecast?.sites?.find((s) => s.id === site.id)?.days ?? []).map((day) => [day.date, day]),
    ),
  }));
  const now = new Date();
  return Array.from({ length: ROWS }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    return {
      key,
      label: dayLabel(date, offset, lang),
      date: `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`,
      cells: bySite.map((site) => ({ id: site.id, day: site.days.get(key) ?? null })),
    };
  });
}

function Glyph({ day }: { day: WeatherSiteDay | null }): JSX.Element | null {
  if (!day || (!day.icon && !day.main)) return null;
  const src = weatherIconUrl(weatherIconName(day.icon, day.main));
  if (!src) return null;
  return <img src={src} alt="" className={styles.glyph} draggable={false} />;
}

export function InsadongWeatherPanel({
  forecast,
  lang,
  onClose,
  sites = INSADONG_WEATHER_SITES,
  ariaLabel = '날씨',
}: Props): JSX.Element {
  const columns = sites.slice(0, COLUMNS.length);
  const rows = buildRows(forecast, lang, columns);

  return (
    <div className={styles.layer}>
      {/* Invisible dismiss target BEHIND the panel — tapping the bare screen
          around it is still a way out; the close button is the visible one. */}
      <button type="button" className={styles.dismiss} onClick={onClose} aria-label={pick(CLOSE_LABEL, lang)} />

      {/* The tab rising from the panel's top-right corner, holding the close button. */}
      <div className={styles.tab}>
        <button type="button" className={styles.close} onClick={onClose} aria-label={pick(CLOSE_LABEL, lang)}>
          <svg className={styles.closeIcon} viewBox="0 0 117 117" aria-hidden="true">
            <circle cx="58.5" cy="58.5" r="58.5" fill="#ffffff" />
            <path d="M40 40L77 77M77 40L40 77" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className={styles.panel} role="dialog" aria-label={ariaLabel}>
        <div className={styles.todayCard} />

        {columns.map((site, i) => (
          <span key={site.id} className={`${styles.head} ${COLUMNS[i]}`}>
            {pick(SITE_LABELS[site.id], lang) || site.name}
          </span>
        ))}

        {RULE_TOPS.map((top) => (
          <div key={top} className={styles.rule} style={{ top }} />
        ))}

        {rows.map((row, i) => (
          <div key={row.key} className={styles.row} style={{ top: ROW_TOPS[i] }}>
            <span className={styles.day}>{row.label}</span>
            <span className={styles.date}>{row.date}</span>

            {row.cells.map(({ id, day }, c) => (
              <span key={id} className={`${styles.cell} ${COLUMNS[c]}`}>
                <span className={styles.glyphSlot}>
                  <Glyph day={day} />
                </span>
                <span className={styles.temps}>
                  <span className={styles.min}>{day ? `${day.minC}˚` : '--˚'}</span>
                  <span className={styles.slash}>/</span>
                  <span className={styles.max}>{day ? `${day.maxC}˚` : '--˚'}</span>
                </span>
              </span>
            ))}
          </div>
        ))}

        <p className={styles.source}>{SOURCE}</p>
      </div>
    </div>
  );
}
