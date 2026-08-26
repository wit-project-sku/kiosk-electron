/**
 * Korean 초성 (leading-consonant) indexing for shop lists.
 *
 * The keyboard's HangulComposer goes the other way — it COMPOSES jamo into
 * syllables for typing — so decomposition lives here.
 */

/**
 * The 14 basic consonants, in the order the Figma index row draws them.
 * The five doubles (ㄲㄸㅃㅆㅉ) are deliberately absent: Korean indexes fold
 * them into their base, so 까페 is filed under ㄱ.
 */
export const CHOSUNG_INDEX = [
  'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ',
  'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

export type Chosung = (typeof CHOSUNG_INDEX)[number];

/** Unicode's 19 leading jamo, in code order — the index a syllable decodes to. */
const CHO = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

/** Doubles → the bucket they are filed under. */
const FOLD: Record<string, string> = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' };

const SYLLABLE_BASE = 0xac00;
const SYLLABLE_LAST = 0xd7a3;
/** 21 vowels × 28 finals per leading consonant. */
const CHO_STRIDE = 588;

/**
 * The index bucket for `text`, or null when it starts with something that has
 * no 초성 at all (a digit, a latin letter, punctuation, an empty string).
 * Leading whitespace is skipped; sheet ordering prefixes are NOT — run
 * `stripPrefix` first if the caller's strings carry one.
 */
export function leadingChosung(text: string): Chosung | null {
  for (const ch of text.trim()) {
    const code = ch.codePointAt(0)!;
    if (code >= SYLLABLE_BASE && code <= SYLLABLE_LAST) {
      const cho = CHO[Math.floor((code - SYLLABLE_BASE) / CHO_STRIDE)]!;
      return (FOLD[cho] ?? cho) as Chosung;
    }
    // A bare jamo (rare, but some names are typed that way) indexes as itself.
    if (CHO.includes(ch)) return (FOLD[ch] ?? ch) as Chosung;
    // Anything else — a digit or latin letter — means this name has no bucket.
    // Don't scan deeper: "3-김밥" must not silently file under ㄱ.
    return null;
  }
  return null;
}
