/**
 * Hangul (두벌식 / 2-set) input composer.
 *
 * Assembles a stream of jamo (consonants/vowels) from the on-screen keyboard
 * into syllable blocks, exactly like a real Korean IME: handles compound vowels
 * (ㅗ+ㅏ=ㅘ), compound finals (ㄹ+ㄱ=ㄺ), final→leading migration when a vowel
 * follows a final consonant (간+ㅏ → 가나), and step-wise decomposition on
 * backspace. English/number/space input flushes any pending syllable first.
 */

const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']; // 19
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ']; // 21
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']; // 28

const CHO_IDX: Record<string, number> = Object.fromEntries(CHO.map((c, i) => [c, i]));
const JUNG_IDX: Record<string, number> = Object.fromEntries(JUNG.map((c, i) => [c, i]));

/** Single consonant char → jong index (ㄸ/ㅃ/ㅉ have no final form). */
const JONG_IDX: Record<string, number> = {};
for (const c of CHO) {
  const i = JONG.indexOf(c);
  if (i > 0) JONG_IDX[c] = i;
}

/** [base vowel idx + added vowel char] → combined vowel idx. */
const COMPOUND_VOWEL: Record<string, number> = {
  [`${JUNG_IDX['ㅗ']}+ㅏ`]: JUNG_IDX['ㅘ']!,
  [`${JUNG_IDX['ㅗ']}+ㅐ`]: JUNG_IDX['ㅙ']!,
  [`${JUNG_IDX['ㅗ']}+ㅣ`]: JUNG_IDX['ㅚ']!,
  [`${JUNG_IDX['ㅜ']}+ㅓ`]: JUNG_IDX['ㅝ']!,
  [`${JUNG_IDX['ㅜ']}+ㅔ`]: JUNG_IDX['ㅞ']!,
  [`${JUNG_IDX['ㅜ']}+ㅣ`]: JUNG_IDX['ㅟ']!,
  [`${JUNG_IDX['ㅡ']}+ㅣ`]: JUNG_IDX['ㅢ']!,
};
/** Combined vowel idx → base vowel idx (backspace). */
const VOWEL_DECOMPOSE: Record<number, number> = {};
for (const key of Object.keys(COMPOUND_VOWEL)) {
  VOWEL_DECOMPOSE[COMPOUND_VOWEL[key]!] = Number(key.split('+')[0]);
}

/** Compound final pairs: [base final char, added consonant] → result final char. */
const COMPOUND_JONG_PAIRS: [string, string, string][] = [
  ['ㄱ', 'ㅅ', 'ㄳ'], ['ㄴ', 'ㅈ', 'ㄵ'], ['ㄴ', 'ㅎ', 'ㄶ'],
  ['ㄹ', 'ㄱ', 'ㄺ'], ['ㄹ', 'ㅁ', 'ㄻ'], ['ㄹ', 'ㅂ', 'ㄼ'],
  ['ㄹ', 'ㅅ', 'ㄽ'], ['ㄹ', 'ㅌ', 'ㄾ'], ['ㄹ', 'ㅍ', 'ㄿ'],
  ['ㄹ', 'ㅎ', 'ㅀ'], ['ㅂ', 'ㅅ', 'ㅄ'],
];
/** [base jong idx + added consonant char] → combined jong idx. */
const COMPOUND_JONG: Record<string, number> = {};
/** Combined jong idx → base jong idx (backspace). */
const JONG_DECOMPOSE: Record<number, number> = {};
for (const [base, add, result] of COMPOUND_JONG_PAIRS) {
  const baseIdx = JONG.indexOf(base);
  const resultIdx = JONG.indexOf(result);
  COMPOUND_JONG[`${baseIdx}+${add}`] = resultIdx;
  JONG_DECOMPOSE[resultIdx] = baseIdx;
}

