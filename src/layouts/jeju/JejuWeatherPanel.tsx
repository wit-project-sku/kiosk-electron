/**
 * 제주 날씨 — Figma node 6516:74521 (제주>홈-날씨), the overlay the home weather
 * card opens. Seven rows of 오늘 · 내일 · the next five weekdays.
 *
 * ── The 2026-09-09 redraw: the columns are PLACES now ──────────────
 * The panel used to draw three columns of ONE place — the kiosk's own — as an
 * 오전 glyph, an 오후 glyph, and the day's 최저 / 최고 off to the right at 100px.
 * The redraw replaces all three with 제주시 · 서귀포시 · 성산: one glyph AND its
 * own low/high per place, per day. So this is a regional outlook for the island
 * rather than a half-day breakdown of where the machine stands, and the three
 * 제주 kiosks (공항 W006 · 여객터미널 W007 · 세계자연유산본부 W008) all show the
 * same three places.
 *
 * ★ That is a DATA change, not only a layout one: the columns are fed by
 * `WeatherForecast.sites`, three separate 5-day/3-hour fetches that
 * WeatherService only makes on a 제주 kiosk (see JEJU_WEATHER_SITES). A column
 * whose site has not answered draws blank rather than borrowing the kiosk's own
 * `forecast.days` — those are the airport's / terminal's / 거문오름's
 * coordinates, which are none of the three places the headers name and up to
 * 25km from the nearest of them. Same reason the live snapshot is no longer
 * accepted as a fallback for 오늘, and is no longer passed in at all.
 *
 * Every position/size in JejuWeatherPanel.module.css is the exact Figma value,
 * measured against node 6873:16213 (frosted panel + 오늘 card + rules + rows)
 * and its sibling row / close nodes on the same frame.
 */
import type { WeatherForecast, WeatherSiteDay } from '@shared/types/weather';
import { JEJU_WEATHER_SITES, type WeatherSiteId } from '@shared/config/weatherSites';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { weatherIconUrl, weatherIconName } from '@renderer/assets/weather';
import type { Lang } from '@renderer/lib/i18n';
import styles from './JejuWeatherPanel.module.css';

interface Props {
  forecast: WeatherForecast | null;
  lang: Lang;
  onClose: () => void;
}

/**
 * The close button's accessible name. Authored here, like SITE_LABELS below,
 * because this frame has no Localization_Jeju rows yet — an unanswered `t()`
 * would show the raw key. It replaces a hardcoded Korean "닫기" that every
 * language saw.
 */
const CLOSE_LABEL: Partial<Record<Lang, string>> = {
  ko: '닫기',
  en: 'Close',
  ja: '閉じる',
  zh: '关闭',
  vi: 'Đóng',
  th: 'ปิด',
  ru: 'Закрыть',
  id: 'Tutup',
};

/**
 * Rows drawn. The panel height is authored for exactly this many — Figma
 * 6873:16213 draws seven (오늘 · 내일 · five weekdays). OpenWeatherMap's
 * 5-day/3-hour outlook only fills six local dates (WeatherService
 * FORECAST_DAYS = 6); the seventh row falls back to a date-only placeholder
 * via {@link buildRows}.
 */
const ROWS = 7;

/*
 * Row bands, panel-relative, taken literally from their own nodes rather than
 * derived from a step: the frame repeats one row every 444px from y687 but
 * places 오늘 — the row that sits inside the 오늘 card — 2px off that grid. Each
 * value is the row's GLYPH top; everything else in the row is offset from it in
 * the CSS.
 */
const ROW_TOPS = [245, 687, 1131, 1575, 2019, 2463, 2907] as const;

/*
 * Between rows 2/3 … 6/7 — the 오늘 card separates the first two, so no rule
 * there. Page y 1351 / 1795 / 2239 / 2683 / 3127, minus the panel origin 295,
 * minus 3 more: Figma's `Line 106` is a zero-height node whose 3px stroke is
 * drawn ABOVE its y (`inset-[-3px_0_0_0]`), so the ink starts three px higher
 * than the node does. Confirmed against the 1:1 render, which puts the first
 * rule's ink at 1052.
 */
const RULE_TOPS = [1053, 1497, 1941, 2385, 2829] as const;

/**
 * Column heads. There are no Localization_Jeju keys for this frame yet, so the
 * strings live here the way JejuFlightBoard's column heads do — swap to `t()`
 * once the sheet grows the rows. Keyed by site id, so a column can never end up
 * labelled with a place it is not showing.
 */
const SITE_LABELS: Record<WeatherSiteId, Partial<Record<Lang, string>>> = {
  'jeju-si': {
    ko: '제주시', en: 'Jeju City', ja: '済州市', zh: '济州市',
    vi: 'TP. Jeju', th: 'เมืองเชจู', ru: 'Чеджу', id: 'Kota Jeju',
  },
  'seogwipo-si': {
    ko: '서귀포시', en: 'Seogwipo', ja: '西帰浦市', zh: '西归浦市',
    vi: 'Seogwipo', th: 'ซอกวีโพ', ru: 'Согвипхо', id: 'Seogwipo',
  },
  seongsan: {
    ko: '성산', en: 'Seongsan', ja: '城山', zh: '城山',
    vi: 'Seongsan', th: 'ซองซัน', ru: 'Сонсан', id: 'Seongsan',
  },
};

