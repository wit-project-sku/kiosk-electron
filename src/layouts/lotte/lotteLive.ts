/**
 * 롯데 live data in the renderer — 상영 시간표, 오늘의 사연 and 영화 나눔 from LotteService (main),
 * polled while a screen that shows them is mounted, the way useExpresswayTraffic polls 화성's board.
 * Kept in a store so leaving and re-entering a screen does not blank it while the next poll runs.
 */
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { isOk, type Result } from '@shared/types/result';
import type { LotteMovieShareSummary, LotteShowtimes, LotteStory } from '@shared/types/lotte';
import { localDate, toCinemaMovies } from './lotteCinemaData';
import { sampleCinema, type CinemaMovie } from './lotteSample';

interface LotteLiveState {
  /** null until the server has answered once. */
  showtimes: LotteShowtimes | null;
  stories: LotteStory[] | null;
  summary: LotteMovieShareSummary | null;
}

export const useLotteLive = create<LotteLiveState>(() => ({
  showtimes: null,
  stories: null,
  summary: null,
}));

/** The server caches showtimes for a minute. */
const SHOWTIMES_POLL_MS = 60 * 1000;
/** New approvals show up within this long while 오늘의 사연 is open. */
const STORIES_POLL_MS = 60 * 1000;

function usePoll<T>(
  get: (() => Promise<Result<T | null>>) | undefined,
  put: (value: T) => void,
  everyMs: number | null,
): void {
  useEffect(() => {
    if (!get) return; // a stale preload (before a full dev restart)
    let alive = true;
    const load = (): void => {
      void get().then((r) => {
        if (alive && isOk(r) && r.value != null) put(r.value);
      });
    };
    load();
    const timer = everyMs ? setInterval(load, everyMs) : null;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
    // get/put are module-stable for a mounted screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [everyMs]);
}

/** GET /api/cinema/showtimes for this kiosk, polled each minute. */
export function useLotteShowtimes(): LotteShowtimes | null {
  usePoll<LotteShowtimes>(
    window.api?.lotte?.getShowtimes,
    (showtimes) => useLotteLive.setState({ showtimes }),
    SHOWTIMES_POLL_MS,
  );
  return useLotteLive((s) => s.showtimes);
}

/** GET /api/stories for this kiosk — approved stories, 7 days, newest/ordered first. */
export function useLotteStories(): LotteStory[] | null {
  usePoll<LotteStory[]>(
    window.api?.lotte?.getStories,
    (stories) => useLotteLive.setState({ stories }),
    STORIES_POLL_MS,
  );
  return useLotteLive((s) => s.stories);
}

/** GET /api/movie-share/summary — read once per visit to 영화 나눔. */
export function useLotteMovieShareSummary(): LotteMovieShareSummary | null {
  usePoll<LotteMovieShareSummary>(
    window.api?.lotte?.getMovieShareSummary,
    (summary) => useLotteLive.setState({ summary }),
    null,
  );
  return useLotteLive((s) => s.summary);
}

/**
 * Today's remaining films for this kiosk: the server's once it has answered (an empty list then
 * means 오늘 상영 끝), the sample timetable before that so the screens are never blank offline.
 * `live` says which one you got.
 */
export function useCinemaMovies(): {
  movies: CinemaMovie[];
  live: boolean;
  cinemaName: string | null;
} {
  const showtimes = useLotteShowtimes();
  // Re-derive at midnight too: a failed refresh hands back the same object, so `showtimes` alone
  // would not change when the day does.
  const [today, setToday] = useState(() => localDate(new Date()));
  useEffect(() => {
    const t = setInterval(() => setToday(localDate(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);
  return useMemo(
    () =>
      showtimes
        ? { movies: toCinemaMovies(showtimes, today), live: true, cinemaName: showtimes.cinemaName || null }
        : { movies: sampleCinema(new Date()), live: false, cinemaName: null },
    [showtimes, today],
  );
}
