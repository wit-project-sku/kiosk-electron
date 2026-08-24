/**
 * 제주공항 (W006) 운항 정보 board.
 *
 * Figma draws this in three conditions — 제주>홈 6212:48936 (탑승 중),
 * 6217:96955 (지연, with the original time struck through) and 6217:97433
 * (탑승최종). All three are the SAME board; only the 현황 colour/word and the
 * 출발시각 cell change, so this renders one board and lets `jejuFlight.ts`
 * decide both. See that file for why the two conditions are independent.
 *
 * Sits at frame level inside JejuHome's .root — the board (732) and the 더보기
 * control (955) are both positioned in Figma coordinates. 더보기 opens
 * 제주>운항정보 (JejuFlights), the full 출발/도착 board.
 *
 * ♿ low-reach moves both down 837 with the 공지 panel they sit in. The flag is
 * read from the store here rather than passed down from JejuHome: the board is
 * positioned in page coordinates that only this file knows, so a `lowReach` prop
 * would make JejuHome responsible for a layout it cannot see. Same call
 * JejuRentcar and JejuCruise make.
 */
import type { KioskController } from '@renderer/hooks/useKioskController';
import { pick } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { FLIGHTS_TITLE } from './JejuFlights';
import {
  displayTime,
  flightKindLabel,
  flightStatusColor,
  flightStatusLabel,
  hasTimeChange,
  useJejuDepartures,
} from '@renderer/lib/jejuFlight';
import type { JejuDeparture } from '@renderer/lib/jejuFlight';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import styles from './JejuFlightBoard.module.css';

interface Props {
  controller: KioskController;
  lang: Lang;
}

const TITLE = {
  ko: '운항 정보', en: 'Departures', ja: '運航情報', zh: '航班信息',
  vi: 'Chuyến bay', th: 'ข้อมูลเที่ยวบิน', ru: 'Вылеты', id: 'Keberangkatan',
};

const MORE = {
  ko: '운항 정보 더보기', en: 'More departures', ja: '運航情報をもっと見る', zh: '查看更多航班',
  vi: 'Xem thêm chuyến bay', th: 'ดูเที่ยวบินเพิ่มเติม', ru: 'Больше рейсов', id: 'Lihat penerbangan lain',
};

/**
 * The six column axes, in Figma board coordinates. Header and value are both
 * centred on the axis — in the 2026-08-24 board (node 6439:71583) each column's
 * two nodes agree to within 1px, except 현황 where the header centres on 1720 and
 * 탑승최종 on 1715; the axis below splits that.
 */
const COLUMNS = {
  time: 412,
  airline: 731,
  destination: 1095.5,
  kind: 1320,
  gate: 1507,
  status: 1718,
} as const;

const HEADS: Record<keyof typeof COLUMNS, Partial<Record<Lang, string>>> = {
  time: {
    ko: '출발시각', en: 'Departs', ja: '出発時刻', zh: '出发时间',
    vi: 'Giờ đi', th: 'เวลาออก', ru: 'Вылет', id: 'Berangkat',
  },
  airline: {
    ko: '항공사/편명', en: 'Airline / Flight', ja: '航空会社/便名', zh: '航空公司/航班',
    vi: 'Hãng / Chuyến', th: 'สายการบิน/เที่ยวบิน', ru: 'Рейс', id: 'Maskapai / No.',
  },
  destination: {
    ko: '목적지', en: 'Destination', ja: '目的地', zh: '目的地',
    vi: 'Điểm đến', th: 'ปลายทาง', ru: 'Назначение', id: 'Tujuan',
  },
  kind: {
    ko: '구분', en: 'Type', ja: '区分', zh: '类型',
    vi: 'Loại', th: 'ประเภท', ru: 'Тип', id: 'Jenis',
  },
  gate: {
    ko: '탑승구', en: 'Gate', ja: '搭乗口', zh: '登机口',
    vi: 'Cổng', th: 'ประตู', ru: 'Выход', id: 'Gerbang',
  },
  status: {
    ko: '현황', en: 'Status', ja: '状況', zh: '状态',
    vi: 'Trạng thái', th: 'สถานะ', ru: 'Статус', id: 'Status',
  },
};

/**
 * One departure's six value cells. Shared by the board's lead row and the
 * expanded list so a re-timed flight is drawn the same way in both — the
 * vertical offsets are the only difference and they come from the CSS.
 */
function FlightCells({ departure, lang }: { departure: JejuDeparture; lang: Lang }): JSX.Element {
  const retimed = hasTimeChange(departure);

  return (
    <>
      <span
        className={`${styles.value} ${retimed ? styles.valueRetimed : ''}`}
        style={{ left: COLUMNS.time }}
      >
        {displayTime(departure)}
      </span>
      {retimed && (
        <span className={styles.timeWas} style={{ left: COLUMNS.time }}>
          {departure.scheduledTime}
        </span>
      )}

      <span className={styles.value} style={{ left: COLUMNS.airline }}>
        {departure.airline}
        <span className={styles.flightNo}>({departure.flightNo})</span>
      </span>

      <span className={styles.value} style={{ left: COLUMNS.destination }}>
        {departure.destination}
      </span>

      <span className={styles.value} style={{ left: COLUMNS.kind }}>
        {flightKindLabel(departure.kind, lang)}
      </span>

      <span className={styles.value} style={{ left: COLUMNS.gate }}>
        {departure.gate}
      </span>

      {/* Blank when the airport has published no 현황 — see normalizeFlightStatus. */}
      {departure.status && (
        <span
          className={`${styles.value} ${styles.valueStatus}`}
          style={{ left: COLUMNS.status, color: flightStatusColor(departure.status) }}
        >
          {flightStatusLabel(departure.status, lang)}
        </span>
      )}
    </>
  );
}

const EMPTY_LEAD = {
  ko: '운항 정보를 불러오는 중입니다.',
  en: 'Loading flight information…',
  ja: '運航情報を読み込み中です。',
  zh: '正在加载航班信息…',
  vi: 'Đang tải thông tin chuyến bay…',
  th: 'กำลังโหลดข้อมูลเที่ยวบิน…',
  ru: 'Загрузка рейсов…',
  id: 'Memuat informasi penerbangan…',
};

export function JejuFlightBoard({ controller, lang }: Props): JSX.Element {
  const departures = useJejuDepartures();
  const lead = departures[0];

  return (
    <>
      <div className={`${styles.board} ${lowReach ? styles.boardLow : ''}`}>
        <p className={styles.title}>{pick(TITLE, lang)}</p>
        <div className={styles.rule} />

        {(Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]).map((key) => (
          <span key={key} className={styles.head} style={{ left: COLUMNS[key] }}>
            {pick(HEADS[key], lang)}
          </span>
        ))}

        {lead ? (
          <FlightCells departure={lead} lang={lang} />
        ) : (
          <span className={styles.empty} style={{ left: COLUMNS.time }}>
            {pick(EMPTY_LEAD, lang)}
          </span>
        )}
      </div>

      {/* Opens 제주>운항정보 (JejuFlights) — the full 출발/도착 board. */}
      <button
        type="button"
        className={`${styles.more} ${lowReach ? styles.moreLow : ''}`}
        onClick={() => controller.navigate('flights', FLIGHTS_TITLE)}
      >
        <span className={styles.chevron} />
        <span className={styles.moreText}>{pick(MORE, lang)}</span>
      </button>
    </>
  );
}
