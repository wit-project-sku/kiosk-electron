/**
 * Soft-launch gate for the 기부 (donation) feature.
 *
 * When true, the 기부 home tile still SHOWS (on the kiosks that have it —
 * W003/W004/W005, see hasDonation), keeping its slot and colour, but renders as
 * `기부 (준비중)` and is not tappable — the same treatment as 인사랑(준비중). The
 * donation webview is also not pre-warmed, since nothing can reach it.
 *
 * Flip to false to go live: the tile becomes clickable, drops the (준비중) marker,
 * and the webview pre-warms again. Nothing else needs to change.
 */
export const DONATION_COMING_SOON = false;

/** The `(준비중)` / coming-soon suffix per UI language, appended to the 기부 label
 *  while {@link DONATION_COMING_SOON}. Mirrors the wording used by the other
 *  준비중 tiles (문화재(준비중) → Heritage (Soon), 文化財（準備中）, …). */
export const COMING_SOON_SUFFIX: Record<string, string> = {
  ko: ' (준비중)',
  en: ' (Soon)',
  ja: '（準備中）',
  zh: '（筹备中）',
  vi: ' (Sắp có)',
  th: ' (เร็วๆ นี้)',
  ru: ' (Скоро)',
  id: ' (Segera)',
};

/** Append the coming-soon suffix for `lang` (falls back to Korean wording). */
export function withComingSoon(label: string, lang: string): string {
  return label + (COMING_SOON_SUFFIX[lang] ?? COMING_SOON_SUFFIX.ko);
}
