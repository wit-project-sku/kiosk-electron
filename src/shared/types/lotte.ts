/**
 * 롯데 kiosk (W011~W013) live data — the three kiosk endpoints only the 롯데 venues call. Each is
 * keyed by the kiosk number (11 · 12 · 13), not the content region, exactly as the API asks.
 *
 *   GET /api/cinema/showtimes?kioskId=   오늘 남은 상영 (server caches 1 min)
 *   GET /api/stories?kioskId=            승인된 오늘의 사연 (7 days, ≤ 30)
 *   GET /api/movie-share/summary         영화 나눔 누적 편수 (all sites together)
 */

export interface LotteShowing {
  /** KST local ISO without offset, '2026-11-18T16:00:00'. */
  startAt: string;
  endAt: string;
  screenName: string;
  /** null when 롯데시네마 does not send seat counts. */
  seatsLeft: number | null;
  seatsTotal: number | null;
}

export interface LotteMovie {
  title: string;
  /** '12' · '15' · '19' · 'ALL' — null when 롯데시네마 does not send one. */
  rating: string | null;
  runtimeMin: number | null;
  posterUrl: string | null;
  showings: LotteShowing[];
}

export interface LotteShowtimes {
  cinemaName: string;
  /** Business date, KST. */
  date: string;
  /** When the server last got these from 롯데시네마 (stale on an upstream failure). */
  fetchedAt: string;
  /** Only sessions still to start; a film with none left is dropped. Empty = 오늘 상영 끝. */
  movies: LotteMovie[];
}

export type LotteStoryType = 'TEXT' | 'PHOTO' | 'VIDEO';

export interface LotteStory {
  id: number;
  type: LotteStoryType;
  title: string;
  body: string | null;
  /** Photo (webp) or video (mp4); null for a text story. */
  mediaUrl: string | null;
  durationSeconds: number | null;
  /** The sender's app nickname (masked, or '여행자'). */
  displayName: string;
  /** KST, '2026-11-18T10:21:00'. */
  approvedAt: string;
}

export interface LotteMovieShareSummary {
  totalSharedCount: number;
}
