import type { JSX } from 'react';
import type { Sex } from './api';
import { FIELDS, type FieldKey } from './copy';
import { Icon } from './Icon';
import { Stepper } from './Stepper';
import ui from './fillmeUi.module.css';
import styles from './FillmeInfo.module.css';

export interface InfoValues {
  nums: Record<FieldKey, string>;
  sex: Sex | null;
  pregnant: boolean | null;
}

interface Props {
  values: InfoValues;
  shots: { left: string | null; right: string | null };
  focused: FieldKey | null;
  onFocusField: (key: FieldKey) => void;
  onSex: (sex: Sex) => void;
  onPregnant: (value: boolean) => void;
  onRetake: () => void;
  onNext: () => void;
}

export function fieldValid(values: InfoValues, key: FieldKey): boolean {
  const f = FIELDS[key];
  const raw = values.nums[key];
  const n = Number(raw);
  return raw !== '' && n >= f.min && n <= f.max;
}

export function infoValid(values: InfoValues): boolean {
  return (
    (['age', 'height', 'weight'] as FieldKey[]).every((k) => fieldValid(values, k)) &&
    !!values.sex &&
    (values.sex !== 'female' || values.pregnant != null)
  );
}

function NumberField({
  field,
  values,
  focused,
  onFocus,
  className,
}: {
  field: FieldKey;
  values: InfoValues;
  focused: boolean;
  onFocus: () => void;
  /** 필드마다 다른 절대 좌표 클래스. CSS 모듈 조회는 값이 없을 수도 있는 타입이다. */
  className?: string;
}): JSX.Element {
  const f = FIELDS[field];
  const raw = values.nums[field];
  const invalid = raw !== '' && !fieldValid(values, field) && !focused;
  return (
    <div className={className}>
      <p className={ui.sectionLabel}>{f.label}</p>
      <button
        type="button"
        className={`${styles.input} ${focused ? styles.inputFocused : ''} ${invalid ? styles.inputInvalid : ''}`}
        onClick={onFocus}
        aria-label={`${f.label} 입력`}
      >
        <span className={raw ? styles.value : styles.placeholder}>
          {raw || f.placeholder}
          {focused && <i className={styles.caret} />}
        </span>
        <span className={styles.unit}>{f.unit}</span>
      </button>
      <p className={styles.error}>{invalid ? `${f.min}~${f.max}${f.unit} 사이로 입력해 주세요` : ''}</p>
    </div>
  );
}

export function FillmeInfo({
  values,
  shots,
  focused,
  onFocusField,
  onSex,
  onPregnant,
  onRetake,
  onNext,
}: Props): JSX.Element {
  return (
    <div className={styles.root}>
      <Stepper className={styles.stepper} active={1} />

      <section className={styles.shots}>
        <div className={styles.shotsText}>
          <p className={styles.shotsTitle}>
            <Icon name="check" size={70} strokeWidth={3} className={styles.shotsCheck} />
            손톱 촬영이 끝났어요
          </p>
          <p className={styles.shotsSub}>사진은 동의하기 전까지 키오스크에만 있어요</p>
          <button type="button" className={styles.retake} onClick={onRetake}>
            <Icon name="retry" size={52} strokeWidth={2.4} />
            다시 촬영하기
          </button>
        </div>
        <div className={styles.thumbs}>
          {(['left', 'right'] as const).map((hand) => (
            <figure key={hand} className={styles.thumb}>
              {shots[hand] ? <img src={shots[hand] ?? ''} alt="" /> : <span className={styles.thumbEmpty} />}
              <figcaption>{hand === 'left' ? '왼손' : '오른손'}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <NumberField
        field="age"
        values={values}
        focused={focused === 'age'}
        onFocus={() => onFocusField('age')}
        className={styles.age}
      />
      <NumberField
        field="height"
        values={values}
        focused={focused === 'height'}
        onFocus={() => onFocusField('height')}
        className={styles.height}
      />
      <NumberField
        field="weight"
        values={values}
        focused={focused === 'weight'}
        onFocus={() => onFocusField('weight')}
        className={styles.weight}
      />

      <div className={styles.sex}>
        <p className={ui.sectionLabel}>성별</p>
        <div className={styles.choiceRow}>
          {(
            [
              ['male', '남자'],
              ['female', '여자'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`${ui.chip} ${styles.choice} ${values.sex === value ? ui.chipSelected : ''}`}
              onClick={() => onSex(value)}
              aria-pressed={values.sex === value}
            >
              <Icon name={value} size={70} strokeWidth={2.4} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {values.sex === 'female' && (
        <div className={styles.pregnant}>
          <p className={ui.sectionLabel}>임신 중이거나 임신을 준비하고 있나요?</p>
          <div className={styles.choiceRow}>
            {(
              [
                [true, '예'],
                [false, '아니요'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                className={`${ui.chip} ${styles.choice} ${values.pregnant === value ? ui.chipSelected : ''}`}
                onClick={() => onPregnant(value)}
                aria-pressed={values.pregnant === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button type="button" className={`${ui.cta} ${styles.cta}`} disabled={!infoValid(values)} onClick={onNext}>
        다음
      </button>
    </div>
  );
}
