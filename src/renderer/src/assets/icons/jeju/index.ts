/**
 * Resolver for 제주공항 (W006) icon/illustration art exported from Figma.
 *
 * Drop PNG or SVG exports into this folder. Files are picked up automatically
 * via Vite's glob import — the build never breaks if some are missing;
 * components fall back to a labelled placeholder until the asset is added.
 *
 * Source files go here:
 *   src/renderer/src/assets/icons/jeju/
 *
 * Two things bit us on the Osan/Hwaseong rounds and apply here too:
 *  - Figma SVG exports carry `preserveAspectRatio="none"`, so they STRETCH to
 *    fill any non-square box. Rewrite it to `xMidYMid meet` after downloading.
 *  - Figma's home/back button exports are COMPLETE buttons (the circle is baked
 *    into the art) — render them directly instead of wrapping in a CSS circle.
 */
const modules = import.meta.glob('./*.{png,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Returns the URL for an exported icon by base name, or undefined if absent. */
export function jejuIconUrl(name: string): string | undefined {
  return modules[`./${name}.png`] ?? modules[`./${name}.svg`];
}
