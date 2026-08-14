/**
 * Secure `appres://` protocol for the app's own bundled runtime assets.
 *
 *   appres://mediapipe/<file>   -> resources/mediapipe/<file>
 *
 * ── Why a second scheme instead of reusing `media://` ────────────────────
 * The MediaPipe vision runtime cannot be loaded the way the rest of the
 * renderer's assets are. `FilesetResolver` injects a <script> for the WASM
 * loader and then `fetch()`es the 9.5 MB `.wasm` beside it, and in a packaged
 * build the renderer is served from `file://` — where Chromium refuses both.
 * So the bytes have to come from a scheme registered as `standard + secure +
 * supportFetchAPI`, and the CSP has to name that scheme in `script-src` and
 * `connect-src` (see `security.ts`).
 *
 * `media://` already qualifies, but it serves the USER-DATA directories: the
 * synced image library, thumbnails, saved photos. Naming it in `script-src`
 * would make every file that lands in those folders script-loadable. `appres://`
 * is deliberately narrower — read-only, install-directory, and confined to an
 * explicit allowlist of subdirectories — so widening the CSP widens it by
 * exactly the files this app ships and nothing else.
 */

import { join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { net, protocol, type CustomScheme } from 'electron';
import { appPaths } from './paths';
import { createLogger } from './logger';

const log = createLogger('appres-protocol');

export const APP_RESOURCE_SCHEME = 'appres';

/**
 * Subdirectories of the install `resources/` folder this scheme will serve.
 * Anything else 403s, so a future `extraResources` entry (secrets, .env, the
 * provisioning scripts) can never be reached from the renderer by accident.
 */
const ALLOWED_ROOTS = new Set(['mediapipe']);

/**
 * Privileges this scheme needs. Registered together with `media://` in the
 * single `registerSchemesAsPrivileged` call in `main/index.ts` — see the note on
 * MEDIA_SCHEME_PRIVILEGES for why it must be one call and not two.
 *
 * `supportFetchAPI` is the load-bearing one: the WASM runtime fetches its own
 * `.wasm`, and `standard` + `secure` are what make the injected loader script a
 * trustworthy same-site resource rather than an opaque one.
 */
export const APP_RESOURCE_SCHEME_PRIVILEGES: CustomScheme = {
  scheme: APP_RESOURCE_SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
};

/** Must run after `app.whenReady()`. */
export function registerAppResourceProtocol(): void {
  protocol.handle(APP_RESOURCE_SCHEME, async (request) => {
    try {
      const url = new URL(request.url);
      const root = url.hostname; // 'mediapipe'
      if (!ALLOWED_ROOTS.has(root)) {
        log.warn('Blocked appres request outside the allowlist', { url: request.url });
        return new Response('Forbidden', { status: 403 });
      }

      const baseDir = join(appPaths.bundled, root);
      const fileName = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const filePath = normalize(join(baseDir, fileName));
      if (!filePath.startsWith(baseDir + sep)) {
        log.warn('Blocked appres path traversal attempt', { url: request.url });
        return new Response('Forbidden', { status: 403 });
      }

      const upstream = await net.fetch(pathToFileURL(filePath).toString());
      if (!upstream.ok) {
        // Almost always a packaging miss (the vendor step never ran). Log the
        // resolved path — "404 on appres://mediapipe/..." alone doesn't say
        // WHERE it looked, and the dev and packaged roots differ.
        log.warn('Bundled resource not found', { url: request.url, filePath });
        return new Response('Not found', { status: 404 });
      }

      const headers = new Headers(upstream.headers);
      // Install-directory assets only change when the app updates, and an update
      // replaces the whole renderer anyway.
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    } catch (error) {
      log.error('Failed to serve bundled resource', error);
      return new Response('Not found', { status: 404 });
    }
  });
}
