/**
 * 제주 날씨 — Figma node 6516:74521 (제주>홈), the overlay the home weather card
 * opens. Six rows of 오늘 · 내일 · the next four weekdays, each with a morning and
 * an afternoon glyph and the day's 최저 / 최고.
 *
 * Every position/size in JejuWeatherPanel.module.css is the exact Figma value,
 * measured against the isolated render of node 6516:74520 (the group holding the
 * frosted panel, the 오늘 card, the four rules and the six rows).
 *
 * The data is OpenWeatherMap's 5-day/3-hour outlook, folded into per-day buckets
 * in WeatherService — see `WeatherForecast`. It reaches here through
 * `useWeatherSync` like the current snapshot does; nothing is fetched in the
 * renderer.
 */
import type {
  WeatherDayForecast,
  WeatherForecast,
  WeatherSnapshot,
} from '@shared/types/weather';
import { weatherIconUrl, weatherIconName } from '@renderer/assets/weather';
import type { Lang } from '@renderer/lib/i18n';
import styles from './JejuWeatherPanel.module.css';

interface Props {
  forecast: WeatherForecast | null;
  /** Live conditions, the fallback for 오늘 once the 3-hour list runs out. */
  current: WeatherSnapshot | null;
  lang: Lang;
  onClose: () => void;
}

/** Rows the frame draws. The panel height is authored for exactly six. */
const ROWS = 6;

/* Row geometry, panel-relative. The frame repeats one 357-tall row every 461px
   from y178; the rules are taken literally from their own nodes rather than
   derived from that step (Figma has them a few px off it). */
const ROW_TOP = 178;
const ROW_STEP = 461;
const RULE_TOPS = [1054, 1515, 1979, 2443] as const;

/**
 * Column headers and the two relative day names. There are no Localization_Jeju
 * keys for this frame yet, so the strings live here the way JejuFlightBoard's
 * column heads do — swap to `t()` once the sheet grows the rows.
 */
const HEADS: Record<'morning' | 'afternoon' | 'range', Partial<Record<Lang, string>>> = {
  morning: {
    ko: '오전', en: 'AM', ja: '午前', zh: '上午',
    vi: 'Sáng', th: 'เช้า', ru: 'Утро', id: 'Pagi',
  },
  afternoon: {
    ko: '오후', en: 'PM', ja: '午後', zh: '下午',
    vi: 'Chiều', th: 'บ่าย', ru: 'День', id: 'Siang',
  },
  range: {
    ko: '최저 / 최고', en: 'Low / High', ja: '最低 / 最高', zh: '最低 / 最高',
    vi: 'Thấp / Cao', th: 'ต่ำ / สูง', ru: 'Мин / Макс', id: 'Min / Maks',
  },
};

