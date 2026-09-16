import type { JSX } from 'react';
import { FIELDS, FIELD_ORDER, type FieldKey } from './copy';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import styles from './Keypad.module.css';

interface Props {
  field: FieldKey;
  onKey: (key: string) => void;
  onNext: () => void;
  onClose: () => void;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** 화면 숫자 키패드 — 키오스크에는 OS 키보드가 없다. 제주 앱의 FloatingKeyboard 자리에 들어간다. */
export function Keypad({ field, onKey, onNext, onClose }: Props): JSX.Element {
  const f = FIELDS[field];
  const isLast = FIELD_ORDER.indexOf(field) === FIELD_ORDER.length - 1;
  return (
    <div className={styles.sheet} onPointerDown={(e) => e.preventDefault()} role="dialog" aria-label={`${f.label} 입력`}>
      <div className={styles.head}>
        <p className={styles.label}>
          {f.label} 입력
          <small>
            {f.min}~{f.max}
            {f.unit}
          </small>
        </p>
        <button type="button" className={styles.done} onClick={onClose}>
          완료
        </button>
      </div>
      <div className={styles.keys}>
        {DIGITS.map((d) => (
          <button key={d} type="button" className={styles.key} onClick={() => onKey(d)}>
            {d}
          </button>
        ))}
        <button type="button" className={`${styles.key} ${styles.fn}`} onClick={() => onKey('back')} aria-label="지우기">
          <img src={jejuIconUrl('ico-backspace')} alt="" className={styles.backIcon} />
        </button>
        <button type="button" className={styles.key} onClick={() => onKey('0')}>
          0
        </button>
        <button type="button" className={`${styles.key} ${styles.next}`} onClick={isLast ? onClose : onNext}>
          {isLast ? '완료' : '다음'}
        </button>
      </div>
    </div>
  );
}
