/**
 * 정보 입력 — Figma 7384:86828. 좌표와 시안과 다른 곳은 스타일시트 머리말 참고.
 *
 * ★ 화면 안의 동의 한 줄("서비스 제공을 위해 이용자의 정보 수집을 동의합니다")이 이
 *   흐름의 유일한 동의다. 2026-09-17 요청으로 별도의 동의 화면(개인정보 수집·이용 /
 *   민감정보 수집·이용 두 체크박스)을 뺐고, '다음으로' 는 곧바로 분석을 시작한다.
 */
import type { JSX } from 'react';
import type { Sex } from './api';
import { FIELDS, type FieldKey } from './copy';
import { Icon } from './Icon';
import ui from './fillmeUi.module.css';
import styles from './FillmeInfo.module.css';

export interface InfoValues {
  nums: Record<FieldKey, string>;
  sex: Sex | null;
  pregnant: boolean | null;
}

interface Props {
  values: InfoValues;
  focused: FieldKey | null;
  /** 화면 안 동의 줄. 체크해야 '다음으로' 가 열린다. */
  agreed: boolean;
  onFocusField: (key: FieldKey) => void;
  onSex: (sex: Sex) => void;
  onPregnant: (value: boolean) => void;
  onToggleAgree: () => void;
  onOpenPolicy: () => void;
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
        className={[
          styles.input,
          field === 'age' ? styles.inputAge : '',
          focused ? styles.inputFocused : '',
          invalid ? styles.inputInvalid : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={onFocus}
        aria-label={`${f.label} 입력`}
      >
        <span className={raw ? styles.value : styles.placeholder}>
          {raw || f.placeholder}
          {focused && <i className={styles.caret} />}
        </span>
        <span className={styles.unit}>{f.unit}</span>
      </button>
      {invalid && <p className={styles.error}>{`${f.min}~${f.max}${f.unit} 사이로 입력해 주세요`}</p>}
    </div>
  );
}

export function FillmeInfo({
  values,
  focused,
  agreed,
  onFocusField,
  onSex,
  onPregnant,
  onToggleAgree,
  onOpenPolicy,
  onRetake,
  onNext,
}: Props): JSX.Element {
  /* 임신 여부는 시안에 없는 행이다 — 보일 때만 동의 줄과 CTA 가 그만큼 내려간다. */
  const askPregnant = values.sex === 'female';
  const ready = infoValid(values) && agreed;
  return (
    <div className={styles.root}>
      {/* ── 촬영 완료 카드 (7334:54100) ── */}
      <section className={styles.done}>
        <div className={styles.doneText}>
          <p className={styles.doneTitle}>
            <Icon name="check" size={56} strokeWidth={3} />
            손톱 촬영이 끝났어요
          </p>
          <p className={styles.doneSub}>사진은 동의 전까지 키오스크에서만 가지고 있어요.</p>
        </div>
        <button type="button" className={styles.retake} onClick={onRetake}>
          <Icon name="retry" size={44} strokeWidth={2.4} />
          다시 촬영하기
        </button>
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
              className={
                values.sex === value
                  ? `${styles.choice} ${styles.choiceOn}`
                  : `${styles.choice} ${styles.choiceSex}`
              }
              onClick={() => onSex(value)}
              aria-pressed={values.sex === value}
            >
              {/* 시안의 기호 글자 그대로 (Bold 96). */}
              <span className={styles.glyph} aria-hidden="true">
                {value === 'male' ? '♂' : '♀'}
              </span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {askPregnant && (
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
                className={values.pregnant === value ? `${styles.choice} ${styles.choiceOn}` : styles.choice}
                onClick={() => onPregnant(value)}
                aria-pressed={values.pregnant === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 동의 한 줄 (7334:54219) ── 방침을 여는 [개인보호정책] 은 줄 전체의 토글을
          삼키지 않도록 자기 클릭만 멈춘다. */}
      <button
        type="button"
        className={[styles.consent, agreed ? styles.consentOn : '', askPregnant ? styles.consentShift : '']
          .filter(Boolean)
          .join(' ')}
        aria-pressed={agreed}
        onClick={onToggleAgree}
      >
        <span className={styles.consentBox}>
          <Icon name="check" size={40} strokeWidth={3} />
        </span>
        <span
          className={styles.policy}
          role="link"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onOpenPolicy();
          }}
        >
          [개인보호정책]
        </span>
        서비스 제공을 위해 이용자의 정보 수집을 동의합니다.
      </button>

      <button
        type="button"
        className={[ui.cta, styles.cta, askPregnant ? styles.ctaShift : ''].filter(Boolean).join(' ')}
        disabled={!ready}
        onClick={onNext}
      >
        다음으로
      </button>
    </div>
  );
}
