/**
 * 날씨 panel on the 롯데 home — the week outlook, drawn in 제주's panel style (JejuWeatherPanel's
 * frosted panel, 오늘 card, rules, rows and close tab; same CSS module) so the two venues read
 * the same.
 *
 * The data differs: 제주's columns are three places on the island (WeatherForecast.sites, fetched
 * on 제주 kiosks only). 롯데 has one place — the venue itself — so its columns are that place's
 * 오전 · 오후 glyphs and the day's 최저 / 최고, from the kiosk's own `forecast.days`.
 */
import { lotteIconUrl } from '@renderer/assets/icons/lotte';
import { weatherIconName, weatherIconUrl } from '@renderer/assets/weather';
import type { Lang } from '@renderer/lib/i18n';
import { useWeatherStore } from '@renderer/store/weatherStore';
import type { WeatherDayForecast } from '@shared/types/weather';
import styles from '../jeju/JejuWeatherPanel.module.css';

/** Six rows: 오늘 · 내일 · four weekdays — what a 5-day/3-hour outlook straddles. */
const ROWS = 6;
/** Row glyph tops, rule tops and day-label offsets: JejuWeatherPanel's Figma values. */
const ROW_TOPS = [258, 719, 1172, 1700, 2228, 2756] as const;
const RULE_TOPS = [1093, 1580, 2108, 2636] as const;
const LABEL_OFFSETS = [70, 89, 82, 82, 41, 82] as const;
const DATE_BELOW_LABEL = 92;
/** The 기온 column has no glyph: its numbers sit level with the glyphs' middle. */
const TEMPS_ONLY_TOP = 75;

const SOURCE = '※ 출처: OpenWeather';

type Text = Partial<Record<Lang, string>>;
const pick = (map: Text, lang: Lang): string => map[lang] ?? map.en ?? map.ko ?? '';

const CLOSE: Text = {
  ko: '닫기', en: 'Close', ja: '閉じる', zh: '关闭', vi: 'Đóng', th: 'ปิด', ru: 'Закрыть', id: 'Tutup',
};
const PANEL: Text = {
  ko: '날씨 예보', en: 'Weather forecast', ja: '天気予報', zh: '天气预报',
  vi: 'Dự báo thời tiết', th: 'พยากรณ์อากาศ', ru: 'Прогноз погоды', id: 'Prakiraan cuaca',
};
const HEADS: readonly Text[] = [
  { ko: '오전', en: 'AM', ja: '午前', zh: '上午', vi: 'Sáng', th: 'เช้า', ru: 'Утро', id: 'Pagi' },
  { ko: '오후', en: 'PM', ja: '午後', zh: '下午', vi: 'Chiều', th: 'บ่าย', ru: 'День', id: 'Siang' },
  { ko: '최저/최고', en: 'Low/High', ja: '最低/最高', zh: '最低/最高', vi: 'Thấp/Cao', th: 'ต่ำ/สูง', ru: 'Мин/Макс', id: 'Min/Maks' },
];
const TODAY: Text = { ko: '오늘', en: 'Today', ja: '今日', zh: '今天', vi: 'Hôm nay', th: 'วันนี้', ru: 'Сегодня', id: 'Hari ini' };
const TOMORROW: Text = { ko: '내일', en: 'Tmr', ja: '明日', zh: '明天', vi: 'Mai', th: 'พรุ่งนี้', ru: 'Завтра', id: 'Besok' };
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
const COLUMNS = [styles.col1, styles.col2, styles.col3] as const;

const pad2 = (n: number): string => String(n).padStart(2, '0');

function dayLabel(date: Date, offset: number, lang: Lang): string {
  if (offset === 0) return pick(TODAY, lang);
  if (offset === 1) return pick(TOMORROW, lang);
  return (WEEKDAYS[lang] ?? WEEKDAYS.ko ?? [])[date.getDay()] ?? '';
}

function Glyph({ icon, main }: { icon: string; main: string }): JSX.Element | null {
  if (!icon && !main) return null;
  const src = weatherIconUrl(weatherIconName(icon, main));
  return src ? <img src={src} alt="" className={styles.glyph} draggable={false} /> : null;
}

export function LotteWeatherPanel({ lang, onClose }: { lang: Lang; onClose: () => void }): JSX.Element {
  const forecast = useWeatherStore((s) => s.forecast);
  const byDate = new Map<string, WeatherDayForecast>((forecast?.days ?? []).map((d) => [d.date, d]));
  const now = new Date();
  // Dates from the clock, not the payload: a stale cached outlook never draws yesterday as 오늘.
  const rows = Array.from({ length: ROWS }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    return { key, label: dayLabel(date, offset, lang), date: `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`, day: byDate.get(key) ?? null };
  });
  const closeIcon = lotteIconUrl('ico-close-weather'); // 제주's glyph in 롯데 red

  return (
    <div className={styles.layer}>
      <button type="button" className={styles.dismiss} onClick={onClose} aria-label={pick(CLOSE, lang)} />
      <div className={styles.tab}>
        <button type="button" className={styles.close} onClick={onClose} aria-label={pick(CLOSE, lang)} data-pad-dismiss>
          {closeIcon && <img src={closeIcon} alt="" className={styles.closeIcon} draggable={false} />}
        </button>
      </div>

      <div className={styles.panel} role="dialog" aria-label={pick(PANEL, lang)}>
        <div className={styles.todayCard} />
        {HEADS.map((head, i) => (
          <span key={i} className={`${styles.head} ${COLUMNS[i]}`}>
            {pick(head, lang)}
          </span>
        ))}
        {RULE_TOPS.map((top) => (
          <div key={top} className={styles.rule} style={{ top }} />
        ))}

        {rows.map((row, i) => (
          <div key={row.key} className={styles.row} style={{ top: ROW_TOPS[i] }}>
            <span className={i < 2 ? `${styles.day} ${styles.dayRelative}` : styles.day} style={{ top: LABEL_OFFSETS[i] }}>
              {row.label}
            </span>
            <span className={styles.date} style={{ top: (LABEL_OFFSETS[i] ?? 82) + DATE_BELOW_LABEL }}>
              {row.date}
            </span>
            <span className={`${styles.cell} ${styles.col1}`}>
              <span className={styles.glyphSlot}>
                {row.day && <Glyph icon={row.day.morningIcon} main={row.day.morningMain} />}
              </span>
            </span>
            <span className={`${styles.cell} ${styles.col2}`}>
              <span className={styles.glyphSlot}>
                {row.day && <Glyph icon={row.day.afternoonIcon} main={row.day.afternoonMain} />}
              </span>
            </span>
            <span className={`${styles.cell} ${styles.col3}`}>
              <span className={styles.temps} style={{ top: TEMPS_ONLY_TOP }}>
                <span className={styles.min}>{row.day ? `${row.day.minC}˚` : '--˚'}</span>
                <span className={styles.slash}>/</span>
                <span className={styles.max}>{row.day ? `${row.day.maxC}˚` : '--˚'}</span>
              </span>
            </span>
          </div>
        ))}

        <p className={styles.source}>{SOURCE}</p>
      </div>
    </div>
  );
}
