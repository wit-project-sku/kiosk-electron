/**
 * Palace photos from the root `palace/` folder, by hall number (= PalaceInfo_Insa
 * order). Each hall N has a main image "N0.png" and thumbnails "N1..N4.jpg".
 */
const modules = import.meta.glob('./*/*.{png,jpg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export interface PalacePhotos {
  main: string;
  thumbs: string[];
}

const byHall: Record<number, Array<{ num: string; url: string }>> = {};
for (const [path, url] of Object.entries(modules)) {
  const m = path.match(/\.\/(\d+)\/(\d+)\.(?:png|jpg)$/i);
  if (!m) continue;
  const hall = Number(m[1]);
  (byHall[hall] ??= []).push({ num: m[2]!, url });
}

/** Palace photos indexed by palace order (0 = first palace). */
export const PALACE_PHOTOS: PalacePhotos[] = Object.keys(byHall)
  .map(Number)
  .sort((a, b) => a - b)
  .map((hall) => {
    const files = byHall[hall]!.sort((a, b) => a.num.localeCompare(b.num));
    const main = files.find((f) => f.num.endsWith('0'))?.url ?? files[0]?.url ?? '';
    const thumbs = files.filter((f) => !f.num.endsWith('0')).map((f) => f.url);
    return { main, thumbs };
  });
