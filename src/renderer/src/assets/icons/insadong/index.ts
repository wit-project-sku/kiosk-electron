/**
 * Resolver for Insadong icon/illustration art exported from Figma.
 *
 * Drop PNG (or SVG) exports into this folder using the filenames listed in
 * README.md. Files are picked up automatically via Vite's glob import, so the
 * build never breaks if some are missing — components fall back to a labelled
 * placeholder until the asset is added.
 */
const modules = import.meta.glob('./*.{png,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Returns the URL for an exported icon by base name, or undefined if absent. */
export function iconUrl(name: string): string | undefined {
  return modules[`./${name}.png`] ?? modules[`./${name}.svg`];
}