const RELATIVE_DAYS: Record<'today' | 'tomorrow', Partial<Record<Lang, string>>> = {
  today: {
    ko: '오늘', en: 'Today', ja: '今日', zh: '今天',
    vi: 'Hôm nay', th: 'วันนี้', ru: 'Сегодня', id: 'Hari ini',
  },
  tomorrow: {
    ko: '내일', en: 'Tmr', ja: '明日', zh: '明天',
    vi: 'Mai', th: 'พรุ่งนี้', ru: 'Завтра', id: 'Besok',
  },
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

const pick = (map: Partial<Record<Lang, string>>, lang: Lang): string => map[lang] ?? map.ko ?? '';

/** 오늘 / 내일 for the first two days, else the weekday letter the frame draws. */
function dayLabel(date: Date, offset: number, lang: Lang): string {
  if (offset === 0) return pick(RELATIVE_DAYS.today, lang);
  if (offset === 1) return pick(RELATIVE_DAYS.tomorrow, lang);
  const names = WEEKDAYS[lang] ?? WEEKDAYS.ko ?? [];
  return names[date.getDay()] ?? '';
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** `08.25`, the frame's date line. */
const shortDate = (date: Date): string => `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;

/** One place's column within one row. `day` is null where nothing covers it. */
interface Cell {
  id: WeatherSiteId;
  day: WeatherSiteDay | null;
}

interface Row {
  key: string;
  label: string;
  date: string;
  /** One per column, in JEJU_WEATHER_SITES order. */
  cells: Cell[];
}

/**
 * Seven rows starting at today, whether or not the outlook reaches that far.
 *
 * The dates come from the clock rather than from the payload, so a cached
 * outlook that went stale overnight still labels its rows honestly — days that
 * have already passed simply do not match any row and the tail fills with
 * date-only placeholders instead of drawing yesterday under 오늘.
 *
 * A cell is null whenever that site has nothing for that date, which covers all
 * of: a kiosk that never fetched sites, a cache row from before they existed, a
 * site whose request failed, and the seventh row that the 120-hour window does
 * not reach. The frame has no empty state, so such a cell draws no glyph and
 * dashes for the temperatures — never a neighbouring site's numbers.
 */
function buildRows(forecast: WeatherForecast | null, lang: Lang): Row[] {
  // date → day, per site, so each column below is a plain lookup.
  const bySite = JEJU_WEATHER_SITES.map((site) => ({
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
      date: shortDate(date),
      cells: bySite.map((site) => ({ id: site.id, day: site.days.get(key) ?? null })),
    };
  });
}

/** The day's glyph for one place, or nothing when that cell is empty. */
function Glyph({ day }: { day: WeatherSiteDay | null }): JSX.Element | null {
  if (!day || (!day.icon && !day.main)) return null;
  const src = weatherIconUrl(weatherIconName(day.icon, day.main));
  if (!src) return null;
  return <img src={src} alt="" className={styles.glyph} draggable={false} />;
}

/**
 * Column x, left to right. Three, because the frame draws three places — a
 * fourth site would need its own axis in the CSS, so the lookup is deliberately
 * a fixed list rather than something derived from JEJU_WEATHER_SITES' length.
 */
const COLUMNS = {
  'jeju-si': styles.col1,
  'seogwipo-si': styles.col2,
  seongsan: styles.col3,
  // `satisfies` rather than an annotation: it still fails the build if a site
  // ever loses its axis, without asserting the CSS module's lookup is defined.
} satisfies Record<WeatherSiteId, string | undefined>;

export function JejuWeatherPanel({ forecast, lang, onClose }: Props): JSX.Element {
  const rows = buildRows(forecast, lang);
  const closeIcon = jejuIconUrl('ico-close');

  return (
    <div className={styles.layer}>
      {/* The frame draws no scrim: the panel simply sits over the home screen,
          with the top bar, the left nav and the bottom action row still showing
          around it. Tapping any of that bare screen is still the way back, so
          the dismiss target is invisible and sits BEHIND the panel — taps on the
          panel itself never reach it, and reach the close button instead. */}
      <button
        type="button"
        className={styles.dismiss}
        onClick={onClose}
        aria-label={pick(CLOSE_LABEL, lang)}
      />

      <div className={styles.panel} role="dialog" aria-label="제주 날씨">
        {/* 오늘 sits on its own lighter card; the column heads live inside it. */}
        <div className={styles.todayCard} />

        {/* 6876:16416 — the visible way out. The bare home screen around the
            panel stays tappable and unchanged; this is what a visitor can
            actually SEE to press. */}
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label={pick(CLOSE_LABEL, lang)}
          data-pad-dismiss
        >
          {closeIcon && (
            <img src={closeIcon} alt="" className={styles.closeIcon} draggable={false} />
          )}
        </button>

        {JEJU_WEATHER_SITES.map((site) => (
          <span key={site.id} className={`${styles.head} ${COLUMNS[site.id]}`}>
            {pick(SITE_LABELS[site.id], lang)}
          </span>
        ))}

        {/* Five rules, between rows 2/3 … 6/7 — the 오늘 card is what separates
            the first two, so no rule is drawn there. */}
        {RULE_TOPS.map((top) => (
          <div key={top} className={styles.rule} style={{ top }} />
        ))}

        {rows.map((row, i) => (
          <div key={row.key} className={styles.row} style={{ top: ROW_TOPS[i] }}>
            <span className={styles.day}>{row.label}</span>
            <span className={styles.date}>{row.date}</span>

            {row.cells.map(({ id, day }) => (
              <span key={id} className={`${styles.cell} ${COLUMNS[id]}`}>
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
      </div>
    </div>
  );
}
