/**
 * GET /api/cinema/showtimes → the shape the cinema screens draw (home strip, 상영시간표, 영화 전후
 * 코스). Pure, so it is unit-tested apart from the renderer hooks in lotteLive.ts.
 */
import type { LotteShowtimes } from '@shared/types/lotte';
import type { CinemaMovie } from './lotteSample';

const hm = (iso: string): string => iso.slice(11, 16);
const minutesBetween = (a: string, b: string): number =>
  Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000));
const GRADES: Record<string, CinemaMovie['grade']> = {
  ALL: '전체',
  '12': '12',
  '15': '15',
  '19': '19',
  '18': '19',
};

/** Local calendar date as the API writes it: 'YYYY-MM-DD'. */
export const localDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The server's films in the shape the cinema screens draw, keeping only sessions that start on
 * `today` ('YYYY-MM-DD'). The screens compare HH:MM only, and an answer can be from yesterday: the
 * server hands back its last value (old fetchedAt) when 롯데시네마 fails, and LotteService keeps its
 * last good answer offline — so after midnight yesterday's 23:00 would read as still to come.
 */
export function toCinemaMovies(showtimes: LotteShowtimes, today: string): CinemaMovie[] {
  return showtimes.movies
    .map((m) => ({ ...m, showings: m.showings.filter((s) => s.startAt.startsWith(today)) }))
    .filter((m) => m.showings.length > 0)
    .map((m) => ({
    title: m.title,
    grade: m.rating ? (GRADES[m.rating.toUpperCase()] ?? null) : null,
    runtimeMin: m.runtimeMin ?? minutesBetween(m.showings[0]!.startAt, m.showings[0]!.endAt),
    posterUrl: m.posterUrl,
    sessions: m.showings.map((s) => ({
      start: hm(s.startAt),
      end: hm(s.endAt),
      screen: s.screenName,
      format: '',
      seatsLeft: s.seatsLeft,
      seatsTotal: s.seatsTotal,
    })),
  }));
}
