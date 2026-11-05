/**
 * 지점 설정 — choosing which site a PC is, from a screen instead of a terminal.
 *
 * Until 2026-11 a PC learned its site from `provision-kiosk` (a command writing
 * `kioskId` into kiosk-config.json), and a PC nobody provisioned silently booted
 * as W001 북인사마당 — its shots and touches landing in 북인사's numbers. Now:
 *
 *  - a FRESH machine (nothing in kiosk-config.json and no kiosk.db yet — this app
 *    has never run here) opens the setup screen and nothing else until a site is
 *    picked (`required`);
 *  - the installer's desktop shortcut starts the app with {@link SETUP_ARG}, which
 *    opens the same screen over a running kiosk (`requested`). It lives on the
 *    Windows desktop, behind the fullscreen kiosk window, so only staff at a
 *    keyboard or on TeamViewer reach it — never a visitor's finger.
 *
 * A machine that has run before keeps booting exactly as it did, provisioned or
 * not: "never configured" alone is not enough to stop a working kiosk.
 */
import { KIOSK_LOCATIONS, type KioskLocationCode } from './kioskLocations';
import { TEST_RIG_KIOSK_ID, kioskNumOf } from './testRig';

/** `required` = fresh machine, nothing else until a site is chosen; `requested` = opened on purpose. */
export type KioskSetupState = 'required' | 'requested';

/** Command-line switch the desktop shortcut passes. */
export const SETUP_ARG = '--setup';

export type SetupSiteCode = KioskLocationCode | typeof TEST_RIG_KIOSK_ID;

export interface SetupSite {
  code: SetupSiteCode;
  name: string;
  /** The office test kiosk: keeps id 200 and previews any site (testRig.ts). */
  testRig: boolean;
  hasCardTerminal: boolean;
  hasDonation: boolean;
}

/** Every site a PC can be set to, in kiosk order, then the office test kiosk. */
export const SETUP_SITES: readonly SetupSite[] = [
  ...Object.values(KIOSK_LOCATIONS).map((loc) => ({
    code: loc.code,
    name: loc.name,
    testRig: false,
    hasCardTerminal: loc.hasCardTerminal,
    hasDonation: loc.hasDonation,
  })),
  {
    code: TEST_RIG_KIOSK_ID,
    name: '사무실 테스트기 (HQ)',
    testRig: true,
    hasCardTerminal: false,
    hasDonation: false,
  },
];

export function isSetupSite(code: string): code is SetupSiteCode {
  return SETUP_SITES.some((site) => site.code === code);
}

/** The number staff type to confirm — the code without its letter: W008 → "008". */
export function confirmCodeOf(code: SetupSiteCode): string {
  return code.replace(/^\D+/, '');
}

/** True when `typed` names the same kiosk number ("008" or "8" for W008). */
export function confirmMatches(code: SetupSiteCode, typed: string): boolean {
  const digits = typed.trim();
  return /^\d+$/.test(digits) && Number(digits) === kioskNumOf(code);
}

/**
 * Decided once per launch, BEFORE the database is opened (opening it creates
 * kiosk.db, which would make every machine look like it had run before) and
 * before the first config read (which stores the 제주 renumber flag).
 */
export function setupStateFor(input: {
  /** Keys already in kiosk-config.json. */
  storedKeys: number;
  /** kiosk.db existed before this launch. */
  databaseExists: boolean;
  argv: readonly string[];
}): KioskSetupState | null {
  if (input.storedKeys === 0 && !input.databaseExists) return 'required';
  if (input.argv.includes(SETUP_ARG)) return 'requested';
  return null;
}

/** Relaunch arguments without the setup switch, so the restarted app opens normally. */
export function withoutSetupArg(args: readonly string[]): string[] {
  return args.filter((arg) => arg !== SETUP_ARG);
}
