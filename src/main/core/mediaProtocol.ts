/**
 * Secure `media://` protocol for serving locally-stored images and videos.
 *
 * With `webSecurity` enabled, the renderer cannot load `file://` URLs from an
 * http(s)/app origin. Rather than weaken security, we register a custom,
 * privileged scheme that streams files ONLY from the app's media and thumbnail
 * directories, with path-traversal protection.
 *
 *   media://asset/<storedFileName>     -> original media file
 *   media://thumb/<storedFileName>     -> generated thumbnail
 *   media://generated/<storedFileName> -> AI photo result
 *   media://remote/<sha1>.<ext>        -> mirrored CMS image (RemoteImageCache)
 *
 * CORS / origin:
 *   `corsEnabled: true` is required with `supportFetchAPI` so remote webview
 *   pages cannot fetch() this scheme and read the body (GHSA-v3j7-r9gq-3gjw).
 *   The handler also rejects https origins (TAX-FREE / 위드마켓 / 기부), and the
 *   persist:embeds session is given a 403 stub so guests never hit disk.
 */

import { join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { net, protocol, session, type CustomScheme } from 'electron';
import { appPaths } from './paths';
import { createLogger } from './logger';

const log = createLogger('media-protocol');

export const MEDIA_SCHEME = 'media';

function forbidden(): Response {
  return new Response('Forbidden', { status: 403 });
}

/**
 * Privileges this scheme needs. Registered together with `appres://` in the
 * single `registerSchemesAsPrivileged` call in `main/index.ts`.
 *
 * `corsEnabled: true` is required with `supportFetchAPI` so remote webview
 * pages cannot fetch() this scheme and read the body (GHSA-v3j7-r9gq-3gjw).
 */
export const MEDIA_SCHEME_PRIVILEGES: CustomScheme = {
  scheme: MEDIA_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true,
    corsEnabled: true,
  },
};

function resolveSafe(baseDir: string, fileName: string): string | null {
  const target = normalize(join(baseDir, fileName));
  // Reject anything that escapes the intended directory.
  if (!target.startsWith(baseDir + sep) && target !== baseDir) return null;
  return target;
}

/**
 * Remote webview origins (https://wit.linktaxfree.com, witteria.com, …) must
 * not read local media. The kiosk windows are file:// in production and the
 * Vite dev server on localhost — those either omit Origin, send `null`, or
 * use a loopback http origin.
 */
function isBlockedOrigin(origin: string | null): boolean {
  if (!origin || origin === 'null') return false;
  if (origin.startsWith('file:')) return false;
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return false;
  }
  return true;
}

/**
 * `corsEnabled: true` makes Chromium enforce CORS on media://. The kiosk
 * windows (Vite in dev, file:// in prod) must be echoed back or <video>/<img>
 * from Customer Display fail to decode. Webview origins never reach here.
 */
function applyCors(headers: Headers, origin: string | null): void {
  if (!origin) return;
  const allow = origin === 'null' ? 'null' : origin;
  headers.set('Access-Control-Allow-Origin', allow);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Headers', 'Range');
  headers.set(
    'Access-Control-Expose-Headers',
    'Accept-Ranges, Content-Length, Content-Range, Content-Type',
  );
}

async function serveMedia(request: Request): Promise<Response> {
  try {
    const origin = request.headers.get('origin');
    if (isBlockedOrigin(origin)) {
      log.warn('Blocked media:// from foreign origin', { origin, url: request.url });
      return forbidden();
    }

    if (request.method === 'OPTIONS') {
      const preflight = new Headers();
      applyCors(preflight, origin);
      return new Response(null, { status: 204, headers: preflight });
    }

    const url = new URL(request.url);
    const kind = url.hostname; // 'asset' | 'thumb' | 'generated' | 'video' | 'remote'
    const fileName = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const baseDir =
      kind === 'thumb'
        ? appPaths.thumbnails
        : kind === 'generated'
          ? appPaths.generated
          : kind === 'video'
            ? appPaths.videos
            : kind === 'remote'
              ? appPaths.remoteImages
              : appPaths.media;

    const filePath = resolveSafe(baseDir, fileName);
    if (!filePath) {
      log.warn('Blocked media path traversal attempt', { url: request.url });
      return forbidden();
    }

    // Forward the renderer's Range header so files are served as seekable
    // `206 Partial Content`. Without this, <video> is marked non-seekable and
    // the native `loop` attribute can't rewind → the clip pauses at the end
    // instead of replaying. (Dev works because Vite serves with range support.)
    const range = request.headers.get('range');
    const upstream = await net.fetch(
      pathToFileURL(filePath).toString(),
      range ? { headers: { Range: range } } : undefined,
    );
    // Cache aggressively: kiosk media is immutable for the session and only
    // changes on sync/restart, so the renderer should never re-fetch from disk.
    const headers = new Headers(upstream.headers);
    headers.set('Accept-Ranges', 'bytes');
    headers.set(
      'Cache-Control',
      kind === 'video' ? 'public, max-age=86400' : 'public, max-age=31536000, immutable',
    );
    applyCors(headers, origin);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch (error) {
    log.error('Failed to serve media', error);
    return new Response('Not found', { status: 404 });
  }
}

/** Must run after `app.whenReady()`. */
export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, serveMedia);

  // Webview guests (TAX-FREE / 위드마켓 / 기부) use this partition and never
  // need local media. A 403 stub beats relying on CORS alone.
  session.fromPartition('persist:embeds').protocol.handle(MEDIA_SCHEME, () => forbidden());
}
