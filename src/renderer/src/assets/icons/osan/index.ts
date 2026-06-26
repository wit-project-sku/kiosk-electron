/**
 * Resolver for Osan (오색시장) icon/illustration art exported from Figma.
 *
 * Drop PNG or SVG exports into this folder.  Files are picked up automatically
 * via Vite's glob import — the build never breaks if some are missing;
 * components fall back to a labelled placeholder until the asset is added.
 *
 * Source files go here:
 *   src/renderer/src/assets/icons/osan/
 *
 * (Drop your raw exports from the root icons/ folder into this directory.)
 */
const modules = import.meta.glob('./*.{png,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Returns the URL for an exported icon by base name, or undefined if absent. */
export function osanIconUrl(name: string): string | undefined {
  return modules[`./${name}.png`] ?? modules[`./${name}.svg`];
}