/** When a vowel follows a final: how the final splits (stays vs migrates to next cho). */
interface JongSplit {
  /** Jong idx that stays on the current syllable (0 = none). */
  stay: number;
  /** Cho idx of the consonant that migrates to the new syllable. */
  moveCho: number;
}
const JONG_SPLIT: Record<number, JongSplit> = {};
// Simple finals migrate wholesale.
for (const c of Object.keys(JONG_IDX)) {
  JONG_SPLIT[JONG_IDX[c]!] = { stay: 0, moveCho: CHO_IDX[c]! };
}
// Compound finals: base stays, second consonant migrates.
for (const [base, add, result] of COMPOUND_JONG_PAIRS) {
  JONG_SPLIT[JONG.indexOf(result)] = { stay: JONG.indexOf(base), moveCho: CHO_IDX[add]! };
}

function composeSyllable(cho: number, jung: number, jong: number): string {
  return String.fromCharCode(0xac00 + (cho * 21 + jung) * 28 + jong);
}

export class HangulComposer {
  private committed = '';
  private cho: number | null = null;
  private jung: number | null = null;
  private jong: number | null = null;

  /** Full current text (committed + the in-progress syllable). */
  get value(): string {
    return this.committed + this.current();
  }

  reset(text = ''): void {
    this.committed = text;
    this.cho = this.jung = this.jong = null;
  }

  /** Render the in-progress syllable (or lone jamo). */
  private current(): string {
    if (this.cho != null && this.jung != null) {
      return composeSyllable(this.cho, this.jung, this.jong ?? 0);
    }
    if (this.cho != null) return CHO[this.cho]!;
    if (this.jung != null) return JUNG[this.jung]!;
    return '';
  }

  private flush(): void {
    this.committed += this.current();
    this.cho = this.jung = this.jong = null;
  }

  /** Feed one jamo from the Korean keyboard. */
  inputJamo(ch: string): void {
    const vowel = JUNG_IDX[ch];
    if (vowel != null) {
      this.inputVowel(ch, vowel);
    } else {
      const cho = CHO_IDX[ch];
      if (cho != null) this.inputConsonant(ch, cho);
    }
  }

  private inputVowel(ch: string, v: number): void {
    if (this.jung == null) {
      this.jung = v;
      return;
    }
    if (this.jong == null) {
      const combined = COMPOUND_VOWEL[`${this.jung}+${ch}`];
      if (combined != null) {
        this.jung = combined;
      } else {
        this.flush();
        this.jung = v;
      }
      return;
    }
    // A vowel after a final: the final migrates to start a new syllable.
    const split = JONG_SPLIT[this.jong]!;
    this.jong = split.stay === 0 ? null : split.stay;
    this.flush();
    this.cho = split.moveCho;
    this.jung = v;
  }

  private inputConsonant(ch: string, c: number): void {
    if (this.jung == null) {
      // empty, or a lone leading consonant (two in a row can't cluster)
      if (this.cho == null) this.cho = c;
      else {
        this.flush();
        this.cho = c;
      }
      return;
    }
    if (this.cho == null) {
      // lone vowel followed by a consonant → start a new block
      this.flush();
      this.cho = c;
      return;
    }
    if (this.jong == null) {
      const jong = JONG_IDX[ch];
      if (jong != null) this.jong = jong;
      else {
        this.flush();
        this.cho = c;
      }
      return;
    }
    const combined = COMPOUND_JONG[`${this.jong}+${ch}`];
    if (combined != null) {
      this.jong = combined;
    } else {
      this.flush();
      this.cho = c;
    }
  }

  /** Append a literal character (English/number/space); flushes pending jamo. */
  inputLiteral(ch: string): void {
    this.flush();
    this.committed += ch;
  }

  /** Delete one step: decompose the in-progress syllable, else a committed char. */
  backspace(): void {
    if (this.jong != null) {
      this.jong = JONG_DECOMPOSE[this.jong] ?? null;
    } else if (this.jung != null) {
      this.jung = VOWEL_DECOMPOSE[this.jung] ?? null;
    } else if (this.cho != null) {
      this.cho = null;
    } else {
      this.committed = Array.from(this.committed).slice(0, -1).join('');
    }
  }
}
