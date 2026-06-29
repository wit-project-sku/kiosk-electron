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
 *   media://app/<bundledPath>          -> file from the renderer bundle
 *                                         (e.g. mediapipe/* — fetch()-able under
 *                                         the file:// production origin)
 */

import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { net, protocol } from 'electron';
import { appPaths } from './paths';
import { RENDERER_DIR } from '../windows/windowConfig';
import { createLogger } from './logger';

const log = createLogger('media-protocol');

export const MEDIA_SCHEME = 'media';

/** MIME types for renderer-bundle (`media://app/*`) files. */
function contentTypeFor(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.wasm':
      return 'application/wasm';
    case '.js':
    case '.mjs':
      return 'text/javascript';
    case '.json':
      return 'application/json';
    case '.tflite':
    default:
      return 'application/octet-stream';
  }
}

/** Must run before `app.whenReady()`. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ]);
}

function resolveSafe(baseDir: string, fileName: string): string | null {
  const target = normalize(join(baseDir, fileName));
  // Reject anything that escapes the intended directory.
  if (!target.startsWith(baseDir + sep) && target !== baseDir) return null;
  return target;
}

/** Must run after `app.whenReady()`. */
export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    try {
      const url = new URL(request.url);
      const kind = url.hostname; // 'asset' | 'thumb' | 'generated' | 'video' | 'app'
      const fileName = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const baseDir =
        kind === 'thumb'
          ? appPaths.thumbnails
          : kind === 'generated'
            ? appPaths.generated
            : kind === 'video'
              ? appPaths.videos
              : kind === 'app'
                ? RENDERER_DIR
                : appPaths.media;

      const filePath = resolveSafe(baseDir, fileName);
      if (!filePath) {
        log.warn('Blocked media path traversal attempt', { url: request.url });
        return new Response('Forbidden', { status: 403 });
      }

      // Renderer-bundle files (MediaPipe wasm/model) live inside app.asar in
      // production, where net.fetch(file://) is unreliable. Read them with the
      // asar-aware fs and serve with the right MIME — the .wasm in particular
      // needs `application/wasm` so WebAssembly can stream-compile it.
      if (kind === 'app') {
        const bytes = await readFile(filePath);
        return new Response(bytes, {
          status: 200,
          headers: {
            'Content-Type': contentTypeFor(filePath),
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
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
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    } catch (error) {
      log.error('Failed to serve media', error);
      return new Response('Not found', { status: 404 });
    }
  });
}
