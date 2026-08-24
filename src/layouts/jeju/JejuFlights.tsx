/**
 * 제주공항 (W006) 운항정보 — the full board behind the home screen's
 * `▼ 운항 정보 더보기`.
 *
 * Figma 제주>운항정보=출발 (6219:98606) and 제주>운항정보=도착 (6219:98493).
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
 * The 현황 cell is BLANK when the airport has published no status — that is the
 * design (도착 rows 4 onward), not a fallback. See `normalizeFlightStatus`.
 *
 * Live data: `useJejuDepartures` / `useJejuArrivals` read the KAC snapshot
 * mirrored by `useFlightSync` (see FlightService).
 */
import { useEffect, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { pick, useLang } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import {
  displayTime,
  flightKindLabel,
  flightStatusColor,
  flightStatusLabel,
  hasTimeChange,
  useJejuArrivals,
  useJejuDepartures,
} from '@renderer/lib/jejuFlight';
import type { JejuFlightBase } from '@renderer/lib/jejuFlight';
import { JejuPageFrame } from './JejuPageFrame';
import styles from './JejuFlights.module.css';

interface Props {
  controller: KioskController;
}

export type FlightDirection = 'departure' | 'arrival';

/** Korean id handed to JejuHeader / navigate() — also the analytics label. */
export const FLIGHTS_TITLE = '운항정보';

const TABS: ReadonlyArray<{ id: FlightDirection; label: Partial<Record<Lang, string>> }> = [
  {
    id: 'departure',
    label: {
      ko: '출발', en: 'Departures', ja: '出発', zh: '出发',
      vi: 'Đi', th: 'ขาออก', ru: 'Вылет', id: 'Berangkat',
    },
  },
  {
    id: 'arrival',
    label: {
      ko: '도착', en: 'Arrivals', ja: '到着', zh: '到达',
      vi: 'Đến', th: 'ขาเข้า', ru: 'Прилёт', id: 'Tiba',
    },
  },
];

const EMPTY = {
  ko: '표시할 운항 정보가 없습니다.', en: 'No flight information to show.',
  ja: '表示できる運航情報はありません。', zh: '暂无航班信息。',
  vi: 'Không có thông tin chuyến bay.', th: 'ไม่มีข้อมูลเที่ยวบิน',
  ru: 'Нет информации о рейсах.', id: 'Tidak ada informasi penerbangan.',
};

/**
 * A column: where it sits and how it is aligned.
 *
 * `x` is a left edge for the two left-aligned columns and a centre axis for the
 * four centred ones. Figma's per-row x drifts up to 16px inside a column (the
 * 탑승구 header centres on 1673.5 while its "7" centres on 1687.5); a table
 * cannot have a column that wanders, so header and cell share the HEADER's
 * axis throughout. NORMALISED.
 */
interface Column {
  key: string;
  x: number;
  centred: boolean;
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
  ko: '수하물수취대', en: 'Baggage Claim', ja: '手荷物受取所', zh: '行李提取处',
  vi: 'Băng chuyền', th: 'สายพานกระเป๋า', ru: 'Выдача багажа', id: 'Pengambilan Bagasi',
};
const COL_STATUS = {
  ko: '현황', en: 'Status', ja: '状況', zh: '状态',
  vi: 'Trạng thái', th: 'สถานะ', ru: 'Статус', id: 'Status',
};

const COLUMNS: Record<FlightDirection, Column[]> = {
  departure: [
    { key: 'time',    x: 300,    centred: true, head: COL_TIME_DEPARTURE },
    { key: 'airline', x: 680,    centred: true, head: COL_AIRLINE },
    { key: 'place',   x: 1113.5, centred: true,  head: COL_DESTINATION },
    { key: 'kind',    x: 1394.5, centred: true,  head: COL_KIND },
    { key: 'stand',   x: 1673.5, centred: true,  head: COL_GATE },
    { key: 'status',  x: 1913.5, centred: true,  head: COL_STATUS },
  ],
  arrival: [
    { key: 'time',    x: 300,    centred: true, head: COL_TIME_ARRIVAL },
    { key: 'airline', x: 680,    centred: true, head: COL_AIRLINE },
    { key: 'place',   x: 1113.5, centred: true,  head: COL_ORIGIN },
    { key: 'kind',    x: 1394.5, centred: true,  head: COL_KIND },
    { key: 'stand',   x: 1673.5, centred: true,  head: COL_BELT },
    { key: 'status',  x: 1913.5, centred: true,  head: COL_STATUS },
  ],
};

/** One table row, flattened out of a departure or an arrival. */
interface Row {
  flight: JejuFlightBase;
  place: string;
  stand: string;
}

export function JejuFlights({ controller }: Props): JSX.Element {
  const lang = useLang();
  const [direction, setDirection] = useState<FlightDirection>('departure');
  const scrollRef = useRef<HTMLDivElement>(null);

  const departures = useJejuDepartures();
  const arrivals = useJejuArrivals();

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [direction]);

  const rows: Row[] =
    direction === 'departure'
      ? departures.map((d) => ({ flight: d, place: d.destination, stand: d.gate }))
      : arrivals.map((a) => ({ flight: a, place: a.origin, stand: a.belt }));

  const columns = COLUMNS[direction];
  const timeColX = columns.find((c) => c.key === 'time')?.x ?? 300;

  const cellText = (col: Column, row: Row): string => {
    switch (col.key) {
      case 'time':    return displayTime(row.flight);
      case 'airline': return `${row.flight.airline}(${row.flight.flightNo})`;
      case 'place':   return row.place;
      case 'kind':    return flightKindLabel(row.flight.kind, lang);
      case 'stand':   return row.stand;
      // Blank when nothing is published — see the header comment.
      case 'status':  return row.flight.status ? flightStatusLabel(row.flight.status, lang) : '';
      default:        return '';
    }
  };

  return (
    <JejuPageFrame
      controller={controller}
      title={FLIGHTS_TITLE}
      showBanner={false}
      onBack={() => controller.navigate('home', '뒤로')}
    >
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.tab} ${direction === tab.id ? styles.tabActive : ''}`}
            aria-pressed={direction === tab.id}
            onClick={() => setDirection(tab.id)}
          >
            {pick(tab.label, lang)}
          </button>
        ))}
      </div>

      <div className={styles.headPlate} />
      {columns.map((col) => (
        <span
          key={`${direction}-${col.key}`}
          className={`${styles.head} ${col.centred ? styles.cellCentred : ''}`}
          style={{ left: col.x }}
        >
          {pick(col.head, lang)}
        </span>
      ))}

      <div className={styles.scroll} ref={scrollRef}>
        <div key={direction} className={styles.rows}>
          {rows.length === 0 ? (
            <p className={styles.empty}>{pick(EMPTY, lang)}</p>
          ) : (
            rows.map((row) => (
              <div key={`${direction}-${row.flight.id}`} className={styles.row}>
                {columns.map((col) => (
                  <span
                    key={`${direction}-${col.key}`}
                    className={`${styles.cell} ${col.centred ? styles.cellCentred : ''} ${col.key === 'status' ? styles.cellStatus : ''}`}
                    style={{
                      left: col.x,
                      ...(col.key === 'status' && row.flight.status
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
            ))
          )}
        </div>
      </div>
    </JejuPageFrame>
  );
}
