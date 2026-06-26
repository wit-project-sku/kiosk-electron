/**
 * Videos played on the 2nd monitor (customer display) when the photo workflow
 * is not active.
 *
 * The files are large, so they are NOT bundled — they ship as electron-builder
 * extraResources (resources/videos/<set>/) and stream at runtime through the
 * `media://video/<set>/<name>` protocol (see src/main/core/mediaProtocol.ts).
 * Add files under resources/videos/insadong|osaek and run `npm run sync:videos`.
 */
import { VIDEO_FILES_INSADONG, VIDEO_FILES_OSAEK } from './manifest';

type VideoSet = 'insadong' | 'osaek';

/** Generic-wall fallback URLs for a kiosk's video set (W004 → osaek). */
export function displayVideosFor(kioskId?: string): string[] {
  const set: VideoSet = kioskId === 'W004' ? 'osaek' : 'insadong';
  const files = set === 'osaek' ? VIDEO_FILES_OSAEK : VIDEO_FILES_INSADONG;
  return files.map((name) => `media://video/${set}/${encodeURIComponent(name)}`);
}
