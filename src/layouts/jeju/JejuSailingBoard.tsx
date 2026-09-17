/**
 * 제주국제여객터미널 (W007) home 운항 정보 board.
 *
 * Counterpart to JejuFlightBoard: one lead departure row with the six sailing
 * columns (출발시각 · 소요시간 · 선박명 · 항로 · 출발장소 · 현황).
 *
 * The board carries no 국제항 ㅣ 연안항 filter — the lead row is simply the next
 * sailing from either terminal, and the berth split belongs to the 운항정보 page
 * (JejuCruise), which still has that sub-tab. Both the panel itself and 더보기
 * open that page.
 */
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { CRUISE_TITLE } from './JejuCruise';
import {
  displaySailingTime,
  hasTimeChange,
  sailingStatusColor,
  sailingStatusLabel,
  useJejuDepartureSailings,
} from '@renderer/lib/jejuSailing';
import type { JejuSailing } from '@renderer/lib/jejuSailing';
import { sailingPlaceLabel, sailingRouteLabel, sailingShipLabel } from '@renderer/lib/jejuSailingPlaces';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useSailingStore } from '@renderer/store/sailingStore';
import styles from './JejuSailingBoard.module.css';

const opText = (key: string, lang: Lang, fallback: Partial<Record<Lang, string>>): string =>
  sheetText(key, lang, fallback);

interface Props {
  controller: KioskController;
  lang: Lang;
}

/** Fallback — sheet `CruiseSchedule` (여객터미널). */
const TITLE = {
  ko: '운항 정보', en: 'Operation information', ja: '運航情報', zh: '航运信息',
  vi: 'Chuyến tàu', th: 'ข้อมูลเรือ', ru: 'Рейсы', id: 'Pelayaran',
};

/** Fallback — sheet `Schedule_More_Cruise`. */
const MORE = {
  ko: '운항 정보 더보기', en: 'More Operation information', ja: '運行情報の詳細', zh: '更多运营信息',
  vi: 'Thêm thông tin vận hành', th: 'ข้อมูลการดำเนินงานเพิ่มเติม', ru: 'Дополнительная информация об операции',
  id: 'Lihat lebih banyak informasi pelayaran',
};

/** Korean column centres — original layout. */
const COLUMNS_KO = {
  time: 412,
  duration: 590,
  ship: 840,
  route: 1190,
  place: 1500,
  status: 1718,
} as const;

/** Non-Korean — nudged left toward the Korean band now that the title wraps. */
const COLUMNS_EN = {
  time: 450,
  duration: 640,
  ship: 930,
  route: 1260,
  place: 1490,
  status: 1710,
} as const;

type ColumnKey = keyof typeof COLUMNS_KO;
type Columns = { readonly [K in ColumnKey]: number };

const columnsFor = (lang: Lang): Columns => (lang === 'ko' ? COLUMNS_KO : COLUMNS_EN);

/**
 * Wrap widths on those axes — see JejuFlightBoard's HEAD_MAX / VALUE_MAX. One
 * set per column layout, because the English axes sit differently.
 *
 * Heads: the distance to the nearer neighbouring axis (the rule's edge for the
 * outer two). Values: only the TEXT columns wrap — the time and the `HH:mm`
 * duration never do — each within what its neighbours leave it, so two long
 * cells cannot overlap. 현황's width also bounds the 결항 note under it.
 */
type ValueKey = 'ship' | 'route' | 'place' | 'status';
interface WrapWidths {
  head: Record<ColumnKey, number>;
  value: Record<ValueKey, number>;
}
const WRAP_KO: WrapWidths = {
  head: { time: 168, duration: 178, ship: 250, route: 310, place: 218, status: 218 },
  value: { ship: 380, route: 300, place: 230, status: 220 },
};
const WRAP_EN: WrapWidths = {
  head: { time: 190, duration: 190, ship: 290, route: 230, place: 220, status: 164 },
  value: { ship: 340, route: 280, place: 180, status: 220 },
};
const wrapFor = (lang: Lang): WrapWidths => (lang === 'ko' ? WRAP_KO : WRAP_EN);

const HEAD_KEYS: Record<ColumnKey, string> = {
  time: 'OP_Schedule_Info_col1',
  duration: 'OP_Schedule_Info_col8',
  ship: 'OP_Schedule_Info_col9',
  route: 'OP_Schedule_Info_col10',
  place: 'OP_Schedule_Info_col11',
  status: 'OP_Schedule_Info_col6',
};

const HEADS: Record<ColumnKey, Partial<Record<Lang, string>>> = {
  time: {
    ko: '출발시각', en: 'Departs', ja: '出発時刻', zh: '出发时间',
    vi: 'Giờ đi', th: 'เวลาออก', ru: 'Отправление', id: 'Berangkat',
  },
  duration: {
    ko: '소요시간', en: 'Duration', ja: '所要時間', zh: '航行时间',
    vi: 'Thời gian', th: 'ระยะเวลา', ru: 'В пути', id: 'Durasi',
  },
  ship: {
    ko: '선박명', en: 'Vessel', ja: '船名', zh: '船名',
    vi: 'Tên tàu', th: 'ชื่อเรือ', ru: 'Судно', id: 'Nama Kapal',
  },
  route: {
    ko: '항로', en: 'Route', ja: '航路', zh: '航线',
    vi: 'Tuyến', th: 'เส้นทาง', ru: 'Маршрут', id: 'Rute',
  },
  place: {
    ko: '출발장소', en: 'Departs From', ja: '出発場所', zh: '出发地点',
    vi: 'Nơi đi', th: 'จุดออก', ru: 'Место отпр.', id: 'Tempat Berangkat',
  },
  status: {
    ko: '현황', en: 'Status', ja: '状況', zh: '状态',
    vi: 'Trạng thái', th: 'สถานะ', ru: 'Статус', id: 'Status',
  },
};

