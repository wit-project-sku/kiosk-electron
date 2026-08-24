/**
 * 제주국제여객터미널 (W007) 운항정보 — the ferry sailing board behind the home
 * screen's 크루즈 운항 tile.
 *
 * Figma 여객터미널 > 운항정보 - 출발 (6420:23807) and - 도착 (6420:23892).
 * They are one screen with a 출발/도착 tab: identical chrome, identical column
 * axes, identical row geometry, and only two column labels differ —
 *
 *        출발                       도착
 *   1  출발시각                  도착시각
 *   2  소요시간                  소요시간
 *   3  선박명                    선박명
 *   4  항로                      항로
 *   5  출발장소                  도착장소
 *   6  현황                      현황
 *
 * so `COLUMNS` is a per-direction spec over one table renderer rather than two
 * near-identical components — the same shape the airport's JejuFlights uses.
 *
 * This is the terminal's counterpart to JejuFlights, deliberately a separate
 * file: four of the six columns have no airport equivalent, and this page adds
 * the 국제항 ㅣ 연안항 berth filter that the airport board has nothing like.
 *
 * The 현황 cell is BLANK when the operator has published no status — that is the
 * design, not a fallback. See `normalizeSailingStatus`.
 *
 * ♿ low-reach: 6420:23158 (출발) / 6420:23243 (도착). Nothing about the table
 * changes — the two control rows drop to the foot of the artboard and the board
 * slides up 159 into the space. All of it is positional, so it lives in the
 * `*Low` classes rather than in this file; see the CSS header for the y map.
 *
 * Placeholder data: `useJejuDepartureSailings` / `useJejuArrivalSailings` still
 * return the Figma's sample rows, and 연안항 has none at all. See the two TODOs
 * at the top of lib/jejuSailing.ts.
 */
import { useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { pick, useLang } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import {
  displaySailingTime,
  hasTimeChange,
  sailingStatusColor,
  sailingStatusLabel,
  useJejuArrivalSailings,
  useJejuDepartureSailings,
} from '@renderer/lib/jejuSailing';
import type { JejuSailing, SailingPort } from '@renderer/lib/jejuSailing';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { JejuPageFrame } from './JejuPageFrame';
import { JejuSubTabRow } from './JejuSubTabRow';
import styles from './JejuCruise.module.css';

interface Props {
  controller: KioskController;
}

export type SailingDirection = 'departure' | 'arrival';

/**
 * Korean id handed to JejuHeader / navigate() — also the analytics label.
 *
 * The same string the airport board uses, and deliberately so: i18n's TITLE_KEYS
 * already maps 운항정보 → `MainButton_Cruise`, and Localization_Jeju files that
 * row under "유산문화센터, 여객선터미널에 적용" — this venue's own row. The two
 * boards never run on one machine, so sharing the id shares the translation
 * rather than colliding.
 */
export const CRUISE_TITLE = '운항정보';

const TABS: ReadonlyArray<{ id: SailingDirection; label: Partial<Record<Lang, string>> }> = [
  {
    id: 'departure',
    label: {
      ko: '출발', en: 'Departures', ja: '出発', zh: '出发',
      vi: 'Đi', th: 'ขาออก', ru: 'Отправление', id: 'Berangkat',
    },
  },
  {
    id: 'arrival',
    label: {
      ko: '도착', en: 'Arrivals', ja: '到着', zh: '到达',
      vi: 'Đến', th: 'ขาเข้า', ru: 'Прибытие', id: 'Tiba',
    },
  },
];

/** 국제항 ㅣ 연안항 — which of 제주항's two passenger terminals. See SailingPort. */
const PORTS: ReadonlyArray<{ id: SailingPort; label: Partial<Record<Lang, string>> }> = [
  {
    id: 'international',
    label: {
      ko: '국제항', en: 'International', ja: '国際港', zh: '国际港',
      vi: 'Cảng quốc tế', th: 'ท่าเรือระหว่างประเทศ', ru: 'Междунар. порт', id: 'Pelabuhan Internasional',
    },
  },
  {
    id: 'coastal',
    label: {
      ko: '연안항', en: 'Coastal', ja: '沿岸港', zh: '沿岸港',
      vi: 'Cảng ven biển', th: 'ท่าเรือชายฝั่ง', ru: 'Каботажный порт', id: 'Pelabuhan Pesisir',
    },
  },
];

const EMPTY = {
  ko: '표시할 운항 정보가 없습니다.', en: 'No sailing information to show.',
  ja: '表示できる運航情報はありません。', zh: '暂无航运信息。',
  vi: 'Không có thông tin chuyến tàu.', th: 'ไม่มีข้อมูลการเดินเรือ',
  ru: 'Нет информации о рейсах.', id: 'Tidak ada informasi pelayaran.',
};

/**
 * A column: where its centre axis sits.
 *
 * Every column is centred, and each axis is the MEASURED centre of the Figma
 * texts (node x + width/2), not a guess off the left edge — the design mixes
 * left-placed and centre-placed runs for the same column, so only the centres
 * are comparable:
 *
 *   column     header x/w → centre   row cells → centre   axis
 *   시각        205/156 → 283         224/123 → 285.5      285.5
 *   소요시간     441/156 → 519         441/140 → 511        515
 *   선박명       705/117 → 763.5       655/217 → 763.5      763.5   (exact)
 *   항로        1152/78 → 1191        1201 / 1208.5        1205
 *   장소        1560/156 → 1638       1530/217 → 1638.5    1638
 *   현황        1891/78 → 1930        1918.5               1918.5
 *
 * Where header and cells disagree the cells win, for the reason JejuFlights
 * records: the header inks drift but a column cannot wander between the two
 * tabs. 현황's 1918.5 is also the airport board's status axis and where the
 * 기상악화 note centres (1919), so the two pages line up. NORMALISED.
 */
interface Column {
  key: string;
  x: number;
  head: Partial<Record<Lang, string>>;
}

const COL_TIME_DEPARTURE = {
  ko: '출발시각', en: 'Departs', ja: '出発時刻', zh: '出发时间',
  vi: 'Giờ đi', th: 'เวลาออก', ru: 'Отправление', id: 'Berangkat',
};
const COL_TIME_ARRIVAL = {
  ko: '도착시각', en: 'Arrives', ja: '到着時刻', zh: '到达时间',
  vi: 'Giờ đến', th: 'เวลาถึง', ru: 'Прибытие', id: 'Tiba',
};
const COL_DURATION = {
  ko: '소요시간', en: 'Duration', ja: '所要時間', zh: '航行时间',
  vi: 'Thời gian', th: 'ระยะเวลา', ru: 'В пути', id: 'Durasi',
};
const COL_SHIP = {
  ko: '선박명', en: 'Vessel', ja: '船名', zh: '船名',
  vi: 'Tên tàu', th: 'ชื่อเรือ', ru: 'Судно', id: 'Nama Kapal',
};
const COL_ROUTE = {
  ko: '항로', en: 'Route', ja: '航路', zh: '航线',
  vi: 'Tuyến', th: 'เส้นทาง', ru: 'Маршрут', id: 'Rute',
};
const COL_PLACE_DEPARTURE = {
  ko: '출발장소', en: 'Departs From', ja: '出発場所', zh: '出发地点',
  vi: 'Nơi đi', th: 'จุดออก', ru: 'Место отпр.', id: 'Tempat Berangkat',
};
const COL_PLACE_ARRIVAL = {
  ko: '도착장소', en: 'Arrives At', ja: '到着場所', zh: '到达地点',
  vi: 'Nơi đến', th: 'จุดถึง', ru: 'Место приб.', id: 'Tempat Tiba',
};
const COL_STATUS = {
  ko: '현황', en: 'Status', ja: '状況', zh: '状态',
  vi: 'Trạng thái', th: 'สถานะ', ru: 'Статус', id: 'Status',
};

const COLUMNS: Record<SailingDirection, Column[]> = {
  departure: [
    { key: 'time',     x: 285.5,  head: COL_TIME_DEPARTURE },
    { key: 'duration', x: 515,    head: COL_DURATION },
    { key: 'ship',     x: 763.5,  head: COL_SHIP },
    { key: 'route',    x: 1205,   head: COL_ROUTE },
    { key: 'place',    x: 1638,   head: COL_PLACE_DEPARTURE },
    { key: 'status',   x: 1918.5, head: COL_STATUS },
  ],
  arrival: [
    { key: 'time',     x: 285.5,  head: COL_TIME_ARRIVAL },
    { key: 'duration', x: 515,    head: COL_DURATION },
    { key: 'ship',     x: 763.5,  head: COL_SHIP },
    { key: 'route',    x: 1205,   head: COL_ROUTE },
    { key: 'place',    x: 1638,   head: COL_PLACE_ARRIVAL },
    { key: 'status',   x: 1918.5, head: COL_STATUS },
  ],
};

export function JejuCruise({ controller }: Props): JSX.Element {
  const lang = useLang();
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const [direction, setDirection] = useState<SailingDirection>('departure');
  const [port, setPort] = useState<SailingPort>('international');

  const departures = useJejuDepartureSailings();
  const arrivals = useJejuArrivalSailings();

  const rows = (direction === 'departure' ? departures : arrivals).filter((s) => s.port === port);
  const columns = COLUMNS[direction];

  /*
   * ♿ only moves things on this page — every size, weight and colour is shared
   * with the standard frames — so each element keeps its class and picks up a
   * second one that re-places it. Same helper JejuHome uses.
   *
   * Note there is no `lowReachSelfLayout` on the frame below: that prop only
   * matters once JejuPageFrame's 573px re-stack is in play, and `showBanner`
   * is false here, so the frame already leaves the body alone.
   */
  const low = (base?: string, alt?: string): string =>
    `${base ?? ''} ${lowReach ? alt ?? '' : ''}`;

  const cellText = (col: Column, row: JejuSailing): string => {
    switch (col.key) {
      case 'time':     return displaySailingTime(row);
      case 'duration': return row.duration;
      case 'ship':     return row.shipName;
      case 'route':    return row.route;
      case 'place':    return row.place;
      // Blank when nothing is published — see the header comment.
      case 'status':   return row.status ? sailingStatusLabel(row.status, lang) : '';
      default:         return '';
    }
  };

  return (
    <JejuPageFrame
      controller={controller}
      title={CRUISE_TITLE}
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
            onClick={() => setDirection(tab.id)}
          >
            {pick(tab.label, lang)}
          </button>
        ))}
      </div>

      <JejuSubTabRow
        className={low(styles.ports, styles.portsLow)}
        items={PORTS.map((p) => ({ id: p.id, label: pick(p.label, lang) }))}
        value={port}
        onChange={setPort}
      />

      <div className={low(styles.headPlate, styles.headPlateLow)} />
      {columns.map((col) => (
        <span
          key={col.key}
          className={`${low(styles.head, styles.headLow)} ${styles.cellCentred}`}
          style={{ left: col.x }}
        >
          {pick(col.head, lang)}
        </span>
      ))}

      <div className={low(styles.scroll, styles.scrollLow)}>
        <div className={styles.rows}>
          {rows.length === 0 ? (
            <p className={styles.empty}>{pick(EMPTY, lang)}</p>
          ) : (
            rows.map((row) => (
              <div key={row.id} className={styles.row}>
                {columns.map((col) => (
                  <span
                    key={col.key}
                    className={`${styles.cell} ${styles.cellCentred} ${
                      col.key === 'status' ? styles.cellStatus : ''
                    }`}
                    style={{
                      left: col.x,
                      ...(col.key === 'status' && row.status
                        ? { color: sailingStatusColor(row.status) }
                        : null),
                    }}
                  >
                    {cellText(col, row)}
                  </span>
                ))}
                {hasTimeChange(row) && <span className={styles.timeWas}>{row.scheduledTime}</span>}
                {row.note && <span className={styles.note}>{row.note}</span>}
                <div className={styles.rowRule} />
              </div>
            ))
          )}
        </div>
      </div>
    </JejuPageFrame>
  );
}
