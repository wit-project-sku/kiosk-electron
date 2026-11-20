/**
 * 롯데시네마 상영 시간표 — Figma A-06 (W011 8754:656 · W012 8754:805 · W013 8754:943). By movie, like
 * the cinema's own booking page; the nearest session is red and sessions that have started are
 * hidden. No tabs: 영화 전후 코스 and 영화 나눔 open from the home.
 *
 * Data: GET /api/cinema/showtimes for this kiosk (lotteLive.ts), the sample timetable until the
 * first answer. Rating, poster and seats are optional in the feed and drawn only when present.
 */
import { useEffect, useMemo, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { LottePageFrame } from './LottePageFrame';
import { useCinemaMovies } from './lotteLive';
import { lotteSite, upcomingSessions } from './lotteSample';
import { lt } from './lotteText';
import c from './lotteContent.module.css';

const hmNow = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function LotteCinema({ controller }: { controller: KioskController }): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const en = lang !== 'ko';
  const { movies: feed, cinemaName } = useCinemaMovies();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  /* The server already drops started sessions, but only as often as it is asked. */
  const movies = useMemo(
    () =>
      feed
        .map((m) => ({ ...m, sessions: m.sessions.filter((s) => s.start >= hmNow(now)) }))
        .filter((m) => m.sessions.length > 0),
    [feed, now],
  );
  const next = useMemo(() => upcomingSessions(movies)[0], [movies]);
  const site = lotteSite(controller.kioskId);
  return (
    <LottePageFrame
      controller={controller}
      title={lt('MainButton_Cinema', lang, { ko: '롯데시네마', en: 'LOTTE CINEMA' })}
      subtitle={en ? "Today's remaining showtimes." : '오늘 남은 상영 회차를 확인하세요'}
      showBanner={false}
    >
      <div className={`${c.body} ${c.bodyFull}`}>
        <div className={c.cinemaHead}>
          <span className={c.cinemaName}>
            {lt('Cinema_Name', lang, { ko: `롯데시네마 ${cinemaName ?? site.cinema}`, en: 'LOTTE CINEMA' }, controller.kioskId)}
          </span>
          <span className={c.cinemaNote}>
            {lt('Cinema_SeatUpdate', lang, { ko: '좌석 수는 5분마다 갱신됩니다', en: 'Seats update every 5 minutes' })}
          </span>
        </div>
        <div className={c.scroll}>
          {movies.length === 0 && (
            <div className={c.cinemaEmpty} data-voice-state="empty">
              {lt('Cinema_NoShow', lang, { ko: '오늘 남은 상영이 없습니다.', en: 'No more showtimes today.' })}
            </div>
          )}
          {movies.map((m) => (
            <div key={m.title} className={c.movie}>
              {m.posterUrl ? (
                <img src={m.posterUrl} alt="" className={c.poster} draggable={false} />
              ) : (
                <div className={c.poster}>{m.title}</div>
              )}
              <div className={c.movieBody}>
                <div className={c.movieTitle}>
                  {m.grade && (
                    <span className={`${c.grade} ${c[`grade${m.grade}`] ?? ''}`}>{m.grade}</span>
                  )}
                  {m.title}
                </div>
                <div className={c.movieMeta}>
                  {en ? `${m.runtimeMin} min` : `${m.runtimeMin}분`}
                </div>
                <div className={c.times}>
                  {m.sessions.map((s) => {
                    const soon = next?.title === m.title && next.start === s.start;
                    return (
                      <div key={s.start} className={`${c.time} ${soon ? c.timeSoon : ''}`}>
                        <span className={c.timeStart}>{s.start}</span>
                        <span className={c.timeInfo}>
                          {s.format ? `${s.screen} · ${s.format}` : s.screen}
                        </span>
                        {s.seatsLeft != null && s.seatsTotal != null && (
                          <span className={c.timeInfo}>
                            {lt('Home_Cinema_Seats', lang, { ko: '남은 좌석', en: 'Seats' })} {s.seatsLeft}/{s.seatsTotal}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </LottePageFrame>
  );
}
