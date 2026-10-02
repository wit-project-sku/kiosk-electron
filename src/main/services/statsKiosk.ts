/**
 * The kiosk id that STATS payloads carry — and only stats payloads.
 *
 * ── Why this exists ───────────────────────────────────────────────────
 * The 3-monitor test kiosk reports under id 203 regardless of which location
 * it is currently pretending to be. A tester switches the machine between
 * 인사동, 제주, 오산 … during a session, and every one of those switches changes
 * `KioskService.kioskNum()`, so without this the day's menu-touches and photo
 * shots would land under three or four different ids and none of them the one
 * the test rig is filed under.
 *
 * ── What it deliberately does NOT touch ───────────────────────────────
 * ONLY the two stats endpoints (`/api/stats/menu-touch`, `/api/stats/shots`)
 * and their nightly batch counterparts read this. Everything else that sends a
 * kiosk id — shops, courses, banners, button layouts, backgrounds, outfits,
 * attractions, subtitles, update commands — keeps `kioskNum()` untouched,
 * because those ids select CONTENT. Pointing them at 203 would serve the test
 * rig a catalogue that does not exist and blank the screen it is meant to be
 * testing.
 *
 * Footfall is also left alone: its upload is separately gated behind
 * `FOOTFALL_API_URL` and its body carries the string `kioskId` ("W001") beside
 * the numeric `kioskNum`, so overriding one half would post a payload that
 * disagrees with itself.
 *
 * ── Beta only ─────────────────────────────────────────────────────────
 * Gated on {@link isBetaBuild}, the same switch that already gives beta its own
 * `%APPDATA%` directory and appId. A production build never calls the override
 * and its stats are unchanged. This is test scaffolding: when the 3-monitor rig
 * is provisioned with a real id, delete this file and the two call sites in
 * StatsService.
 */
import { createLogger } from '@main/core/logger';
import { isBetaBuild } from '@main/core/appIdentity';

const log = createLogger('stats-kiosk');

/** The id the 3-monitor test kiosk is filed under. */
export const BETA_STATS_KIOSK_ID = 203;

/**
 * `isBetaBuild()` re-reads the packaged package.json each call; a stat is
 * recorded on every button press, so the answer is resolved once. Lazy rather
 * than at module load: this file is imported while the container is wired,
 * which is before `app` has resolved its paths.
 */
let beta: boolean | undefined;

function betaOnce(): boolean {
  if (beta === undefined) {
    beta = isBetaBuild();
    if (beta) {
      log.info('beta build: stats will report kioskId', {
        kioskId: BETA_STATS_KIOSK_ID,
        note: 'overrides the provisioned kiosk for /api/stats/* only',
      });
    }
  }
  return beta;
}

/**
 * The kiosk id to put on a stats payload.
 *
 * @param actual what `KioskService.kioskNum()` resolved for this machine —
 *               returned as-is on a production build.
 */
export function statsKioskNum(actual: number): number {
  return betaOnce() ? BETA_STATS_KIOSK_ID : actual;
}