const RELATIVE_DAYS: Record<'today' | 'tomorrow', Partial<Record<Lang, string>>> = {
  today: {
    ko: '오늘', en: 'Today', ja: '今日', zh: '今天',
    vi: 'Hôm nay', th: 'วันนี้', ru: 'Сегодня', id: 'Hari ini',
  },
  tomorrow: {
    ko: '내일', en: 'Tom.', ja: '明日', zh: '明天',
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

/** `YYYY-MM-DD` → a local-midnight Date. Built from parts, so never UTC-shifted. */
function parseDate(date: string): Date | null {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Whole days from today to `date`, in local time. Negative once the row is past. */
function daysFromToday(date: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

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

/** One half-day's glyph inputs, or null when nothing covers that half. */
interface Slot {
  icon: string;
  main: string;
}

interface Row {
  key: string;
  label: string;
  date: string;
  morning: Slot | null;
  afternoon: Slot | null;
  minC: number | null;
  maxC: number | null;
}

/**
 * Six rows starting at today, whether or not the outlook reaches that far.
 *
 * The dates come from the clock rather than from the payload so a cached outlook
 * that went stale overnight still labels its rows honestly — days that have
 * already passed drop out and the tail fills with date-only placeholders instead
 * of drawing yesterday under 오늘.
 *
 * Two tails the 5-day/3-hour endpoint cannot fill, both narrow and both handled
 * here rather than left as a blank row:
 *
 *  - Late evening, when the list holds nothing further for today: 오늘 borrows
 *    its glyphs from the live snapshot. The day's 최저/최고 stay blank — the
 *    current reading is not a range and must not be drawn as one.
 *  - Just after midnight, when the 120-hour window only spans five dates: the
 *    sixth row has no data at all and shows as a date alone. The window slides
 *    off that state within a few hours, and the kiosks reboot at 02:00 anyway.
 */
function buildRows(
  forecast: WeatherForecast | null,
  current: WeatherSnapshot | null,
  lang: Lang,
): Row[] {
  const byOffset = new Map<number, WeatherDayForecast>();
  for (const day of forecast?.days ?? []) {
    const parsed = parseDate(day.date);
    if (!parsed) continue;
    const offset = daysFromToday(parsed);
    if (offset >= 0 && offset < ROWS) byOffset.set(offset, day);
  }

  const live: Slot | null = current ? { icon: current.icon, main: current.main } : null;
  const now = new Date();

  return Array.from({ length: ROWS }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const day = byOffset.get(offset) ?? null;
    const fallback = offset === 0 ? live : null;
    return {
      key: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
      label: dayLabel(date, offset, lang),
      date: shortDate(date),
      morning: day ? { icon: day.morningIcon, main: day.morningMain } : fallback,
      afternoon: day ? { icon: day.afternoonIcon, main: day.afternoonMain } : fallback,
      minC: day ? day.minC : null,
      maxC: day ? day.maxC : null,
    };
  });
}

function Glyph({ slot }: { slot: Slot | null }): JSX.Element | null {
  // Nothing covers this half-day (no outlook cached at all) — the frame has no
  // empty state, so the slot simply stays blank rather than guessing 맑음.
  if (!slot || (!slot.icon && !slot.main)) return null;
  const src = weatherIconUrl(weatherIconName(slot.icon, slot.main));
  if (!src) return null;
  return <img src={src} alt="" className={styles.glyph} draggable={false} />;
}

export function JejuWeatherPanel({ forecast, current, lang, onClose }: Props): JSX.Element {
  const rows = buildRows(forecast, current, lang);

  return (
    <div className={styles.layer}>
      {/* The frame draws no scrim and no close control: the panel simply sits
          over the home screen, with the top bar, the left nav and the bottom
          action row still showing around it. Tapping any of that bare screen is
          the way back, so the dismiss target is invisible and sits BEHIND the
          panel — taps on the panel itself never reach it. */}
      <button type="button" className={styles.dismiss} onClick={onClose} aria-label="닫기" />

      <div className={styles.panel} role="dialog" aria-label="제주 날씨">
        {/* 오늘 sits on its own lighter card; the column heads live inside it. */}
        <div className={styles.todayCard} />

        <span className={`${styles.head} ${styles.headMorning}`}>{pick(HEADS.morning, lang)}</span>
        <span className={`${styles.head} ${styles.headAfternoon}`}>
          {pick(HEADS.afternoon, lang)}
        </span>
        <span className={`${styles.head} ${styles.headRange}`}>{pick(HEADS.range, lang)}</span>

        {/* Four rules, between rows 2/3, 3/4, 4/5 and 5/6 — the 오늘 card is what
            separates the first two, so no rule is drawn there. */}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={styles.rule} style={{ top: RULE_TOPS[i] }} />
        ))}

        {rows.map((row, i) => (
          <div key={row.key} className={styles.row} style={{ top: ROW_TOP + i * ROW_STEP }}>
            <span className={styles.day}>{row.label}</span>
            <span className={styles.date}>{row.date}</span>

            <span className={`${styles.glyphSlot} ${styles.glyphMorning}`}>
              <Glyph slot={row.morning} />
            </span>
            <span className={`${styles.glyphSlot} ${styles.glyphAfternoon}`}>
              <Glyph slot={row.afternoon} />
            </span>

            <span className={styles.min}>{row.minC === null ? '--˚' : `${row.minC}˚`}</span>
            <span className={styles.slash}>/</span>
            <span className={styles.max}>{row.maxC === null ? '--˚' : `${row.maxC}˚`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
