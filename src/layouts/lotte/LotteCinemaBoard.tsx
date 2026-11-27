/**
 * 상영 시간표 on the home screen — Figma A-01 (8746:1466): one row, the nearest session (상영시각 ·
 * 영화 제목 · 잔여석 · 상영관), and '상영 정보 더보기' under it, which opens 롯데시네마 (A-06).
 * Rows come from GET /api/cinema/showtimes (lotteLive.ts; the sample timetable until the first
 * answer). The row is re-picked each minute so a session that has started drops off.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFitText } from '@layouts/components/fitText';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { lotteIconUrl } from '@renderer/assets/icons/lotte';
import type { Lang } from '@renderer/lib/i18n';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useCinemaMovies } from './lotteLive';
import { upcomingSessions } from './lotteSample';
import { lt } from './lotteText';
import styles from './LotteCinemaBoard.module.css';

const COLUMNS = ['start', 'title', 'seats', 'screen'] as const;
const COL_CLASS = { start: 'colStart', title: 'colTitle', seats: 'colSeats', screen: 'colScreen' } as const;
const HEADS: Record<(typeof COLUMNS)[number], { ko: string; en: string }> = {
  start: { ko: '상영시각', en: 'Time' },
  title: { ko: '영화 제목', en: 'Movie' },
  seats: { ko: '잔여석', en: 'Seats' },
  screen: { ko: '상영관', en: 'Screen' },
};

interface Props {
  controller: KioskController;
  lang: Lang;
}

export function LotteCinemaBoard({ controller, lang }: Props): JSX.Element {
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const boardRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const { movies } = useCinemaMovies();
  const nowHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const row = useMemo(
    () => upcomingSessions(movies).find((s) => s.start >= nowHm),
    [movies, nowHm],
  );
  /* The feed has Korean and English names only, so the board is Korean or English. */
  const en = lang !== 'ko';
  useFitText(boardRef, styles.title, en, 0.6, `${lang}|${lowReach}`, 'ink');
  const open = (): void => controller.navigate('cinema', '상영 시간표');
  const values: Record<(typeof COLUMNS)[number], string> = {
    start: row ? `${row.start} ~ ${row.end}` : '-',
    title: row?.title ?? lt('Cinema_NoShow', lang, { ko: '오늘 남은 상영이 없습니다', en: 'No more shows today' }),
    seats: row?.seatsLeft != null && row.seatsTotal != null ? `${row.seatsLeft}/${row.seatsTotal}` : '-',
    screen: row ? row.screen.replace(/관$/, '') : '-',
  };

  return (
    <>
      <div ref={boardRef} className={`${styles.board} ${lowReach ? styles.boardLow : ''}`} role="button" aria-label="상영 시간표" onClick={open}>
        <p className={styles.title}>{lt('MainButton_Cinema_Subtext', lang, { ko: '상영 시간표', en: 'Showtimes' })}</p>
        <div className={styles.rule} />
        {COLUMNS.map((key) => (
          <div key={key} className={`${styles.col} ${styles[COL_CLASS[key]]}`}>
            <span className={styles.head}>
              {/* 잔여석 is the sheet's Home_Cinema_Seats; the other three heads have no row yet. */}
              {key === 'seats' ? lt('Home_Cinema_Seats', lang, HEADS.seats) : en ? HEADS[key].en : HEADS[key].ko}
            </span>
            <span className={styles.value}>{values[key]}</span>
          </div>
        ))}
      </div>
      <button type="button" className={`${styles.more} ${lowReach ? styles.moreLow : ''}`} onClick={open}>
        {lotteIconUrl('ico-more-tri') && (
          <img src={lotteIconUrl('ico-more-tri')} alt="" className={styles.chevron} draggable={false} />
        )}
        <span className={styles.moreText}>{lt('Home_Cinema_More', lang, { ko: '상영 정보 더보기', en: 'More showtimes' })}</span>
      </button>
    </>
  );
}
