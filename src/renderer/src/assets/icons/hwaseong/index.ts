/**
 * Resolver for Hwaseong rest stop (화성휴게소) icon/illustration art exported from Figma.
 *
 * Drop PNG or SVG exports into this folder. Files are picked up automatically
 * via Vite's glob import — the build never breaks if some are missing;
 * components fall back to a labelled placeholder until the asset is added.
 *
 * Source files go here:
 *   src/renderer/src/assets/icons/hwaseong/
 */
const modules = import.meta.glob('./*.{png,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Returns the URL for an exported icon by base name, or undefined if absent. */
export function hwaseongIconUrl(name: string): string | undefined {
  return modules[`./${name}.png`] ?? modules[`./${name}.svg`];
}
