/**
 * The office test kiosk (DB kiosk 200, "#P002-HQ") — one machine that must be able to
 * run EVERY site's app.
 *
 * Its provisioned kioskId is `W200`. That is its IDENTITY: the server sees kiosk 200
 * on the 5-minute signal and in crash reports, and its power schedule is the plain
 * default — so it never poses as a real venue (posing as W004 would mix its signals
 * into 오색시장's monitoring). WHICH site's app it shows is a separate, switchable
 * `previewSite` (W001…W202): every location-derived value — layout, content region,
 * weather coordinates, theme — follows the preview site.
 */
import { KIOSK_LOCATIONS, type KioskLocationCode } from './kioskLocations';

export const TEST_RIG_KIOSK_ID = 'W200';
/** What a freshly provisioned test rig shows until someone switches it. */
export const DEFAULT_PREVIEW_SITE: KioskLocationCode = 'W001';

export interface ResolvedKioskIdentity {
  /** Location-derived kiosk id (the preview site on the test rig, else the kiosk itself). */
  kioskId: string;
  /** Who this machine is to the server (W200 on the test rig). */
  identityKioskId: string;
  testRig: boolean;
}

export const isPreviewSite = (code: string | undefined): code is KioskLocationCode =>
  !!code && Object.prototype.hasOwnProperty.call(KIOSK_LOCATIONS, code);

export function resolveKioskIdentity(
  storedId: string,
  previewSite?: string,
): ResolvedKioskIdentity {
  if (storedId !== TEST_RIG_KIOSK_ID) {
    return { kioskId: storedId, identityKioskId: storedId, testRig: false };
  }
  return {
    kioskId: isPreviewSite(previewSite) ? previewSite : DEFAULT_PREVIEW_SITE,
    identityKioskId: TEST_RIG_KIOSK_ID,
    testRig: true,
  };
}

/** Numeric id from a kiosk code ("W004" → 4, "W200" → 200), falling back to 1. */
export function kioskNumOf(code: string): number {
  const digits = (code.match(/\d+/)?.[0] ?? '1').replace(/^0+/, '');
  const n = Number(digits || '1');
  return Number.isFinite(n) && n > 0 ? n : 1;
}
