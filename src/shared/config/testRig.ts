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
 *
 * STAGE builds (2026-11-03): any machine whose API base is a stage server may use
 * the same `previewSite` — e.g. the office PC provisioned W008 keeps W008 as its
 * identity (update-command, crash reports, power schedule, photo archive) and
 * shows whichever site is picked in the switcher. A production API base ignores
 * `previewSite` entirely, so a value left behind in kiosk-config.json can never
 * move a live venue.
 */
import { KIOSK_LOCATIONS, type KioskLocationCode } from './kioskLocations';

export const TEST_RIG_KIOSK_ID = 'W200';

/**
 * Office PCs (2026-11-27): kiosks the server has a number for that are not venues.
 * Each works like the test rig above — it keeps its own number as its identity
 * (signals, crash reports, power schedule, stats — the server excludes them) and
 * shows whichever site is picked with the pin. Listed so the 지점 설정 window
 * offers every kiosk number the server knows.
 *
 * `stageOnly`: 10 is the HQ 1-monitor PC only on a server that has the V224
 * renumber (stage); on production 10 is still 세계자연유산본부, so a production
 * build does not offer it.
 */
export type OfficePcCode = 'W006' | 'W010' | 'W200' | 'W201';

export interface OfficePc {
  code: OfficePcCode;
  name: string;
  stageOnly?: true;
}

export const OFFICE_PCS: readonly OfficePc[] = [
  { code: 'W006', name: 'WITH-I-001 (사무실·행사)' },
  { code: 'W010', name: '사무실 1개모니터 (HQ)', stageOnly: true },
  { code: TEST_RIG_KIOSK_ID, name: '사무실 테스트기 · 2개모니터 (HQ)' },
  { code: 'W201', name: '사무실 3개모니터 (HQ)' },
];

/** An office PC (OFFICE_PCS) — keeps its number and previews any site. */
export const isOfficePc = (code: string | undefined): code is OfficePcCode =>
  !!code && OFFICE_PCS.some((pc) => pc.code === code);
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
  opts: { stageServer?: boolean } = {},
): ResolvedKioskIdentity {
  if (!isOfficePc(storedId)) {
    // Stage only: a provisioned venue machine keeps its identity and shows the
    // preview site. Without a (valid) preview it is simply itself.
    const kioskId = opts.stageServer && isPreviewSite(previewSite) ? previewSite : storedId;
    return { kioskId, identityKioskId: storedId, testRig: false };
  }
  return {
    kioskId: isPreviewSite(previewSite) ? previewSite : DEFAULT_PREVIEW_SITE,
    identityKioskId: storedId,
    testRig: true,
  };
}

/** Numeric id from a kiosk code ("W004" → 4, "W200" → 200), falling back to 1. */
export function kioskNumOf(code: string): number {
  const digits = (code.match(/\d+/)?.[0] ?? '1').replace(/^0+/, '');
  const n = Number(digits || '1');
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Does this API base point at a STAGE server? True when one of the host's labels
 * is `stage` (`api-stage-v3.witmarket.net` → `api`, `stage`, `v3`, …). The API base
 * is the one setting that literally says which servers a build talks to: the
 * update channel does not (the kdh lane builds `kdh` for BOTH stage and
 * production servers), and DEV_MODE is off on kdh-stage builds.
 */
export function isStageApiBase(apiBase: string): boolean {
  try {
    return new URL(apiBase).hostname.toLowerCase().split(/[.-]/).includes('stage');
  } catch {
    return false;
  }
}

/** What a site-switch request should write to kiosk-config.json. */
export type SiteSwitchPlan =
  | { kind: 'none' }
  /** Test rig or stage machine: keep the identity, show `site`. */
  | { kind: 'preview'; site: string }
  /** Stage machine choosing its own site again: drop `previewSite`. */
  | { kind: 'clearPreview' }
  /** Dev mode on a non-stage build: become `site` (the original switcher). */
  | { kind: 'kioskId'; site: string }
  | { kind: 'denied' };

export function planSiteSwitch(
  cfg: { kioskId: string; identityKioskId?: string; testRig?: boolean; stageServer?: boolean },
  site: string,
  devMode: boolean,
): SiteSwitchPlan {
  const testRig = cfg.testRig === true;
  const stage = cfg.stageServer === true;
  if (!devMode && !testRig && !stage) return { kind: 'denied' };
  if (site === cfg.kioskId) return { kind: 'none' };
  if (testRig) return { kind: 'preview', site };
  if (stage) {
    const identity = cfg.identityKioskId ?? cfg.kioskId;
    return site === identity ? { kind: 'clearPreview' } : { kind: 'preview', site };
  }
  return { kind: 'kioskId', site };
}
