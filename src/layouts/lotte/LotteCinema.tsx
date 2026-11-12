/**
 * 롯데시네마 상영 시간표 — by movie, like the cinema's own booking page, with what starts next called
 * out. Rows are samples in the feed's shape; the poster slot takes the feed's PosterURL.
 */
import { useMemo } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { LottePageFrame } from './LottePageFrame';
import { lotteSite, sampleCinema, upcomingSessions } from './lotteSample';
import c from './lotteContent.module.css';

export function LotteCinema({ controller }: { controller: KioskController }): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const en = lang !== 'ko';
  const movies = useMemo(() => sampleCinema(new Date()), []);
  const next = useMemo(() => upcomingSessions(movies)[0], [movies]);
  const site = lotteSite(controller.kioskId);
  return (
    <LottePageFrame
      controller={controller}
      title={en ? 'LOTTE CINEMA' : '롯데시네마 상영 시간표'}
      subtitle={en ? "Today's remaining showtimes." : '오늘 남은 상영 회차를 확인하세요'}
      showBanner={false}
    >
      <div className={`${c.body} ${c.bodyFull}`}>
        <div className={c.cinemaHead}>
          <span className={c.cinemaName}>{en ? 'LOTTE CINEMA' : `롯데시네마 ${site.cinema}`}</span>
          <span className={c.cinemaNote}>
            {en ? 'Seats update every 5 minutes' : '좌석 수는 5분마다 갱신됩니다'}
          </span>
        </div>
        <div className={c.scroll}>
          {movies.map((m) => (
            <div key={m.title} className={c.movie}>
              <div className={c.poster}>{m.title}</div>
              <div className={c.movieBody}>
                <div className={c.movieTitle}>
                  <span className={`${c.grade} ${c[`grade${m.grade}`] ?? ''}`}>{m.grade}</span>
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
                          {s.screen} · {s.format}
                        </span>
                        <span className={c.timeInfo}>
                          {en ? 'Seats' : '남은 좌석'} {s.seatsLeft}/{s.seatsTotal}
                        </span>
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
