import type { SpotDiffRound, SpotDiffSpot } from '@shared/types/spotDiff';
import { createLogger } from '@main/core/logger';
import type { LocalCacheService } from '@main/services/LocalCacheService';
import { buildPlaceholderRound } from './spotDiff/placeholderRound';

const log = createLogger('spotdiff-service');
const CACHE_KEY = 'spot_diff_rounds';
const DEFAULT_API_BASE = 'https://api-v3.witteria.com';

/**
 * 틀린그림찾기 rounds for the AR 한복 waiting game (제주 W006).
 *
 * Same shape as BannerService/ShopService: pull on launch and at the nightly
 * sync, cache in SQLite, serve from cache so the kiosk is instant and works
 * with the network down.
 *
 * ── The endpoint ──────────────────────────────────────────────────────
 *   GET {base}/api/games/spot-difference/puzzles
 *   { success, code, message, data: [
 *       { puzzleId, imageAUrl, imageBUrl, diffs: [{ x, y, radius }] } ] }
 *
 * Note it is NOT kiosk-scoped, unlike banners/buttons/shops — one puzzle set
 * serves every machine, so there is no kioskNum in the path.
 *
 * `diffs` already arrive in exactly the units the game wants: x/y in 0..1 and
 * radius as a fraction of image WIDTH. So the happy path here is a rename, not
 * a conversion. `normalizeRound` still accepts the alternative field names and
 * pixel/bounding-box forms — that costs nothing and means a CMS-side change of
 * shape degrades to a logged warning instead of a dead game.
 *
 * What the API does NOT send is the image DIMENSIONS, and the hit test needs
 * the aspect (radius is width-relative, so the vertical axis has to be scaled
 * by it). The renderer measures `naturalWidth/naturalHeight` while it prefetches
 * the images and corrects `aspect` then — see useSpotDiffRound. The value set
 * here is only a placeholder for the gap before the first image decodes.
 *
 * ── Fetching happens EARLY, never during the wait ─────────────────────
 * The list is pulled at launch and at the nightly sync, then served from SQLite.
 * The 60s AI wait is the worst possible moment to touch the network — the photo
 * upload and the synthesis request are in flight — so a fetch there would either
 * leave the game blank or slow the photo down. The renderer likewise warms the
 * IMAGES at the start of the photo session (outfit selection), well before the
 * capture, so nothing but a cache read happens once generation starts.
 *
 * Env:
 *   SPOT_DIFF_API_URL   — full endpoint override (wins if set)
 *   WITTERIA_API_BASE   — shared API base, default https://api-v3.witteria.com
 */
export class SpotDiffService {
  /**
   * Rotates the placeholder scene per call so two visitors in a row don't play
   * an identical board. Only used when there is no CMS content.
   */
  private placeholderSeed = 1;

  // No KioskService here, unlike the sibling services — the puzzle endpoint is
  // global rather than per-kiosk, so there is no kioskNum to resolve.
  constructor(private readonly cache: LocalCacheService) {}

  private baseUrl(): string {
    if (process.env['SPOT_DIFF_API_URL']) return process.env['SPOT_DIFF_API_URL'];
    const base = (process.env['WITTERIA_API_BASE'] || DEFAULT_API_BASE).replace(/\/+$/, '');
    return `${base}/api/games/spot-difference/puzzles`;
  }

  /** Cached rounds from the last successful refresh. Empty until first sync. */
  list(): SpotDiffRound[] {
    const cached = this.cache.get(CACHE_KEY);
    const rounds = cached?.data?.['rounds'];
    return Array.isArray(rounds) ? (rounds as SpotDiffRound[]) : [];
  }

  /**
   * One round to play. Picks a cached CMS round at random; falls back to
   * generated art when the CMS has nothing usable — the game must never fail to
   * start, because the AI photo it is covering for is already generating.
   */
  pickRound(): SpotDiffRound {
    const rounds = this.list();
    if (rounds.length > 0) {
      const round = rounds[Math.floor(Math.random() * rounds.length)];
      if (round) return round;
    }
    this.placeholderSeed += 1;
    return buildPlaceholderRound(this.placeholderSeed);
  }

  /** Pull the puzzle list and cache it. Returns the count stored. */
  async refresh(): Promise<number> {
    const url = this.baseUrl();
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as unknown;
      const raw = extractList(json);
      const rounds = raw
        .map((entry, i) => normalizeRound(entry, i))
        .filter((r): r is SpotDiffRound => r !== null);

      if (raw.length > 0 && rounds.length === 0) {
        // Loud on purpose: a 200 with rows we cannot read is the exact failure
        // this normalizer exists to absorb, and it would otherwise look
        // identical to "the CMS has no rounds yet" (silent placeholder art).
        log.warn('Spot-diff API returned rows but none were usable — check the field names', {
          url,
          received: raw.length,
        });
      }

      this.cache.upsert(CACHE_KEY, { rounds }, 'api');
      log.info('Spot-diff rounds cached', { url, count: rounds.length });
      return rounds.length;
    } catch (error) {
      // Keep whatever is cached; the game falls back to generated art anyway.
      log.warn('Spot-diff refresh failed — keeping cached rounds', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.list().length;
    }
  }
}

