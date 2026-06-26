/**
 * Bottom promo banners (가상 한복 체험). Multiple banners rotate on the home
 * screen every 30 minutes. Drop additional banner-N.png files here to add more.
 */
const modules = import.meta.glob('./*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const homeBanners: string[] = Object.keys(modules)
  .sort()
  .map((k) => modules[k]!);
