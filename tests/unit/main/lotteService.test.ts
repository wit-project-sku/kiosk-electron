import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/core/logger', () => ({
  createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const { LotteService } = await import('@main/services/LotteService');
const { toCinemaMovies } = await import('../../../src/layouts/lotte/lotteCinemaData');
const { toStory } = await import('../../../src/layouts/lotte/lotteStoryData');

const kiosk = (n: number) => ({ kioskNum: () => n });
const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, code: 200, data }), { status: 200 });

/** Trimmed from stage GET /api/cinema/showtimes?kioskId=11 (2026-11-18). */
const SHOWTIMES = {
  kioskId: 11,
  cinemaCode: 'WORLDTOWER',
  cinemaName: '월드타워',
  date: '2026-11-18',
  fetchedAt: '2026-11-18T13:38:04+09:00',
  movies: [
    {
      movieTitle: '겨울의 왈츠',
      rating: '12',
      runningMinutes: 118,
      posterUrl: null,
      showings: [
        { startAt: '2026-11-18T16:00:00', endAt: '2026-11-18T17:58:00', screenName: '1관', seatsLeft: 88, seatsTotal: 120 },
      ],
    },
    {
      movieTitle: '별빛 탐험대',
      rating: 'ALL',
      runningMinutes: null,
      posterUrl: 'https://cdn.example/p.jpg',
      showings: [
        { startAt: '2026-11-18T14:00:00', endAt: '2026-11-18T15:36:00', screenName: '2관', seatsLeft: null, seatsTotal: null },
      ],
    },
    { movieTitle: '회차 없음', rating: '15', runningMinutes: 90, posterUrl: null, showings: [] },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('LotteService', () => {
  it('asks the cinema of THIS kiosk and keeps films that still have sessions', async () => {
    const fetch = vi.fn().mockResolvedValue(ok(SHOWTIMES));
    vi.stubGlobal('fetch', fetch);
    const s = await new LotteService(kiosk(12)).getShowtimes();
    expect(String(fetch.mock.calls[0]![0])).toMatch(/\/api\/cinema\/showtimes\?kioskId=12$/);
    expect(s?.cinemaName).toBe('월드타워');
    expect(s?.movies.map((m) => m.title)).toEqual(['겨울의 왈츠', '별빛 탐험대']);
    expect(s?.movies[1]).toMatchObject({ rating: 'ALL', runtimeMin: null, posterUrl: 'https://cdn.example/p.jpg' });
  });

  it('never calls the 롯데 endpoints from another venue (they would 400)', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const s = new LotteService(kiosk(8));
    expect(await s.getShowtimes()).toBeNull();
    expect(await s.getStories()).toBeNull();
    expect(await s.getMovieShareSummary()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the last good answer when a refresh fails', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(ok([{ id: 7, type: 'PHOTO', title: '생일', body: null, mediaUrl: 'https://x/y.webp', displayName: '닉', approvedAt: '2026-11-13T10:00:00' }]))
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetch);
    const s = new LotteService(kiosk(11));
    const first = await s.getStories();
    expect(first).toHaveLength(1);
    expect(await s.getStories()).toBe(first);
  });

  it('treats an empty story list as an answer, not a failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([])));
    expect(await new LotteService(kiosk(13)).getStories()).toEqual([]);
  });

  it('reads the movie-share total, and 0 is a real value', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ totalSharedCount: 0 })));
    expect(await new LotteService(kiosk(11)).getMovieShareSummary()).toEqual({ totalSharedCount: 0 });
  });

  it('returns null before any answer when the server errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, code: 'CINEMA5032' }), { status: 503 })),
    );
    expect(await new LotteService(kiosk(11)).getShowtimes()).toBeNull();
  });
});

describe('screen adapters', () => {
  it('turns showtimes into the cinema screens\' shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(SHOWTIMES)));
    const s = (await new LotteService(kiosk(11)).getShowtimes())!;
    const [a, b] = toCinemaMovies(s, '2026-11-18');
    expect(a).toMatchObject({ title: '겨울의 왈츠', grade: '12', runtimeMin: 118 });
    expect(a!.sessions[0]).toEqual({ start: '16:00', end: '17:58', screen: '1관', format: '', seatsLeft: 88, seatsTotal: 120 });
    // 'ALL' is drawn as 전체; a missing running time comes from the session's own length.
    expect(b).toMatchObject({ grade: '전체', runtimeMin: 96 });
    expect(b!.sessions[0]).toMatchObject({ seatsLeft: null, seatsTotal: null });
  });

  it('drops sessions from another day (a stale answer after midnight)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(SHOWTIMES)));
    const s = (await new LotteService(kiosk(11)).getShowtimes())!;
    expect(toCinemaMovies(s, '2026-11-19')).toEqual([]);
  });

  it('turns a server story into a list row', () => {
    expect(
      toStory({ id: 3, type: 'VIDEO', title: '1주년', body: null, mediaUrl: 'https://x/v.mp4', durationSeconds: 28, displayName: '닉네임', approvedAt: '2026-11-13T09:00:00' }),
    ).toEqual({ id: 3, kind: 'video', title: '1주년', body: '', author: '닉네임', date: '11. 13', mediaUrl: 'https://x/v.mp4' });
  });
});
