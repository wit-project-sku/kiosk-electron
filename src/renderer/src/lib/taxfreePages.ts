import type { SupportedLanguage } from '@shared/types/kiosk';

/**
 * The tax-free tab page images.
 *
 * Most of the artwork is genuinely shared — the 소개 carousel explains the
 * national tax-free scheme and reads the same at every location — so it lives
 * once under `insadong/` and every layout draws from it.
 *
 * The 가맹점 신청 (merchant) tab is NOT shared: it prints whoever handles
 * merchant sign-up for that kiosk. Insadong routes through 인사동전통문화보존회
 * (02-737-7890); 오색시장 and 화성휴게소 both route through WIT GLOBAL INC.
 * (company@witworldwide.com) and use the SAME artwork as each other — verified
 * pixel-identical, so it lives once under `taxfree-wit/` rather than being
 * copied per location. A page a variant doesn't override still comes from the
 * shared set. This is why `variant` exists — without it Osan and Hwaseong
 * silently printed insadong's phone number.
 *
 * Files are named `<base>-<lang>.png`, e.g. `tab1-p1-ko.png`.
 */
const SHARED_IMGS = import.meta.glob<{ default: string }>(
  '../assets/photos/insadong/taxfree/pages/*.png',
  { eager: true },
);

/** WIT GLOBAL merchant-signup artwork — every location except insadong. Only the
 *  pages that actually differ from the shared set live here. */
const WIT_IMGS = import.meta.glob<{ default: string }>(
  '../assets/photos/taxfree-wit/pages/*.png',
  { eager: true },
);

/** Which override set to consult before the shared one. Add a location-specific
 *  variant here the day a location's artwork genuinely diverges. */
export type TaxfreeVariant = 'shared' | 'wit';

/** The three page slots: intro carousel p1/p2 and the merchant tab. */
export const TAXFREE_PAGE_BASES = ['tab1-p1', 'tab1-p2', 'tab3'] as const;

/** Tried in order when the selected language has no artwork for a page. English
 *  before Korean: a language whose image hasn't been produced yet is a foreign
 *  visitor's language, so English is the closer read. */
const FALLBACK_LANGS: readonly SupportedLanguage[] = ['en', 'ko'];

type ImgSet = Record<string, { default: string }>;

function bySuffix(imgs: ImgSet, name: string): string | undefined {
  const entry = Object.entries(imgs).find(([k]) => k.endsWith(`/${name}.png`));
  return entry?.[1]?.default;
}

/**
 * URL of a tax-free page image: the variant's own override for `lang` if it has
 * one, else the shared artwork, falling back to English then Korean.
 *
 * Language is matched BEFORE variant on purpose — a Vietnamese visitor is better
 * served by the shared Vietnamese page than by the variant's English one.
 *
 * The fallback is what keeps a tab from rendering BLANK: the eight kiosk
 * languages do not all have artwork for every page (tab1-p2 is still ko/en/ja/zh
 * only), and without it `vi`/`th`/`ru`/`id` render an empty white card with no
 * hint that anything is missing.
 */
export function taxfreePageImg(
  base: string,
  lang: SupportedLanguage,
  variant: TaxfreeVariant = 'shared',
): string | undefined {
  const sets: ImgSet[] = variant === 'wit' ? [WIT_IMGS, SHARED_IMGS] : [SHARED_IMGS];
  for (const l of [lang, ...FALLBACK_LANGS]) {
    for (const imgs of sets) {
      const src = bySuffix(imgs, `${base}-${l}`);
      if (src) return src;
    }
  }
  return undefined;
}
