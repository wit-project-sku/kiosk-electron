/**
 * Icons for the AR 한복체험 camera phase (Monitor 2).
 *
 * Drop PNG/SVG exports into THIS folder with these filenames:
 *   hanbok-silhouette.png  — semi-transparent hanbok outfit overlay on live camera
 *   pose-ref-1.png         — reference pose photo (left slot in bottom bar)
 *   pose-ref-2.png         — reference pose photo (right slot in bottom bar)
 *
 * Files are picked up automatically at build time. Missing files are handled
 * gracefully — the camera screen simply omits the asset until it is added.
 */
const modules = import.meta.glob('./*.{png,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function cameraIconUrl(name: string): string | undefined {
  return modules[`./${name}.png`] ?? modules[`./${name}.svg`];
}
