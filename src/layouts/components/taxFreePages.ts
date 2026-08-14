/**
 * Tax-free service page artwork, shared by every layout's TAX-FREE screen.
 *
 * The 소개 and 가맹점 tabs are IMAGES, not layout. Each file is a full
 * 1820×2290 panel export that matches the Figma panel (Rectangle 4226 in
 * 제주>TAXFREE-01, node 6212:57255) 1:1 — the same table, ₩ figures, 환급 절차
 * step icons and drawn chevrons. Re-authoring that per layout would mean four
 * copies of one service's explainer drifting apart, so every kiosk renders
 * these same PNGs.
 *
 * ── Two image sets, split by OPERATOR, not by location ──────────────────
 *
 *  `insadong/taxfree/pages/`  the shared set. 소개 (tab1-p1 / tab1-p2) explains
 *                             the national scheme and IS identical everywhere.
 *                             Its `tab3` is the 인사동전통문화보존회 version.
 *  `taxfree-wit/pages/`       `tab3` only (가맹점 신청), because that page prints
 *                             WHO handles merchant sign-up — WIT GLOBAL INC. /
 *                             company@witworldwide.com instead of 인사동
 *                             전통문화보존회 / 02-737-7890.
 *
 * The insadong path is historical (that is where the shared set was first
 * added), not a statement that the artwork is Insadong-scoped.
 *
 * ★ THE TRAP: a layout that does not pass a `variant` gets the shared set,
 * i.e. INSADONG'S PHONE NUMBER — silently, in every language. Nothing errors;
 * the page simply tells visitors to call the wrong organisation. Every caller
 * must name its operator.
 */
const SHARED_IMGS = import.meta.glob<{ default: string }>(
  '../../renderer/src/assets/photos/insadong/taxfree/pages/*.png',
  { eager: true },
);

const WIT_IMGS = import.meta.glob<{ default: string }>(
  '../../renderer/src/assets/photos/taxfree-wit/pages/*.png',
  { eager: true },
);

/** Which organisation's 가맹점 신청 page a location shows. */
export type TaxfreeVariant = 'insadong' | 'wit';

/** The page bases each layout renders, in tab order. */
export const TAX_FREE_PAGES = ['tab1-p1', 'tab1-p2', 'tab3'] as const;

/**
 * Languages to try when the requested one has no artwork. The pages are not
 * drawn in every language, so a visitor would otherwise get an EMPTY panel —
 * for a foreign-visitor explainer, English is a far better miss than a blank
 * card. Korean is the last resort so something always renders.
 */
const FALLBACK_LANGS = ['en', 'ko'] as const;

type ImgSet = Record<string, { default: string }>;

function pageUrl(set: ImgSet, name: string): string | undefined {
  return Object.entries(set).find(([k]) => k.endsWith(`/${name}.png`))?.[1]?.default;
}

/** `base` in the requested language, else English, else Korean — within ONE set. */
function inSet(set: ImgSet, base: string, lang: string): string | undefined {
  return pageUrl(set, `${base}-${lang}`)
    ?? FALLBACK_LANGS.map((l) => pageUrl(set, `${base}-${l}`)).find(Boolean);
}

/**
 * Localized page artwork for a base name ('tab1-p1' / 'tab1-p2' / 'tab3').
 *
 * Resolution is VARIANT FIRST, language second — deliberately. The variant only
 * exists because `tab3` names a contactable organisation, so falling back to
 * the shared set to gain a language would hand the visitor the right words and
 * the WRONG phone number. Right organisation in English beats wrong
 * organisation in Thai. The shared set is reached only when the variant has no
 * artwork for that base at all, which is how `tab1-p1`/`tab1-p2` resolve for
 * every location.
 */
export function taxFreePageImg(
  base: string,
  lang: string,
  variant: TaxfreeVariant = 'insadong',
): string | undefined {
  if (variant === 'wit') {
    const own = inSet(WIT_IMGS, base, lang);
    if (own) return own;
  }
  return inSet(SHARED_IMGS, base, lang);
}

/** Warm the cache for one language's pages so a tab switch doesn't flash. */
export function preloadTaxFreePages(lang: string, variant: TaxfreeVariant = 'insadong'): void {
  for (const base of TAX_FREE_PAGES) {
    const src = taxFreePageImg(base, lang, variant);
    if (src) {
      const img = new Image();
      img.src = src;
    }
  }
}
