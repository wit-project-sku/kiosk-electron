/**
 * Resolver for KADA (W202) art exported from Figma node 5403:11277.
 *
 * Drop PNG or SVG exports into this folder. Files are picked up automatically
 * via Vite's glob import — the build never breaks if some are missing;
 * callers fall back (usually to the insadong set, see photoChrome) until the
 * asset is added.
 *
 * Source files go here:
 *   src/renderer/src/assets/icons/kada/
 *
 * The Figma export caveat that bit every previous location applies here too:
 * Figma SVG exports carry `preserveAspectRatio="none"`, so they STRETCH to fill
 * any non-square box. KadaHome sidesteps that by sizing every decorative box to
 * the asset's own natural dimensions — if you add an asset that is drawn at some
 * other size, rewrite its `preserveAspectRatio` to `xMidYMid meet` first.
 */
const modules = import.meta.glob('./*.{png,svg,jpg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Returns the URL for an exported KADA asset by base name, or undefined. */
export function kadaIconUrl(name: string): string | undefined {
  return modules[`./${name}.png`] ?? modules[`./${name}.svg`] ?? modules[`./${name}.jpg`];
}
