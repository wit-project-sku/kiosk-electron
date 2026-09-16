/**
 * Resolver for the FillMe 손톱분석 artwork — the logo, the hand illustration and
 * the 19 ingredient icons, copied from the FillMe sample app by way of
 * fillme-jeju-prototype.
 *
 * Same shape as assets/icons/jeju: a Vite glob, so a missing file leaves the
 * caller with `undefined` rather than breaking the build. The ingredient icons
 * live in their own folder because they are addressed BY FILE NAME — the
 * analysis API returns an absolute `iconUrl` on FillMe's own server and we
 * serve the bundled copy of the same file instead (see `ingredientIconUrl`).
 */
const art = import.meta.glob('./*.{png,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const ingredients = import.meta.glob('./ingredients/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** URL for a FillMe illustration by base name (`fillme-logo`, `hand`, …). */
export function fillmeArtUrl(name: string): string | undefined {
  return art[`./${name}.png`] ?? art[`./${name}.svg`];
}

/**
 * Bundled copy of an ingredient icon, looked up by the API URL's FILE NAME.
 *
 * The kiosk is offline-first and FillMe's asset host is a third party, so the
 * bundled copy always wins; the caller falls back to the remote URL only when
 * we have no file of that name (a new ingredient added server-side after this
 * build shipped). File names are the sample app's and are stable.
 */
export function fillmeIngredientIconUrl(fileName: string): string | undefined {
  return ingredients[`./ingredients/${fileName}`];
}
