/**
 * 롯데시네마 상영 시간표 on the home screen — sits where 제주공항 draws its 운항 정보 board, with the
 * same chrome. The rows are sample data until the 5-minute server feed exists; one session shows
 * at a time and the board steps through what is coming up.
 */
import { useEffect, useMemo, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { Lang } from '@renderer/lib/i18n';
import { sampleCinema, upcomingSessions } from './lotteSample';
import styles from './LotteCinemaBoard.module.css';

const STEP_MS = 5_000;
const COLUMNS = { start: 460, title: 830, grade: 1190, screen: 1400, seats: 1660 } as const;
const HEADS: Record<keyof typeof COLUMNS, { ko: string; en: string }> = {
  start: { ko: '시작', en: 'Start' },
  title: { ko: '영화', en: 'Movie' },
  grade: { ko: '등급', en: 'Rating' },
  screen: { ko: '상영관', en: 'Screen' },
  seats: { ko: '좌석', en: 'Seats' },
};

interface Props {
  controller: KioskController;
  lang: Lang;
}

export function LotteCinemaBoard({ controller, lang }: Props): JSX.Element {
  const rows = useMemo(() => upcomingSessions(sampleCinema(new Date())), []);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % rows.length), STEP_MS);
    return () => clearInterval(id);
  }, [rows.length]);
  const row = rows[index]!;
  /* The feed has Korean and English names only, so the board follows 운항 정보: Korean or English. */
  const en = lang !== 'ko';
  const open = (): void => controller.navigate('cinema', '상영 시간표');

  return (
    <>
      <div className={styles.board} role="button" aria-label="상영 시간표" onClick={open}>
        <p className={en ? `${styles.title} ${styles.titleWrap}` : styles.title}>
          {en ? 'LOTTE CINEMA' : '롯데시네마'}
        </p>
        <div className={styles.rule} />
        {(Object.keys(COLUMNS) as (keyof typeof COLUMNS)[]).map((key) => (
          <span key={key} className={styles.head} style={{ left: COLUMNS[key] }}>
            {en ? HEADS[key].en : HEADS[key].ko}
          </span>
        ))}
        <span className={styles.value} style={{ left: COLUMNS.start }}>
          {row.start}
        </span>
        <span className={styles.value} style={{ left: COLUMNS.title }}>
          {row.title}
        </span>
        <span className={styles.value} style={{ left: COLUMNS.grade }}>
          {row.grade}
        </span>
        <span className={styles.value} style={{ left: COLUMNS.screen }}>
          {row.screen}
        </span>
        <span className={styles.value} style={{ left: COLUMNS.seats }}>
          {row.seatsLeft}/{row.seatsTotal}
        </span>
      </div>
      <button type="button" className={styles.more} onClick={open}>
        <span className={styles.chevron} />
        <span className={styles.moreText}>{en ? 'More' : '더보기'}</span>
      </button>
    </>
  );
}
