/**
 * 제주공항 (W006) 운항정보 — the full board behind the home screen's
 * `▼ 운항 정보 더보기`.
 *
 * Figma 제주>운항정보=출발 (6412:75981) and 제주>운항정보=도착 (6412:76071),
 * the 2026-08-24 redraw of 6219:98606 / 6219:98493.
 * They are one screen with a 출발/도착 tab: identical chrome, identical row
 * geometry, and only three column labels differ —
 *
 *        출발                       도착
 *   1  출발시각                  도착시각
 *   2  항공사/편명               항공사/편명
 *   3  목적지                    출발지
 *   4  구분                      구분
 *   5  탑승구                    수하물수취대
 *   6  현황                      현황
 *
 * so `COLUMNS` is a per-direction spec over one table renderer rather than two
 * near-identical components.
 *
 * Empty 탑승구 / 수하물수취대 / 현황 cells show "-" (see `dashIfEmpty`).
 *
 * Live data: `useJejuDepartures` / `useJejuArrivals` read the KAC snapshot
 * mirrored by `useFlightSync` (see FlightService).
 *
 * 편명 search: Rentcar-style field under the tabs + FloatingKeyboard; filters
 * `flightNo` with case/space-insensitive partial match. Switching 출발/도착
 * clears the query and closes the keyboard.
 *
 * ♿ low-reach: same "controls to the foot" shape as the terminal's JejuCruise —
 * the 출발/도착 tabs (and the search field above them) drop to the artboard
 * floor and the board slides up 159 into the space. All of it is positional
 * (`*Low` classes); see the CSS header.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { pick, useLang } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import {
  dashIfEmpty,
  displayTime,
  flightKindLabel,
  flightStatusColor,
  flightStatusLabel,
  formatGate,
  hasTimeChange,
  useJejuArrivals,
  useJejuDepartures,
} from '@renderer/lib/jejuFlight';
import type { JejuFlightBase } from '@renderer/lib/jejuFlight';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useFlightStore } from '@renderer/store/flightStore';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';
import { HangulComposer } from '../insadong/keyboard/hangul';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import { JejuPageFrame } from './JejuPageFrame';
import styles from './JejuFlights.module.css';

/** Localization_Jeju cell, with the authored map as the per-language fallback. */
const opText = (key: string, lang: Lang, fallback: Partial<Record<Lang, string>>): string =>
  sheetText(key, lang, fallback);

interface Props {
  controller: KioskController;
}

export type FlightDirection = 'departure' | 'arrival';

/** Korean id handed to JejuHeader / navigate() — also the analytics label. */
export const FLIGHTS_TITLE = '운항정보';

const KEYBOARD_HEIGHT = 1000;
/** Below the standard search field (ends ~1142). */
const KEYBOARD_TOP = 1200;
/** Lift above the foot search row (3261.5) with the same gap Rentcar uses. */
const KEYBOARD_GAP_LOW = 200;
const KEYBOARD_TOP_LOW = 3261.5 - KEYBOARD_HEIGHT - KEYBOARD_GAP_LOW;

const TABS: ReadonlyArray<{
  id: FlightDirection;
  sheetKey: string;
  label: Partial<Record<Lang, string>>;
}> = [
  {
    id: 'departure',
    sheetKey: 'OP_Schedule_Tab_1',
    label: {
      ko: '출발', en: 'Departures', ja: '出発', zh: '出发',
      vi: 'Đi', th: 'ขาออก', ru: 'Вылет', id: 'Berangkat',
    },
  },
  {
    id: 'arrival',
    sheetKey: 'OP_Schedule_Tab_2',
    label: {
      ko: '도착', en: 'Arrivals', ja: '到着', zh: '到达',
      vi: 'Đến', th: 'ขาเข้า', ru: 'Прилёт', id: 'Tiba',
    },
  },
];

/** Authored fallbacks — Localization_Jeju `OP_Schedule_*` wins when filled. */
const EMPTY = {
  ko: '표시할 운항 정보가 없습니다.', en: 'No flight information to show.',
  ja: '表示できる運航情報はありません。', zh: '暂无航班信息。',
  vi: 'Không có thông tin chuyến bay.', th: 'ไม่มีข้อมูลเที่ยวบิน',
  ru: 'Нет информации о рейсах.', id: 'Tidak ada informasi penerbangan.',
};

