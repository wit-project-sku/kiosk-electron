import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { appPaths } from '@main/core/paths';
import { createLogger } from '@main/core/logger';

const log = createLogger('remote-image-cache');

/**
 * Mirrors remote CMS images onto disk and serves them over `media://remote/`.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * The AR 한복체험 picker draws its outfit cards and 배경 테마 tiles straight from
 * the witteria URLs the API hands over. The catalogue JSON is cached in SQLite,
 * so switching tabs never re-fetches the DATA — but every tab change unmounts
 * and remounts the <img>s, and whether those cost a round trip was left entirely
 * to the upstream server's `Cache-Control`. When it does not send one worth
 * having, Chromium re-requests on every remount and the picker visibly reloads
 * each time a visitor changes tab or leaves and comes back.
 *
 * Two comments in this codebase asserted the opposite — that "Chromium's disk
 * cache keeps it offline after first paint" (BackgroundService) and that the
 * store's `prefetchOutfitImages` warms it durably. Neither is something we
 * control: both are a bet on a response header owned by someone else.
 *
 * So the bytes are copied here instead, and `localize()` rewrites the URL to
 * `media://remote/<sha1>.<ext>`. That scheme is served from local disk with
 * `Cache-Control: public, max-age=31536000, immutable` (see mediaProtocol), so
 * after the first sync the picker costs no network at all — which also makes
 * the offline promise both services already advertise actually true.
 *
 * ── Failure is always soft ─────────────────────────────────────────────────
 * `localize()` returns the REMOTE url unchanged when there is no local copy, so
 * a cold cache, a failed download or a pruned file degrades to exactly today's
 * behaviour rather than a broken image. Nothing here is on the path that shows
 * the picker; warming happens after a refresh has already been cached.
 */
export class RemoteImageCache {
  /** Basenames known to be on disk, so `localize()` stays sync and allocation-free. */
  private readonly present = new Set<string>();
  private loaded = false;

  /**
   * Resolved lazily rather than in the constructor: `appPaths` reads Electron's
   * userData, which is only valid once the app is ready, and the container is
   * built early enough for that to matter.
   */
  private get dir(): string {
    const dir = appPaths.remoteImages;
    if (!this.loaded) {
      this.loaded = true;
      try {
        for (const name of readdirSync(dir)) this.present.add(name);
        log.info('Remote image cache opened', { files: this.present.size });
      } catch (error) {
        log.warn('Could not read the remote image cache directory', error);
      }
    }
    return dir;
  }

  /**
   * The local URL for a remote image, or the remote one when nothing is cached.
   *
   * Safe to call on every list() — it is a Set lookup and a string join. Already
   * local (`media://`) and empty urls pass straight through, so calling it twice
   * on the same value is a no-op.
   */
  localize(remoteUrl: string): string {
    if (!remoteUrl || !/^https?:/i.test(remoteUrl)) return remoteUrl;
    const dir = this.dir;
    for (const ext of CANDIDATE_EXT) {
      const name = fileNameFor(remoteUrl, ext);
      if (this.present.has(name)) return `media://remote/${name}`;
    }
    void dir; // touched above to force the lazy directory read
    return remoteUrl;
  }

  /**
   * Download whatever is missing. Returns how many files were added.
   *
   * Fire-and-forget by design: callers run it after a refresh has ALREADY been
   * cached, so a total failure here costs nothing but the speed-up. Bounded
   * concurrency keeps a 100-outfit catalogue from opening 100 sockets on a
   * kiosk that is also fetching everything else at boot.
   */
  async warm(urls: readonly string[]): Promise<number> {
    const wanted = [...new Set(urls.filter((u) => u && /^https?:/i.test(u)))];
    const missing = wanted.filter((u) => this.localize(u) === u);
    if (missing.length === 0) return 0;

    let added = 0;
    let failed = 0;
    const queue = [...missing];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let url = queue.pop(); url; url = queue.pop()) {
        try {
          if (await this.store(url)) added += 1;
        } catch (error) {
          failed += 1;
          log.warn('Could not cache a remote image', {
            url,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });
    await Promise.all(workers);

    log.info('Remote image cache warmed', { added, failed, total: wanted.length });
    return added;
  }

  /**
   * Delete cached files nothing in `urls` refers to any more.
   *
   * The CMS retires outfits and background sets, and without this their images
   * would accumulate on a kiosk that never reinstalls. Only ever removes files
   * this cache wrote — the directory holds nothing else.
   */
  async prune(urls: readonly string[]): Promise<number> {
    const keep = new Set<string>();
    for (const url of urls) {
      if (!url || !/^https?:/i.test(url)) continue;
      for (const ext of CANDIDATE_EXT) keep.add(fileNameFor(url, ext));
    }

    let removed = 0;
    for (const name of [...this.present]) {
      if (keep.has(name)) continue;
      try {
        await unlink(join(this.dir, name));
        this.present.delete(name);
        removed += 1;
      } catch (error) {
        log.warn('Could not prune a cached image', { name, error });
      }
    }
    if (removed > 0) log.info('Pruned cached images the CMS no longer lists', { removed });
    return removed;
  }

  /** Fetch one image and write it. Returns false when the response is unusable. */
  private async store(url: string): Promise<boolean> {
    const res = await fetch(url);
    if (!res.ok) {
      log.warn('Remote image responded with an error status', { url, status: res.status });
      return false;
    }

    const type = res.headers.get('content-type') ?? '';
    // Guard against a login page or an error document being written as an
    // image: the picker would then draw a broken tile FOREVER, since the file
    // exists and localize() would happily point at it.
    if (!type.startsWith('image/')) {
      log.warn('Remote image was not an image', { url, type });
      return false;
    }

    const body = Buffer.from(await res.arrayBuffer());
    if (body.byteLength === 0) return false;

    const name = fileNameFor(url, extFor(url, type));
    const dir = this.dir;
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    await writeFile(join(dir, name), body);
    this.present.add(name);
    return true;
  }
}

/** How many downloads run at once during a warm. */
const CONCURRENCY = 6;

/**
 * Extensions `localize()` probes for a url.
 *
 * The name is `<hash-of-url><ext>` and the extension is only decided when the
 * file is DOWNLOADED (from its content-type), so a sync lookup cannot know it
 * without a probe. The list is short and the check is a Set hit, so probing all
 * of them costs less than keeping a second index in step with the directory.
 */
const CANDIDATE_EXT = ['.webp', '.jpg', '.png', '.gif', '.avif', '.bin'] as const;

const EXT_BY_MIME: Record<string, string> = {
  'image/webp': '.webp',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

/**
 * The extension to store a download under, preferring what the SERVER says it
 * is over what the url looks like — a CMS that serves `/photo.jpg` as webp is
 * the case that would otherwise be filed wrong and served with the wrong type.
 */
function extFor(url: string, contentType: string): string {
  const fromMime = EXT_BY_MIME[contentType.split(';')[0]!.trim().toLowerCase()];
  if (fromMime) return fromMime;
  try {
    const ext = extname(new URL(url).pathname).toLowerCase();
    if ((CANDIDATE_EXT as readonly string[]).includes(ext)) return ext;
  } catch {
    /* not a parseable url — fall through */
  }
  return '.bin';
}

/**
 * Cache file name for a url: its SHA-1 plus the extension.
 *
 * Hashed rather than derived from the path because CMS filenames collide across
 * folders, carry query strings and non-ASCII, and would otherwise need escaping
 * before they could be trusted as a path segment.
 */
function fileNameFor(url: string, ext: string): string {
  return createHash('sha1').update(url).digest('hex') + ext;
}
