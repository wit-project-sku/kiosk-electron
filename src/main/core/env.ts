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
