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
import { useLang } from '@renderer/lib/i18n';
import { tx } from './text';
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
  const lang = useLang();
  const f = FIELDS[field];
  /* 단위: 나이의 '세'만 시트 줄이고 cm·kg 은 글자 그대로다 — copy.ts 참고. */
  const unit = f.unitLiteral ? f.unit : tx(f.unit, lang);
  const raw = values.nums[field];
  const invalid = raw !== '' && !fieldValid(values, field) && !focused;
  return (
    <div className={className}>
      <p className={ui.sectionLabel}>{tx(f.label, lang)}</p>
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
        <span className={styles.unit}>{unit}</span>
      </button>
      {/* 범위 안내는 시트에 줄이 없다 — 숫자와 단위만 바꿔 끼우고 문장은 한국어로 남는다. */}
      {invalid && <p className={styles.error}>{`${f.min}~${f.max}${unit} 사이로 입력해 주세요`}</p>}
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
  const lang = useLang();
  /*
   * 동의 한 줄은 시트에 한 문장으로 있다 — "[개인보호정책] 서비스 제공을 위해 …".
   * 화면에서는 앞의 대괄호가 방침을 여는 링크이고 나머지가 본문이라, 그 대괄호를
   * 잘라 낸다. 여덟 언어가 모두 같은 자리에 대괄호를 쓴다(확인함). 혹시 없는
   * 언어가 생기면 링크 없이 문장만 나오고, 방침은 화면 아래 [개인보호정책] 버튼이
   * 아니라 이 줄 전체가 토글이므로 읽는 데 지장은 없다.
   */
  const consent = tx('Fillme_text035', lang);
  const tag = consent.match(/^\s*\[[^\]]*\]/);
  const policyTag = tag ? tag[0].trim() : '';
  const consentTail = tag ? consent.slice(tag[0].length).trim() : consent;
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
            {tx('Fillme_text022', lang)}
          </p>
          <p className={styles.doneSub}>{tx('Fillme_text023', lang)}</p>
        </div>
        <button type="button" className={styles.retake} onClick={onRetake}>
          <Icon name="retry" size={44} strokeWidth={2.4} />
          {tx('Fillme_text024', lang)}
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
        <p className={ui.sectionLabel}>{tx('Fillme_text029', lang)}</p>
        <div className={styles.choiceRow}>
          {(
            [
              ['male', tx('Fillme_text030', lang)],
              ['female', tx('Fillme_text031', lang)],
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
          <p className={ui.sectionLabel}>{tx('Fillme_text032', lang)}</p>
          <div className={styles.choiceRow}>
            {(
              [
                [true, tx('Fillme_text033', lang)],
                [false, tx('Fillme_text034', lang)],
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
          {policyTag}
        </span>
        {consentTail}
      </button>

      <button
        type="button"
        className={[ui.cta, styles.cta, askPregnant ? styles.ctaShift : ''].filter(Boolean).join(' ')}
        disabled={!ready}
        onClick={onNext}
      >
        {tx('Fillme_text036', lang)}
      </button>
    </div>
  );
}
