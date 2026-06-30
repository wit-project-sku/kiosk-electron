import { useState } from 'react';
import { Globe, Delete, CornerDownLeft, ArrowBigUp } from 'lucide-react';
import type { SupportedLanguage } from '@shared/types/kiosk';
import styles from './VirtualKeyboard.module.css';

export type KeyAction =
  | { type: 'jamo'; value: string }
  | { type: 'literal'; value: string }
  | { type: 'space' }
  | { type: 'backspace' }
  | { type: 'enter' };

type Mode = 'ko' | 'en';

const KO_ROWS: string[][] = [
  ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'],
  ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'],
  ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ'],
];
/** Shift variants (두벌식): double consonants + ㅒ/ㅖ. */
const KO_SHIFT: Record<string, string> = {
  ㅂ: 'ㅃ', ㅈ: 'ㅉ', ㄷ: 'ㄸ', ㄱ: 'ㄲ', ㅅ: 'ㅆ', ㅐ: 'ㅒ', ㅔ: 'ㅖ',
};
const EN_ROWS: string[][] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];
const NUM_ROW = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

interface VirtualKeyboardProps {
  onKey: (action: KeyAction) => void;
  /** Active language — Korean shows the 두벌식 layout, anything else starts in
   *  English (Korean composing is still reachable via the 🌐 toggle). */
  lang: SupportedLanguage;
  /** When true, the backspace key uses the same light style as the other keys
   *  instead of the dark Figma key (Hwaseong design). */
  lightBackspace?: boolean;
}

/**
 * Touch keyboard matching the Figma 검색 design: white rounded keys with a soft
 * shadow, a single dark backspace key (top-right), and white function keys
 * (↵ enter, ⬆ shift, 🌐 language). Korean 두벌식 / English / numbers.
 */
export function VirtualKeyboard({ onKey, lang, lightBackspace = false }: VirtualKeyboardProps): JSX.Element {
  const [mode, setMode] = useState<Mode>(lang === 'ko' ? 'ko' : 'en');
  const [shift, setShift] = useState(false);

  const rows = mode === 'ko' ? KO_ROWS : EN_ROWS;

  const labelFor = (base: string): string => {
    if (mode === 'ko') return shift ? (KO_SHIFT[base] ?? base) : base;
    return shift ? base.toUpperCase() : base;
  };

  const pressLetter = (base: string): void => {
    const ch = labelFor(base);
    onKey(mode === 'ko' ? { type: 'jamo', value: ch } : { type: 'literal', value: ch });
    if (shift) setShift(false);
  };

  return (
    <div className={styles.keyboard}>
      {/* Row 1: numbers + backspace (the only dark key) */}
      <div className={styles.row}>
        {NUM_ROW.map((n) => (
          <button key={n} type="button" className={styles.key} onClick={() => onKey({ type: 'literal', value: n })}>
            {n}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.key} ${lightBackspace ? styles.backspaceLight : styles.backspace}`}
          onClick={() => onKey({ type: 'backspace' })}
          aria-label="지우기"
        >
          <Delete className={styles.icon} strokeWidth={2} />
        </button>
      </div>

      {/* Row 2 */}
      <div className={styles.row}>
        {rows[0]!.map((base) => (
          <button key={base} type="button" className={styles.key} onClick={() => pressLetter(base)}>
            {labelFor(base)}
          </button>
        ))}
      </div>

      {/* Row 3 + enter */}
      <div className={styles.row}>
        {rows[1]!.map((base) => (
          <button key={base} type="button" className={styles.key} onClick={() => pressLetter(base)}>
            {labelFor(base)}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.key} ${styles.enter}`}
          onClick={() => onKey({ type: 'enter' })}
          aria-label="검색"
        >
          <CornerDownLeft className={styles.icon} strokeWidth={2} />
        </button>
      </div>

      {/* Row 4: shift + remaining consonants */}
      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.key} ${styles.shift} ${shift ? styles.active : ''}`}
          onClick={() => setShift((s) => !s)}
          aria-pressed={shift}
          aria-label="시프트"
        >
          <ArrowBigUp className={styles.icon} strokeWidth={2} fill={shift ? 'currentColor' : 'none'} />
        </button>
        {rows[2]!.map((base) => (
          <button key={base} type="button" className={styles.key} onClick={() => pressLetter(base)}>
            {labelFor(base)}
          </button>
        ))}
      </div>

      {/* Row 5: language toggle + space */}
      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.key} ${styles.globe}`}
          onClick={() => {
            setMode((m) => (m === 'ko' ? 'en' : 'ko'));
            setShift(false);
          }}
          aria-label="언어 전환"
        >
          <Globe className={styles.icon} strokeWidth={2} />
        </button>
        <button type="button" className={`${styles.key} ${styles.space}`} onClick={() => onKey({ type: 'space' })}>
          Space
        </button>
      </div>
    </div>
  );
}
