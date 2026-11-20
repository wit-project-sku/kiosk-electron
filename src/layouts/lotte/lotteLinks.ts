/**
 * Where the 롯데 screens' QR codes point. None exists yet (2026-11-18): the course phone page and the
 * WITS app's 영화 나눔 · 사연 보내기 · 미션 deep links are still to be built by the app side.
 *
 * While a value is null the screen draws the Figma QR artwork (`qr-placeholder`) — nothing a
 * visitor can scan to a dead page. Set the URL here and every screen renders a live QR instead.
 */
export const LOTTE_LINKS: {
  /** 영화 전후 코스 on the phone (C-02). Receives `?course=` with the encoded stops. */
  course: string | null;
  /** WITS app — 영화 나눔 (C-03). */
  movieShare: string | null;
  /** WITS app — 사연 보내기 (C-05 · C-06 · C-07). */
  storySubmit: string | null;
  /** WITS app — 롯데 미션 home (M-01). */
  missions: string | null;
  /** WITS app — one mission's detail (M-02 · M-03). Receives `?mission=<id>`. */
  missionDetail: string | null;
} = {
  course: null,
  movieShare: null,
  storySubmit: null,
  missions: null,
  missionDetail: null,
};

export const withQuery = (base: string | null, key: string, value: string): string | null =>
  base ? `${base}${base.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}` : null;
