/**
 * Videos played on the 2nd monitor (customer display) when the photo workflow
 * is not active.
 *
 * The files are large, so they are NOT bundled — they ship as electron-builder
 * extraResources (resources/videos/<set>/) and stream at runtime through the
 * `media://video/<set>/<name>` protocol (see src/main/core/mediaProtocol.ts).
 * The real file list is read live from disk (IPC VideosList → initVideoFiles),
 * so just drop files under resources/videos/<set>/ — no manifest, no rebuild.
 */
import { filesForSet } from '@renderer/lib/videoMap';
import type { VideoSet } from '@shared/types/subtitle';

/** Generic-wall fallback URLs for a kiosk's video set (W004 → osaek, W005 → hwaseong). */
export function displayVideosFor(kioskId?: string): string[] {
  const set: VideoSet = kioskId === 'W004' ? 'osaek' : kioskId === 'W005' ? 'hwaseong' : 'insadong';
  return filesForSet(set).map((name) => `media://video/${set}/${encodeURIComponent(name)}`);
}
