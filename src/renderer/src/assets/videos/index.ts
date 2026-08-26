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
import { filesForSet, videoSetFor } from '@renderer/lib/videoMap';

/** Generic-wall fallback URLs for a kiosk's video set. The set is derived from the
 *  kiosk's LAYOUT (videoSetFor) — the single mapping, shared with subtitle
 *  resolution, so the wall can never play from a different set than the clips. */
export function displayVideosFor(kioskId?: string): string[] {
  const set = videoSetFor(kioskId);
  return filesForSet(set).map((name) => `media://video/${set}/${encodeURIComponent(name)}`);
}
