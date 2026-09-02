/**
 * Resolver for the KADA (W202) partner-page exports.
 *
 * Ten files: one per partner per language, named `<partner>-<lang>` —
 *
 *   akcf-en  akcf-vi    nipa-en  nipa-vi    ptit-en  ptit-vi
 *   sku-en   sku-vi     wit-en   wit-vi
 *
 * Each is the whole 2160×3840 screen flattened, because the body copy, the
 * partner logo and the photographs are all painted into the artwork — which is
 * also why there are two of each: the translation IS the image. The names come
 * from KADA_PAGES' `asset` field, which is the place to change them.
 *
 * Figma exports these 1–3px wider than 2160 (stroke bleed on the rail arc);
 * KioskScreenImage stretches to the artboard, so the ≤0.14% difference never
 * shows. Re-export at scale 1 — the artwork is already full-resolution for the
 * panel, and @2x would quadruple an 18 MB set for no visible gain.
 *
 * Files are picked up automatically via Vite's glob import, so adding or
 * replacing one needs no code change, and a missing file never breaks the
 * build: KadaImagePage names the absent file on screen instead.
 *
 * Kept separate from assets/icons/kada (the home screen's exported vector
 * furniture) because these are whole-screen deliverables on their own release
 * cadence, not icons.
 */
const modules = import.meta.glob('./*.{png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** URL for a KADA page export by base name (`akcf-en`), or undefined if absent. */
export function kadaPageUrl(name: string): string | undefined {
  return (
    modules[`./${name}.png`] ??
    modules[`./${name}.jpg`] ??
    modules[`./${name}.jpeg`] ??
    modules[`./${name}.webp`]
  );
}
