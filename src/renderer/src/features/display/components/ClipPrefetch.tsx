/**
 * Invisible clip warmer for the customer display.
 *
 * The wall's screen switch is only as fast as the incoming clip's first
 * decoded frame; these hidden <video> elements make sure that by the time a
 * clip IS asked for, its bytes are already in Chromium's cache — so the wall's
 * own load starts from memory, not cold disk, and the visible gap between the
 * touch-screen navigation and the video cut collapses to the decode alone.
 *
 * Two tiers:
 *  - `auto`: the clips one tap away from the current screen (sibling tabs —
 *    see siblingClipUrls). Fully buffered, few of them, refreshed per screen.
 *  - `metadata`: every screen's entry clip. Header + moov only, which is
 *    cheap — and for a non-faststart mp4 it is exactly the expensive
 *    tail-of-file read that would otherwise happen on the tap itself.
 *
 * `display: none` does not stop preloading; it only stops painting. Elements
 * are keyed by URL, so a screen change swaps only the candidates that changed
 * and never re-fetches what an earlier screen already warmed (the media
 * responses are cacheable — see mediaProtocol's Cache-Control).
 */
interface ClipPrefetchProps {
  /** Fully-buffered tier (small — the current screen's one-tap neighbours). */
  auto: string[];
  /** Header/moov-only tier (broad — every screen's entry clip). */
  metadata: string[];
}

export function ClipPrefetch({ auto, metadata }: ClipPrefetchProps): JSX.Element | null {
  if (auto.length === 0 && metadata.length === 0) return null;
  return (
    <div style={{ display: 'none' }} aria-hidden>
      {auto.map((url) => (
        <video key={url} src={url} preload="auto" muted playsInline />
      ))}
      {metadata
        .filter((url) => !auto.includes(url))
        .map((url) => (
          <video key={url} src={url} preload="metadata" muted playsInline />
        ))}
    </div>
  );
}
