/**
 * 제주국제여객터미널 (W007) home 운항 정보 board.
 *
 * Counterpart to JejuFlightBoard: one lead departure row with the six sailing
 * columns (출발시각 · 소요시간 · 선박명 · 항로 · 출발장소 · 현황) and a
 * 국제항 ㅣ 연안항 filter above the panel. 더보기 opens JejuCruise.
 */
import { useEffect, useState } from 'react';
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
import type { JejuSailing, SailingPort } from '@renderer/lib/jejuSailing';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useSailingStore } from '@renderer/store/sailingStore';
import { JejuSubTabRow } from './JejuSubTabRow';
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

const COLUMNS = {
  time: 412,
  duration: 580,
  ship: 840,
  route: 1220,
  place: 1550,
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
  const [port, setPort] = useState<SailingPort>('international');
  const allDepartures = useJejuDepartureSailings();
  const portDepartures = allDepartures.filter((s) => s.port === port);
  const lead = portDepartures[0];
  const isLoading = snapshot === null;

  // 국제항에 남은 편이 없고 연안항만 있을 때(저녁 시간대 등) 자동으로 탭 전환.
  useEffect(() => {
    if (!snapshot || portDepartures.length > 0) return;
    const alt: SailingPort = port === 'international' ? 'coastal' : 'international';
    if (allDepartures.some((s) => s.port === alt)) setPort(alt);
  }, [snapshot, allDepartures, port, portDepartures.length]);

  const emptyMessage = isLoading ? LOADING : EMPTY;

  return (
    <>
      <JejuSubTabRow
        compact
        className={`${styles.ports} ${lowReach ? styles.portsLow : ''}`}
        items={PORTS.map((p) => ({ id: p.id, label: pick(p.label, lang) }))}
        value={port}
        onChange={setPort}
      />

      <div className={`${styles.board} ${lowReach ? styles.boardLow : ''}`}>
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
        onClick={() => controller.navigate('cruise', CRUISE_TITLE)}
      >
        <span className={styles.chevron} />
        <span className={styles.moreText}>{pick(MORE, lang)}</span>
      </button>
    </>
  );
}