/** Unwrap the list from the envelopes the witteria API is known to use. */
function extractList(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== 'object') return [];
  const obj = json as Record<string, unknown>;
  for (const key of ['data', 'rounds', 'items', 'list', 'result']) {
    const value = obj[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const nested = extractList(value);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

/** First present, non-empty string among `keys`. */
function str(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

/** First present, finite number among `keys`. */
function num(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

// First entry in each list is the live API's own field name; the rest are
// tolerated alternatives.
const ORIGINAL_KEYS = ['imageAUrl', 'originalUrl', 'original', 'beforeUrl', 'before', 'imageUrl', 'imageA', 'leftImage', 'firstImage'];
const MODIFIED_KEYS = ['imageBUrl', 'modifiedUrl', 'modified', 'afterUrl', 'after', 'answerUrl', 'imageB', 'rightImage', 'secondImage'];
const SPOT_LIST_KEYS = ['diffs', 'spots', 'differences', 'answers', 'points', 'coords', 'areas'];
const ID_KEYS = ['puzzleId', 'id', 'roundId', 'uuid', 'key'];

function normalizeRound(entry: unknown, index: number): SpotDiffRound | null {
  if (!entry || typeof entry !== 'object') return null;
  const obj = entry as Record<string, unknown>;

  const originalUrl = str(obj, ORIGINAL_KEYS);
  const modifiedUrl = str(obj, MODIFIED_KEYS);
  if (!originalUrl || !modifiedUrl) return null;

  const rawSpots = SPOT_LIST_KEYS.map((k) => obj[k]).find((v): v is unknown[] => Array.isArray(v));
  if (!rawSpots || rawSpots.length === 0) return null;

  // Pixel coordinates need the image box to divide by. Missing dimensions are
  // only fatal when the values actually look like pixels — see normalizeSpot.
  const imgW = num(obj, ['imageWidth', 'width', 'w']);
  const imgH = num(obj, ['imageHeight', 'height', 'h']);

  const spots = rawSpots
    .map((s, i) => normalizeSpot(s, i, imgW, imgH))
    .filter((s): s is SpotDiffSpot => s !== null);
  if (spots.length === 0) return null;

  const aspect = imgW && imgH && imgH > 0 ? imgW / imgH : num(obj, ['aspect', 'aspectRatio']) ?? 4 / 3;

  return {
    id: str(obj, ID_KEYS) ?? num(obj, ID_KEYS)?.toString() ?? `round-${index}`,
    title: str(obj, ['title', 'name', 'caption']),
    originalUrl,
    modifiedUrl,
    aspect: aspect > 0 ? aspect : 4 / 3,
    spots,
  };
}

/**
 * A spot may arrive as a centre+radius or as a bounding box, in normalized or
 * pixel units. Anything above 1.5 on either axis is treated as pixels — no
 * normalized coordinate can exceed 1, and the margin keeps a sloppy 1.02 from
 * being misread as two pixels.
 */
function normalizeSpot(
  entry: unknown,
  index: number,
  imgW: number | null,
  imgH: number | null,
): SpotDiffSpot | null {
  if (!entry || typeof entry !== 'object') return null;
  const obj = entry as Record<string, unknown>;

  const boxW = num(obj, ['width', 'w']);
  const boxH = num(obj, ['height', 'h']);
  const left = num(obj, ['left', 'x1', 'minX']);
  const top = num(obj, ['top', 'y1', 'minY']);

  let x = num(obj, ['x', 'cx', 'centerX', 'centreX']);
  let y = num(obj, ['y', 'cy', 'centerY', 'centreY']);
  // Box form: the centre is derivable, and it is the box that carries position.
  if ((x === null || y === null) && left !== null && top !== null && boxW !== null && boxH !== null) {
    x = left + boxW / 2;
    y = top + boxH / 2;
  }
  if (x === null || y === null) return null;

  // Radius: explicit, else half the box's LONGER side so a wide difference
  // stays fully tappable rather than only its middle third.
  let r = num(obj, ['r', 'radius', 'rad']);
  if (r === null && boxW !== null && boxH !== null) r = Math.max(boxW, boxH) / 2;
  if (r === null) r = 0;

  const looksLikePixels = x > 1.5 || y > 1.5 || r > 1.5;
  if (looksLikePixels) {
    if (!imgW || !imgH || imgW <= 0 || imgH <= 0) {
      log.warn('Spot has pixel coordinates but the round carries no image size — dropped', {
        index,
        x,
        y,
      });
      return null;
    }
    x /= imgW;
    y /= imgH;
    r /= imgW;
  }

  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  // A zero/absent radius would make the difference untappable. 0.055 of width
  // matches the generated round and is comfortably above a fingertip at 2160px.
  const radius = r > 0.005 ? r : 0.055;

  return { id: str(obj, ['id', 'spotId', 'key']) ?? `spot-${index}`, x, y, r: radius };
}