const LOADING = {
  ko: '운항 정보를 불러오는 중입니다.',
  en: 'Loading flight information…',
  ja: '運航情報を読み込み中です。',
  zh: '正在加载航班信息…',
  vi: 'Đang tải thông tin chuyến bay…',
  th: 'กำลังโหลดข้อมูลเที่ยวบิน…',
  ru: 'Загрузка рейсов…',
  id: 'Memuat informasi penerbangan…',
};

const SEARCH_PLACEHOLDER = {
  ko: '편명을 검색해보세요', en: 'Search for the flight number',
  ja: '便名を検索してください。', zh: '请搜索航班号。',
  vi: 'Vui lòng tìm kiếm số hiệu chuyến bay.', th: 'โปรดค้นหาหมายเลขเที่ยวบิน',
  ru: 'Пожалуйста, введите номер рейса.', id: 'Silakan cari nomor penerbangan.',
};

const NO_RESULT = {
  ko: '해당 편명을 찾을 수 없습니다.', en: 'Flight number not found.',
  ja: '該当する便名が見つかりません。', zh: '找不到该航班号。',
  vi: 'Không tìm thấy số hiệu chuyến bay.', th: 'ไม่พบหมายเลขเที่ยวบินดังกล่าว',
  ru: 'Номер рейса не найден.', id: 'Nomor penerbangan tidak ditemukan.',
};

/**
 * A column: where its centre axis sits.
 *
 * The 2026-08-24 redraw centres EVERY column — proven by the one row whose two
 * texts differ in width: the 지연 flight's 16:15 (centre 285.5) and its struck
 * 16:05 (284.5) share an axis, and 오사카/간사이 (1101) sits on 서울/김포's
 * 1099. `x` is the ROW CELLS' centre, which the two frames agree on to ≤2px;
 * the header inks drift off it by up to 18px (탑승구 centres on 1655.5 in 출발
 * and 1666 in 도착 against the cells' fixed 1673.5), and a column cannot wander
 * between tabs, so headers take the cells' axis too. NORMALISED.
 *
 * `sheetKey` maps to Localization_Jeju `OP_Schedule_Info_col*`. 출발지 has no
 * sheet row yet — only the authored `head` fallback.
 */
interface Column {
  key: string;
  x: number;
  centred: boolean;
  sheetKey?: string;
  head: Partial<Record<Lang, string>>;
}

const COL_TIME_DEPARTURE = {
  ko: '출발시각', en: 'Departs', ja: '出発時刻', zh: '出发时间',
  vi: 'Giờ đi', th: 'เวลาออก', ru: 'Вылет', id: 'Berangkat',
};
const COL_TIME_ARRIVAL = {
  ko: '도착시각', en: 'Arrives', ja: '到着時刻', zh: '到达时间',
  vi: 'Giờ đến', th: 'เวลาถึง', ru: 'Прилёт', id: 'Tiba',
};
const COL_AIRLINE = {
  ko: '항공사/편명', en: 'Airline / Flight', ja: '航空会社/便名', zh: '航空公司/航班',
  vi: 'Hãng / Chuyến', th: 'สายการบิน/เที่ยวบิน', ru: 'Рейс', id: 'Maskapai / No.',
};
const COL_DESTINATION = {
  ko: '목적지', en: 'Destination', ja: '目的地', zh: '目的地',
  vi: 'Điểm đến', th: 'ปลายทาง', ru: 'Назначение', id: 'Tujuan',
};
/** No Localization_Jeju key yet — keep authored until the sheet adds one. */
const COL_ORIGIN = {
  ko: '출발지', en: 'Origin', ja: '出発地', zh: '出发地',
  vi: 'Nơi đi', th: 'ต้นทาง', ru: 'Откуда', id: 'Asal',
};
const COL_KIND = {
  ko: '구분', en: 'Type', ja: '区分', zh: '类型',
  vi: 'Loại', th: 'ประเภท', ru: 'Тип', id: 'Jenis',
};
const COL_GATE = {
  ko: '탑승구', en: 'Gate', ja: '搭乗口', zh: '登机口',
  vi: 'Cổng', th: 'ประตู', ru: 'Выход', id: 'Gerbang',
};
/**
 * The Figma text reads 수하물수치대. 수치대 is not a word — the term is
 * 수하물수취대 (baggage claim), so the correct spelling ships. Flagged for the
 * designer rather than reproduced.
 */
