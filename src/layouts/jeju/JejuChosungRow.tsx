/**
 * 제주 초성 (leading-consonant) index row.
 *
 * Shared because three frames draw the byte-identical control — 60px SemiBold
 * black, letter-spacing 30, 14 letters — over three different lists:
 *   뭐먹지 / 뭐사지 / 숙박안내   6212:55199   (JejuListScreen)
 *   여기는 제주도 > 관광명소     6212:59319   (JejuAbout)
 * Only the row's own width differs, so that is the one thing callers set.
 */
import type { CSSProperties } from 'react';
import { CHOSUNG_INDEX, type Chosung } from '@renderer/lib/chosung';
import styles from './JejuChosungRow.module.css';

interface Props {
  /** Selected letter, or null for "no filter". */
  value: Chosung | null;
  /** Tapping the active letter clears it — there is no 전체 letter. */
  onChange: (next: Chosung | null) => void;
  /** Positioning is the caller's: the row is a flex child on the list screens
   *  and absolutely placed on 관광명소. */
  className?: string;
  /**
   * Touch-cell width. The row is centred, so this is what makes it span its
   * frame: 129px over the list frames' x220–1943, 124.57px over 관광명소's
   * x208–1952.
   */
  cellWidth?: number;
}

export function JejuChosungRow({ value, onChange, className = '', cellWidth }: Props): JSX.Element {
  return (
    <div
      className={`${styles.row} ${className}`}
      style={cellWidth ? ({ '--jeju-jamo-cell': `${cellWidth}px` } as CSSProperties) : undefined}
    >
      {CHOSUNG_INDEX.map((c) => (
        <button
          key={c}
          type="button"
          className={`${styles.jamo} ${c === value ? styles.jamoActive : ''}`}
          onClick={() => onChange(value === c ? null : c)}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
