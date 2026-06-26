/**
 * Warms the browser image cache with every bundled image at startup so page
 * navigation is instant (no first-visit load). Images are hashed/immutable in
 * production, so once decoded they stay cached until the app is rebuilt.
 *
 * Runs deferred (after first paint) and at low priority so it never delays the
 * home screen.
 */
const images = import.meta.glob('../assets/**/*.{png,jpg,jpeg,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const urls = Object.values(images);

let started = false;

/** Decode every bundled image into the cache. Safe to call more than once. */
export function preloadAllImages(): void {
  if (started) return;
  started = true;

  const run = (): void => {
    for (const url of urls) {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  };

  // Defer so the current screen paints first.
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (ric) ric(run);
  else setTimeout(run, 200);
}

/** Number of bundled images (for diagnostics). */
export const bundledImageCount = urls.length;
