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
import { pick } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { CRUISE_TITLE } from './JejuCruise';
import {
  displaySailingTime,
  hasTimeChange,
  sailingStatusColor,
  sailingStatusLabel,
  useJejuDepartureSailings,
} from '@renderer/lib/jejuSailing';
import type { JejuSailing } from '@renderer/lib/jejuSailing';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useSailingStore } from '@renderer/store/sailingStore';
import styles from './JejuSailingBoard.module.css';

interface Props {
  controller: KioskController;
  lang: Lang;
}

const TITLE = {
  ko: '운항 정보', en: 'Sailings', ja: '運航情報', zh: '航运信息',
  vi: 'Chuyến tàu', th: 'ข้อมูลเรือ', ru: 'Рейсы', id: 'Pelayaran',
};

const MORE = {
  ko: '운항 정보 더보기', en: 'More sailings', ja: '運航情報をもっと見る', zh: '查看更多航运',
  vi: 'Xem thêm chuyến tàu', th: 'ดูเรือเพิ่มเติม', ru: 'Больше рейсов', id: 'Lihat pelayaran lain',
};

const COLUMNS = {
  time: 412,
  duration: 580,
  ship: 840,
  route: 1190,
  place: 1500,
  status: 1718,
} as const;

const HEADS: Record<keyof typeof COLUMNS, Partial<Record<Lang, string>>> = {
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

function SailingCells({ sailing, lang }: { sailing: JejuSailing; lang: Lang }): JSX.Element {
  const retimed = hasTimeChange(sailing);

  return (
    <>
      <span
        className={`${styles.value} ${retimed ? styles.valueRetimed : ''}`}
        style={{ left: COLUMNS.time }}
      >
        {displaySailingTime(sailing)}
      </span>
      {retimed && (
        <span className={styles.timeWas} style={{ left: COLUMNS.time }}>
          {sailing.scheduledTime}
        </span>
      )}

      <span className={styles.value} style={{ left: COLUMNS.duration }}>
        {sailing.duration}
      </span>
      <span className={styles.value} style={{ left: COLUMNS.ship }}>
        {sailing.shipName}
      </span>
      <span className={styles.value} style={{ left: COLUMNS.route }}>
        {sailing.route}
      </span>
      <span className={styles.value} style={{ left: COLUMNS.place }}>
        {sailing.place}
      </span>

      {sailing.status && (
        <span
          className={`${styles.value} ${styles.valueStatus}`}
          style={{ left: COLUMNS.status, color: sailingStatusColor(sailing.status) }}
        >
          {sailingStatusLabel(sailing.status, lang)}
        </span>
      )}
      {sailing.note && (
        <span className={styles.note} style={{ left: COLUMNS.status }}>
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

  const emptyMessage = isLoading ? LOADING : EMPTY;
  const openSailings = (): void => controller.navigate('cruise', CRUISE_TITLE);

  return (
    <>
      {/* The whole panel is the tap target, not just 더보기 below it — a visitor
          reaching for the row they are reading gets the same 운항정보 page. It
          stays a div with role=button because the title is a <p>, which a real
          <button> may not contain (same call as the home weather card). */}
      <div
        className={`${styles.board} ${lowReach ? styles.boardLow : ''}`}
        role="button"
        aria-label={pick(TITLE, lang)}
        onClick={openSailings}
      >
        <p className={styles.title}>{pick(TITLE, lang)}</p>
        <div className={styles.rule} />

        {(Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]).map((key) => (
          <span key={key} className={styles.head} style={{ left: COLUMNS[key] }}>
            {pick(HEADS[key], lang)}
          </span>
        ))}

        {lead ? (
          <SailingCells sailing={lead} lang={lang} />
        ) : (
          <span className={styles.empty} style={{ left: COLUMNS.time }}>
            {pick(emptyMessage, lang)}
          </span>
        )}
      </div>

      <button
        type="button"
        className={`${styles.more} ${lowReach ? styles.moreLow : ''}`}
        onClick={openSailings}
      >
        <span className={styles.chevron} />
        <span className={styles.moreText}>{pick(MORE, lang)}</span>
      </button>
    </>
  );
}
