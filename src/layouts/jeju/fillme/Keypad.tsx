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

/**
 * 화면 숫자 키패드 — Figma 7334:84131. 키오스크에는 OS 키보드가 없다.
 *
 * 시안은 회색 띠 위의 12칸이 전부다: 1~9 · 지우기 · 0 · 다음. 머리말도 '완료'도
 * 없어서, 마지막 칸의 '다음' 이 키패드를 닫는 자리다(onNext 가 다음 칸이 없으면
 * 닫는다 — JejuFillme 의 nextField). 띠 밖을 누르면 그냥 닫힌다.
 */
export function Keypad({ field, onKey, onNext, onClose }: Props): JSX.Element {
  const f = FIELDS[field];
  const isLast = FIELD_ORDER.indexOf(field) === FIELD_ORDER.length - 1;
  return (
    <>
      {/* 보이지 않는 닫기 판 — 시안에 없는 것을 그리지 않으면서 빠져나갈 길을 둔다. */}
      <div className={styles.scrim} onClick={onClose} aria-hidden />
      <div
        className={styles.pad}
        onPointerDown={(e) => e.preventDefault()}
        role="dialog"
        aria-label={`${f.label} 입력`}
      >
        <div className={styles.keys}>
          {DIGITS.map((d) => (
            <button key={d} type="button" className={styles.key} onClick={() => onKey(d)}>
              {d}
            </button>
          ))}
          <button type="button" className={styles.key} onClick={() => onKey('back')} aria-label="지우기">
            <img src={jejuIconUrl('ico-backspace')} alt="" className={styles.backIcon} />
          </button>
          <button type="button" className={styles.key} onClick={() => onKey('0')}>
            0
          </button>
          {/* 마지막 칸에서는 이 버튼이 키패드를 닫는다. */}
          <button
            type="button"
            className={`${styles.key} ${styles.next}`}
            onClick={onNext}
            aria-label={isLast ? '입력 마치기' : '다음 칸으로'}
          >
            다음
          </button>
        </div>
      </div>
    </>
  );
}
