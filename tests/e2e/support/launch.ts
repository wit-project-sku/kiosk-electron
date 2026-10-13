// Launch the real app (built `out/`) for one kiosk site, wired to the fake backend.
//
// Every launch gets a fresh userData directory with kiosk-config.json pre-written, so
// the site is chosen exactly as on a kiosk (per-machine kioskId) and nothing touches a
// developer's real %APPDATA%. Third-party API keys are blanked: weather, exchange and
// flight services switch themselves off without a key. The camera is Chromium's fake
// device. The real card-terminal agent is skipped by the app's e2e hook.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

export const REPO_ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)));

/** Every location code in src/shared/config/kioskLocations.ts. */
export const SITES = [
  'W001',
  'W002',
  'W003',
  'W004',
  'W005',
  'W006',
  'W007',
  'W008',
  'W202',
] as const;
export type Site = (typeof SITES)[number];

export interface LaunchedKiosk {
  app: ElectronApplication;
  main: Page;
  /** Page errors and console.error lines from every window, for assertions. */
  errors: string[];
  userData: string;
  close: () => Promise<void>;
}

export interface LaunchOptions {
  site: Site;
  apiBase: string;
  /** Open the customer-display window even on a single monitor. */
  displayWindow?: boolean;
  /** Extra env (e.g. KIOSK_VIDEOS_DIR for the soak run). */
  env?: Record<string, string>;
  /** Reuse a userData directory from an earlier launch (e.g. to restart after a crash). */
  userData?: string;
  /** Leave userData on disk at close (the caller removes it). */
  keepUserData?: boolean;
}

/** Service URL overrides a developer .env might carry — blanked so nothing bypasses the fake. */
const URL_OVERRIDES = [
  'SHOP_API_URL',
  'BUTTONS_API_URL',
  'BANNERS_API_URL',
  'BACKGROUNDS_API_URL',
  'OUTFITS_API_URL',
  'OUTFIT_CATEGORIES_API_URL',
  'JEJU_ATTRACTIONS_API_URL',
  'SPOT_DIFF_API_URL',
  'EVENTS_API_URL',
  'JEJU_COURSE_API_URL',
  'JEJU_PICKER_API_URL',
  'INSA_COURSE_API_URL',
  'STATS_MENU_TOUCH_URL',
  'STATS_MENU_TOUCHES_SYNC_URL',
  'STATS_SHOTS_URL',
  'STATS_PHOTO_SHOTS_SYNC_URL',
  'UPDATE_COMMAND_API_URL',
  'FOOTFALL_API_URL',
];

export async function launchKiosk(opts: LaunchOptions): Promise<LaunchedKiosk> {
  const userData = opts.userData ?? mkdtempSync(join(tmpdir(), `kiosk-e2e-${opts.site}-`));
  writeFileSync(join(userData, 'kiosk-config.json'), JSON.stringify({ kioskId: opts.site }));

  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  for (const k of URL_OVERRIDES) env[k] = '';
  Object.assign(env, {
    KIOSK_E2E: '1',
    KIOSK_E2E_USER_DATA: userData,
    KIOSK_E2E_DISPLAY_WINDOW: opts.displayWindow ? '1' : '0',
    WITTERIA_API_BASE: opts.apiBase,
    PHOTO_PUBLIC_UPLOAD_URL: `${opts.apiBase}/api/images`,
    OPENWEATHER_API_KEY: '',
    EXIM_API_KEY: '',
    DATA_GO_KR_SERVICE_KEY: '',
    GOOGLE_SERVICE_ACCOUNT_JSON: '',
    HEIGHT_ENABLED: 'false',
    DEV_MODE: 'false',
    UPDATE_CHANNEL: 'latest',
    ...opts.env,
  });
  delete env['ELECTRON_RENDERER_URL']; // always load the built renderer from out/

  const app = await electron.launch({
    args: ['.', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    cwd: REPO_ROOT,
    env,
  });

  const errors: string[] = [];
  const watch = (page: Page): void => {
    const name = page.url().split('/').pop() ?? 'window';
    page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[${name}] console.error: ${m.text()}`);
    });
  };
  app.on('window', watch);

  const main = await findWindow(app, 'index.html');
  for (const w of app.windows()) watch(w);

  return {
    app,
    main,
    errors,
    userData,
    close: async () => {
      await app.close().catch(() => undefined);
      if (!opts.keepUserData) removeDir(userData);
    },
  };
}

/** Wait for the window whose URL ends with `file` (index.html = touch, display.html = customer). */
export async function findWindow(
  app: ElectronApplication,
  file: string,
  timeoutMs = 30_000,
): Promise<Page> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hit = app.windows().find((w) => w.url().endsWith(file));
    if (hit) {
      await hit.waitForLoadState('domcontentloaded');
      return hit;
    }
    await app.waitForEvent('window', { timeout: 1_000 }).catch(() => undefined);
  }
  throw new Error(`window ${file} did not open within ${timeoutMs} ms`);
}

/**
 * Best-effort removal of a test's temp dir. On Windows a just-killed Electron's child
 * processes can hold cache files for a moment (EPERM); a leftover temp dir must not
 * fail the test.
 */
export function removeDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch {
    // left for the OS temp cleaner
  }
}

/**
 * Kill the app the way a crash does — no before-quit. On Windows kill the whole process
 * tree: SIGKILL there ends only the main process and leaves renderer/GPU children behind.
 */
export function killHard(app: ElectronApplication): void {
  const pid = app.process().pid;
  if (pid === undefined) return;
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // already gone
    }
  } else {
    app.process().kill('SIGKILL');
  }
}
