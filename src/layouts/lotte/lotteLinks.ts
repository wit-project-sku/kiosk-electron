import type { KioskId } from '@shared/types/kiosk';
import { AI_COURSE_SAVE_ORIGIN } from '@renderer/lib/aiCourseSave';

/**
 * Where the 롯데 screens' QR codes point.
 *
 *  - 영화 전후 코스 → the direction-fe phone page `/lotte` (same site as the 제주 AI 코스 QR).
 *  - 영화 나눔 · 오늘의 사연 → the WITS web pages, one per site (2026-11-25):
 *    https://www.witsapp.net/with/kiosks/{11|12|13}/movie-share · /today-story.
 *    These are the web version for now; when the app claims witsapp.net links, the same QR opens
 *    the app instead.
 *  - 롯데 미션 has no link yet.
 *
 * While a value is null the screen draws the Figma QR artwork (`qr-placeholder`) — nothing a
 * visitor can scan to a dead page. Set the URL here and every screen renders a live QR instead.
 */
export const LOTTE_LINKS: {
  /** 영화 전후 코스 on the phone (C-02). The query is built by lotteCourseLink.ts. */
  course: string | null;
  /** WITS app — 롯데 미션 home (M-01). */
  missions: string | null;
  /** WITS app — one mission's detail (M-02 · M-03). Receives `?mission=<id>`. */
  missionDetail: string | null;
} = {
  course: `${AI_COURSE_SAVE_ORIGIN}/lotte`,
  missions: null,
  missionDetail: null,
};

const WITS_WEB = 'https://www.witsapp.net/with/kiosks';
/** The 롯데 kiosks the WITS pages know, by number (W012 → 11). */
const WITS_SITES = new Set([11, 12, 13]);

function witsPage(kioskId: KioskId, page: string): string | null {
  const n = Number(kioskId.replace(/\D/g, ''));
  return WITS_SITES.has(n) ? `${WITS_WEB}/${n}/${page}` : null;
}

/** 영화 나눔 (C-03) — this site's WITS page. */
export const movieShareLink = (kioskId: KioskId): string | null => witsPage(kioskId, 'movie-share');
/** 오늘의 사연 보내기 (C-05 · C-06 · C-07) — this site's WITS page. */
export const storySubmitLink = (kioskId: KioskId): string | null => witsPage(kioskId, 'today-story');

export const withQuery = (base: string | null, key: string, value: string): string | null =>
  base ? `${base}${base.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}` : null;
