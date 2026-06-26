const modules = import.meta.glob('./*.{png,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function kdramaAsset(name: string): string | undefined {
  return modules[`./${name}.png`] ?? modules[`./${name}.svg`];
}

/** All K-DRAMA promotion image URLs — preloaded at app start so the page (which
 *  uses large kitchen/poster images) doesn't load slowly on first open. */
export const kdramaAssetUrls: string[] = Object.values(modules);
