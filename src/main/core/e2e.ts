/**
 * Hooks for the automated end-to-end tests (tests/e2e, Playwright `_electron`).
 *
 * Every hook is inert unless BOTH hold: the app is NOT packaged and `KIOSK_E2E=1`.
 * A kiosk always runs a packaged build, so nothing here can change fleet behaviour
 * even if the variable leaked into a kiosk's .env.
 */
import { app } from 'electron';

export function isE2E(): boolean {
  return !app.isPackaged && process.env['KIOSK_E2E'] === '1';
}

/**
 * Give each test run its own state directory (kiosk.db, kiosk-config.json, logs) so
 * runs never share or pollute a developer's real `%APPDATA%\kiosk-app`.
 * Must run before the logger and the single-instance lock resolve `userData`.
 */
export function applyE2EUserData(): string | null {
  const dir = process.env['KIOSK_E2E_USER_DATA'];
  if (!isE2E() || !dir) return null;
  app.setPath('userData', dir);
  return dir;
}

/** Open the customer-display window even with one monitor (it lands on the primary). */
export const e2eForcesDisplayWindow = (): boolean =>
  isE2E() && process.env['KIOSK_E2E_DISPLAY_WINDOW'] === '1';

/** Skip the real card-terminal agent; tests run a fake one on the loopback instead. */
export const e2eSkipsPaymentAgent = (): boolean => isE2E();

/** No detached DevTools window — it would be one more window for the test to sort out. */
export const e2eSuppressesDevTools = (): boolean => isE2E();
