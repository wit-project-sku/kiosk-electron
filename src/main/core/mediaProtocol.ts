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
 *   media://remote/<scope>/<sha1>.<ext> -> mirrored CMS image (RemoteImageCache)
 *
 * CORS / origin:
 *   `corsEnabled: true` is required with `supportFetchAPI` so remote webview
 *   pages cannot fetch() this scheme and read the body (GHSA-v3j7-r9gq-3gjw).
 *   The handler also rejects https origins (TAX-FREE / 위드마켓 / 기부), and the
 *   persist:embeds session is given a 403 stub so guests never hit disk.
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { Readable } from 'node:stream';
import { protocol, session, type CustomScheme } from 'electron';
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

    let size: number;
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error('not a file');
      size = info.size;
    } catch {
      log.warn('Media file not found', { url: request.url });
      return new Response('Not found', { status: 404 });
    }

    // Cache aggressively: kiosk media is immutable for the session and only
    // changes on sync/restart, so the renderer should never re-fetch from disk.
    const headers = new Headers();
    headers.set('Content-Type', contentTypeFor(filePath));
    headers.set('Accept-Ranges', 'bytes');
    headers.set(
      'Cache-Control',
      kind === 'video' ? 'public, max-age=86400' : 'public, max-age=31536000, immutable',
    );
    applyCors(headers, origin);

    // Answer the renderer's Range header so files are served as seekable
    // `206 Partial Content`. Without this, <video> is marked non-seekable and
    // the native `loop` attribute can't rewind → the clip pauses at the end
    // instead of replaying. (Dev works because Vite serves with range support.)
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      const range = parseRange(rangeHeader, size);
      if (!range) {
        headers.set('Content-Range', `bytes */${size}`);
        return new Response(null, { status: 416, headers });
      }
      headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
      headers.set('Content-Length', String(range.end - range.start + 1));
      return new Response(fileBody(filePath, range.start, range.end), { status: 206, headers });
    }

    headers.set('Content-Length', String(size));
    return new Response(size === 0 ? null : fileBody(filePath, 0, size - 1), {
      status: 200,
      headers,
    });
  } catch (error) {
    log.error('Failed to serve media', error);
    return new Response('Not found', { status: 404 });
  }
}

/**
 * An open-ended `Range: bytes=N-` is answered with the whole rest of the file:
 * Chromium's demuxer fails to open a clip ("FFmpegDemuxer: open context
 * failed") when the 206 is shorter than asked. That is safe now because the
 * body is a backpressured fs stream (see `fileBody`), not a buffered copy.
 */
function parseRange(header: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size === 0) return null;
  const [, rawStart, rawEnd] = match;
  let start: number;
  let end: number;
  if (rawStart === '') {
    // Suffix range: the last N bytes.
    if (rawEnd === '') return null;
    start = Math.max(0, size - Number(rawEnd));
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Math.min(size - 1, Number(rawEnd));
  }
  if (start >= size || start > end) return null;
  return { start, end };
}

/**
 * The body is read straight off disk. This used to be `net.fetch(file://…)`
 * piped through, but Electron's net response has no backpressure and keeps
 * reading after the renderer cancels: every <video> range request the media
 * stack abandons left the REST of the clip buffered in the main process. On
 * 인사동 (W001) the customer display swaps AI-model clips on every screen tap, so
 * by evening main ran out of ArrayBuffer memory ("Array buffer allocation
 * failed") and the kiosk died. An fs stream pauses on backpressure and is
 * destroyed when the web stream is cancelled.
 */
function fileBody(filePath: string, start: number, end: number): ReadableStream {
  return Readable.toWeb(createReadStream(filePath, { start, end })) as unknown as ReadableStream;
}

const CONTENT_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.vtt': 'text/vtt',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/** Must run after `app.whenReady()`. */
export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, serveMedia);

  // Webview guests (TAX-FREE / 위드마켓 / 기부) use this partition and never
  // need local media. A 403 stub beats relying on CORS alone.
  session.fromPartition('persist:embeds').protocol.handle(MEDIA_SCHEME, () => forbidden());
}