const COL_BELT = {
  ko: '수하물 수취대', en: 'Baggage', ja: '手荷物受取所', zh: '行李提取处',
  vi: 'Băng chuyền', th: 'สายพานกระเป๋า', ru: 'Выдача багажа', id: 'Pengambilan Bagasi',
};
const COL_STATUS = {
  ko: '현황', en: 'Status', ja: '状況', zh: '状态',
  vi: 'Trạng thái', th: 'สถานะ', ru: 'Статус', id: 'Status',
};

const COLUMNS: Record<FlightDirection, Column[]> = {
  departure: [
    { key: 'time',    x: 280,  centred: true, sheetKey: 'OP_Schedule_Info_col1', head: COL_TIME_DEPARTURE },
    { key: 'airline', x: 670,  centred: true, sheetKey: 'OP_Schedule_Info_col2', head: COL_AIRLINE },
    { key: 'place',   x: 1140, centred: true, sheetKey: 'OP_Schedule_Info_col3', head: COL_DESTINATION },
    { key: 'kind',    x: 1500, centred: true, sheetKey: 'OP_Schedule_Info_col4', head: COL_KIND },
    { key: 'stand',   x: 1700, centred: true, sheetKey: 'OP_Schedule_Info_col5', head: COL_GATE },
    { key: 'status',  x: 1915, centred: true, sheetKey: 'OP_Schedule_Info_col6', head: COL_STATUS },
  ],
  arrival: [
    { key: 'time',    x: 280,  centred: true, sheetKey: 'OP_Schedule_Info_col12', head: COL_TIME_ARRIVAL },
    { key: 'airline', x: 670,  centred: true, sheetKey: 'OP_Schedule_Info_col2', head: COL_AIRLINE },
    { key: 'place',   x: 1140, centred: true, head: COL_ORIGIN },
    { key: 'kind',    x: 1500, centred: true, sheetKey: 'OP_Schedule_Info_col4', head: COL_KIND },
    { key: 'stand',   x: 1700, centred: true, sheetKey: 'OP_Schedule_Info_col7', head: COL_BELT },
    { key: 'status',  x: 1915, centred: true, sheetKey: 'OP_Schedule_Info_col6', head: COL_STATUS },
  ],
};

/** One table row, flattened out of a departure or an arrival. */
interface Row {
  flight: JejuFlightBase;
  place: string;
  stand: string;
}

