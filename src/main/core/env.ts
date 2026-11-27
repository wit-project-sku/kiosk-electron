import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Minimal `.env` loader for the main process.
 *
 * In development the working directory is the project root, so a `.env` file
 * placed there is picked up automatically (e.g. `OPENWEATHER_API_KEY=...`).
 * In production, deployment is expected to set real OS environment variables;
 * if no `.env` exists this is a no-op. Existing process.env values always win.
 */
export function loadEnvFile(): void {
  const paths = [resolve(process.cwd(), '.env')];
  if (process.resourcesPath) paths.push(resolve(process.resourcesPath, '.env'));
  for (const path of paths) loadFrom(path);
  migrateRetiredDomain(process.env);
}

/** The service domain that expired on 2026-11-25 and its replacement (same subdomains). */
export const RETIRED_DOMAIN = 'witteria.com';
export const CURRENT_DOMAIN = 'witmarket.net';

/**
 * Rewrites every env value that still names the retired domain to the current one.
 *
 * The installer's `.env` is baked from the GitHub Environment secret `KIOSK_ENV`,
 * which still carries `witteria.com` URLs (API base, photo upload, payment CORS …).
 * Those values override the code defaults, so without this the kiosk keeps calling
 * a domain that no longer resolves. Subdomains are identical on the new domain,
 * so a plain substitution is exact. Returns the keys it changed.
 */
export function migrateRetiredDomain(env: NodeJS.ProcessEnv): string[] {
  const changed: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string' && value.includes(RETIRED_DOMAIN)) {
      env[key] = value.split(RETIRED_DOMAIN).join(CURRENT_DOMAIN);
      changed.push(key);
    }
  }
  return changed;
}

/**
 * Operator "dev mode" — `DEV_MODE=true` in the `.env` next to the app.
 *
 * Purely a testing affordance: it surfaces the in-app kiosk-location switcher
 * (see KioskSwitcher) so a tester can move one installed build between W001–W005
 * without the external tools/location-tester script. Because it is read from the
 * env file at every launch, flipping it needs an app restart, not a rebuild.
 * Absent/empty (the production default) = off.
 */
export function isDevMode(): boolean {
  const value = (process.env['DEV_MODE'] ?? '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function loadFrom(path: string): void {
  if (!existsSync(path)) return;

  try {
    const text = readFileSync(path, 'utf-8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!match) continue; // skips blanks and `#` comments
      const key = match[1]!;
      let value = match[2]!.trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* env file is best-effort; ignore parse/read errors */
  }
}