/**
 * One departure's six value cells.
 *
 * `lang` is already Korean-or-English (`boardLang` from the parent).
 */
function SailingCells({
  sailing,
  lang,
  columns,
}: {
  sailing: JejuSailing;
  lang: Lang;
  columns: Columns;
}): JSX.Element {
  const retimed = hasTimeChange(sailing);
  const wrap = wrapFor(lang);

  return (
    <>
      <span
        className={`${styles.value} ${retimed ? styles.valueRetimed : ''}`}
        style={{ left: columns.time }}
      >
        {displaySailingTime(sailing)}
      </span>
      {retimed && (
        <span className={styles.timeWas} style={{ left: columns.time }}>
          {sailing.scheduledTime}
        </span>
      )}

      <span className={styles.value} style={{ left: columns.duration }}>
        {sailing.duration}
      </span>
      <span
        className={`${styles.value} ${styles.valueWrap}`}
        style={{ left: columns.ship, maxWidth: wrap.value.ship }}
      >
        {sailingShipLabel(sailing.shipName, lang)}
      </span>
      <span
        className={`${styles.value} ${styles.valueWrap}`}
        style={{ left: columns.route, maxWidth: wrap.value.route }}
      >
        {sailingRouteLabel(sailing.route, lang)}
      </span>
      <span
        className={`${styles.value} ${styles.valueWrap}`}
        style={{ left: columns.place, maxWidth: wrap.value.place }}
      >
        {sailingPlaceLabel(sailing.place, lang)}
      </span>

      {sailing.status && (
        <span
          className={`${styles.value} ${styles.valueStatus} ${styles.valueWrap}`}
          style={{
            left: columns.status,
            maxWidth: wrap.value.status,
            color: sailingStatusColor(sailing.status),
          }}
        >
          {sailingStatusLabel(sailing.status, lang)}
        </span>
      )}
      {sailing.note && (
        <span className={styles.note} style={{ left: columns.status, maxWidth: wrap.value.status }}>
          {sailing.note}
        </span>
      )}
    </>
  );
}

const LOADING = {
  ko: '운항 정보를 불러오는 중입니다.',
  en: 'Loading sailing information…',
  ja: '運航情報を読み込み中です。',
  zh: '正在加载航运信息…',
  vi: 'Đang tải thông tin chuyến tàu…',
  th: 'กำลังโหลดข้อมูลเรือ…',
  ru: 'Загрузка рейсов…',
  id: 'Memuat informasi pelayaran…',
};

const EMPTY = {
  ko: '표시할 운항 정보가 없습니다.', en: 'No sailing information to show.',
  ja: '表示できる運航情報はありません。', zh: '暂无航运信息。',
  vi: 'Không có thông tin chuyến tàu.', th: 'ไม่มีข้อมูลการเดินเรือ',
  ru: 'Нет информации о рейсах.', id: 'Tidak ada informasi pelayaran.',
};

export function JejuSailingBoard({ controller, lang }: Props): JSX.Element {
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const snapshot = useSailingStore((s) => s.snapshot);
  // Departures arrive already deduped and sorted by time (SailingService), so
  // the first one is the next sailing out of 제주항, whichever berth it leaves.
  const lead = useJejuDepartureSailings()[0];
  const isLoading = snapshot === null;
  /** Board chrome + cells: Korean or English only (matches JejuFlightBoard). */
  const boardLang: Lang = lang === 'ko' ? 'ko' : 'en';

  const emptyMessage = isLoading
    ? opText('OP_Schedule_Loading', boardLang, LOADING)
    : opText('OP_Schedule_Result', boardLang, EMPTY);
  const titleRaw = opText('CruiseSchedule', boardLang, TITLE);
  /** English stacks onto two lines so the rule can reach further left. */
  const title =
    boardLang === 'en' && !titleRaw.includes('\n')
      ? titleRaw.replace(/\s+/, '\n')
      : titleRaw;
  const openSailings = (): void => controller.navigate('cruise', CRUISE_TITLE);
  const columns = columnsFor(boardLang);
  const compact = boardLang !== 'ko';
  const wrap = wrapFor(boardLang);

  return (
    <>
      {/* The whole panel is the tap target, not just 더보기 below it — a visitor
          reaching for the row they are reading gets the same 운항정보 page. It
          stays a div with role=button because the title is a <p>, which a real
          <button> may not contain (same call as the home weather card). */}
      <div
        className={`${styles.board} ${lowReach ? styles.boardLow : ''}`}
        role="button"
        aria-label={titleRaw}
        onClick={openSailings}
      >
        <p className={`${styles.title}${compact ? ` ${styles.titleEn}` : ''}`}>{title}</p>
        <div className={`${styles.rule}${compact ? ` ${styles.ruleEn}` : ''}`} />

        {(Object.keys(columns) as ColumnKey[]).map((key) => (
          <span key={key} className={styles.head} style={{ left: columns[key], maxWidth: wrap.head[key] }}>
            {opText(HEAD_KEYS[key], boardLang, HEADS[key])}
          </span>
        ))}

        {lead ? (
          <SailingCells sailing={lead} lang={boardLang} columns={columns} />
        ) : (
          <span className={styles.empty} style={{ left: columns.time }}>
            {emptyMessage}
          </span>
        )}
      </div>

      <button
        type="button"
        className={`${styles.more} ${lowReach ? styles.moreLow : ''}`}
        onClick={openSailings}
      >
        <span className={styles.chevron} />
        <span className={styles.moreText}>{opText('Schedule_More_Cruise', boardLang, MORE)}</span>
      </button>
    </>
  );
}