/** Strip spaces and fold case so `1141` hits `KE1141`. */
function normalizeFlightNo(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

export function JejuFlights({ controller }: Props): JSX.Element {
  const lang = useLang();
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const [direction, setDirection] = useState<FlightDirection>('departure');
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composer = useRef(new HangulComposer());

  const snapshot = useFlightStore((s) => s.snapshot);
  const departures = useJejuDepartures();
  const arrivals = useJejuArrivals();
  const isLoading = snapshot === null;

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [direction, query]);

  const allRows: Row[] = useMemo(
    () =>
      direction === 'departure'
        ? departures.map((d) => ({ flight: d, place: d.destination, stand: d.gate }))
        : arrivals.map((a) => ({ flight: a, place: a.origin, stand: a.belt })),
    [direction, departures, arrivals],
  );

  const rows = useMemo(() => {
    const needle = normalizeFlightNo(query);
    if (!needle) return allRows;
    return allRows.filter((row) => normalizeFlightNo(row.flight.flightNo).includes(needle));
  }, [allRows, query]);

  const columns = COLUMNS[direction];
  const timeColX = columns.find((c) => c.key === 'time')?.x ?? 300;

  const clearSearch = (): void => {
    composer.current.reset('');
    setQuery('');
    setFocused(false);
  };

  const selectTab = (id: FlightDirection): void => {
    setDirection(id);
    clearSearch();
  };

  const openSearch = (): void => {
    composer.current.reset(query);
    setFocused(true);
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
        setFocused(false);
        setQuery(c.value);
        return;
    }
    setQuery(c.value);
  };

  /*
   * ♿ only moves things on this page — every size, weight and colour is shared
   * with the standard frames — so each element keeps its class and picks up a
   * second one that re-places it. Same helper JejuCruise / JejuHome use.
   *
   * Note there is no `lowReachSelfLayout` on the frame below: that prop only
   * matters once JejuPageFrame's 573px re-stack is in play, and `showBanner`
   * is false here, so the frame already leaves the body alone.
   */
  const low = (base?: string, alt?: string): string =>
    `${base ?? ''} ${lowReach ? alt ?? '' : ''}`;

  const cellText = (col: Column, row: Row): string => {
    switch (col.key) {
      case 'time':    return displayTime(row.flight);
      case 'airline': return `${row.flight.airline}(${row.flight.flightNo})`;
      case 'place':   return row.place;
      case 'kind':    return flightKindLabel(row.flight.kind, lang);
      case 'stand':
        return direction === 'departure' ? formatGate(row.stand) : dashIfEmpty(row.stand);
      case 'status':
        return row.flight.status
          ? flightStatusLabel(row.flight.status, lang)
          : '-';
      default:        return '';
    }
  };

  const emptyCopy = isLoading
    ? opText('OP_Schedule_Loading', lang, LOADING)
    : allRows.length === 0
      ? opText('OP_Schedule_Result', lang, EMPTY)
      : opText('OP_Schedule_Search_Result', lang, NO_RESULT);

  const searchPlaceholder = opText('OP_Schedule_Search_placeholder', lang, SEARCH_PLACEHOLDER);

  return (
    <JejuPageFrame
      controller={controller}
      title={FLIGHTS_TITLE}
      showBanner={false}
      onBack={() => controller.navigate('home', '뒤로')}
    >
      <div className={low(styles.tabs, styles.tabsLow)}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.tab} ${direction === tab.id ? styles.tabActive : ''}`}
            aria-pressed={direction === tab.id}
            onClick={() => selectTab(tab.id)}
          >
            {opText(tab.sheetKey, lang, tab.label)}
          </button>
        ))}
      </div>

      <div
        className={low(styles.search, styles.searchLow)}
        role="button"
        aria-label={searchPlaceholder}
        onClick={openSearch}
      >
        <span className={`${styles.searchText} ${query ? styles.searchValue : ''}`}>
          {query || searchPlaceholder}
          {focused && <span className={styles.caret} />}
        </span>
        {jejuIconUrl('ico-search') && (
          <img src={jejuIconUrl('ico-search')} alt="" className={styles.searchIcon} draggable={false} />
        )}
      </div>

      <div className={low(styles.headPlate, styles.headPlateLow)} />
      {columns.map((col) => (
        <span
          key={`${direction}-${col.key}`}
          className={`${low(styles.head, styles.headLow)} ${col.centred ? styles.cellCentred : ''}`}
          style={{ left: col.x }}
        >
          {col.sheetKey ? opText(col.sheetKey, lang, col.head) : pick(col.head, lang)}
        </span>
      ))}

      <div className={low(styles.scroll, styles.scrollLow)} ref={scrollRef}>
        <div key={direction} className={styles.rows}>
          {rows.length === 0 ? (
            <p className={styles.empty}>{emptyCopy}</p>
          ) : (
            rows.map((row) => {
              const tintStatus =
                (direction === 'arrival' && row.flight.status === 'arrived') ||
                (direction === 'departure' && row.flight.status === 'final')
                  ? row.flight.status
                  : undefined;
              const tintColor = tintStatus
                ? flightStatusColor(tintStatus)
                : undefined;
              return (
              <div key={`${direction}-${row.flight.id}`} className={styles.row}>
                {columns.map((col) => (
                  <span
                    key={`${direction}-${col.key}`}
                    className={`${styles.cell} ${col.centred ? styles.cellCentred : ''} ${col.key === 'status' ? styles.cellStatus : ''}`}
                    style={{
                      left: col.x,
                      ...(tintColor
                        ? { color: tintColor }
                        : col.key === 'status' && row.flight.status
                          ? { color: flightStatusColor(row.flight.status) }
                          : null),
                    }}
                  >
                    {cellText(col, row)}
                  </span>
                ))}
                {hasTimeChange(row.flight) && (
                  <span
                    className={`${styles.timeWas} ${styles.cellCentred}`}
                    style={{ left: timeColX }}
                  >
                    {row.flight.scheduledTime}
                  </span>
                )}
                <div className={styles.rowRule} />
              </div>
              );
            })
          )}
        </div>
      </div>

      <FloatingKeyboard
        open={focused}
        onKey={applyKey}
        onClose={() => setFocused(false)}
        lang={lang}
        top={lowReach ? KEYBOARD_TOP_LOW : KEYBOARD_TOP}
      />
    </JejuPageFrame>
  );
}
