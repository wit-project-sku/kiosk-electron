/**
 * Instagram-style photo filters for the gesture-driven 인스타 효과 path.
 *
 * Each filter is a plain CSS `filter` string that is applied BOTH to the live
 * `<video>` (so the user sees it on Monitor 2) and to the capture `<canvas>`
 * (`ctx.filter = css`) so the saved photo carries the exact same look. Only
 * standard filter functions are used so the canvas bake matches the live preview.
 */

export interface PhotoFilter {
  id: string;
  /** Short label shown under the carousel thumbnail. */
  name: string;
  /** CSS filter string — `'none'` for the untouched original. */
  css: string;
}

export const PHOTO_FILTERS: readonly PhotoFilter[] = [
  { id: 'original', name: '원본', css: 'none' },
  { id: 'warm', name: '따뜻함', css: 'saturate(1.35) sepia(0.25) contrast(1.05) brightness(1.03)' },
  { id: 'cool', name: '청량', css: 'saturate(1.1) hue-rotate(-12deg) brightness(1.05) contrast(1.02)' },
  { id: 'bw', name: '흑백', css: 'grayscale(1) contrast(1.1)' },
  { id: 'vintage', name: '빈티지', css: 'sepia(0.45) saturate(1.2) contrast(0.95) brightness(1.05)' },
  { id: 'vivid', name: '선명', css: 'saturate(1.6) contrast(1.15)' },
  { id: 'beauty', name: '뷰티', css: 'brightness(1.12) saturate(1.05) contrast(0.96) blur(0.4px)' },
  { id: 'sepia', name: '세피아', css: 'sepia(0.7) brightness(1.05)' },
  { id: 'cinema', name: '시네마', css: 'contrast(1.2) saturate(0.85) brightness(0.95)' },
  { id: 'sunset', name: '노을', css: 'sepia(0.35) saturate(1.4) hue-rotate(-18deg) brightness(1.05)' },
  { id: 'fresh', name: '청초', css: 'brightness(1.1) saturate(1.25) hue-rotate(8deg)' },
  { id: 'noir', name: '누아르', css: 'grayscale(1) sepia(0.3) brightness(1.05) contrast(1.1)' },
  { id: 'pop', name: '팝', css: 'saturate(1.8) contrast(1.1) brightness(1.05)' },
] as const;

export function filterCssFor(id: string): string {
  return PHOTO_FILTERS.find((f) => f.id === id)?.css ?? 'none';
}

const FALLBACK_FILTER: PhotoFilter = { id: 'original', name: 'Original', css: 'none' };

/** Filter at a (wrapping) index — always defined, so callers never hit undefined. */
export function filterAt(index: number): PhotoFilter {
  const n = PHOTO_FILTERS.length;
  const wrapped = ((index % n) + n) % n;
  return PHOTO_FILTERS[wrapped] ?? FALLBACK_FILTER;
}
