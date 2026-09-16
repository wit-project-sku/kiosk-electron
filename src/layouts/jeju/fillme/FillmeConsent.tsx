import type { JSX } from 'react';
import { CHILD_NOTICE, CONSENTS, CONSENT_KEYS, REFUSE_NOTICE, type ConsentKey } from './copy';
import { Icon } from './Icon';
import { Stepper } from './Stepper';
import ui from './fillmeUi.module.css';
import styles from './FillmeConsent.module.css';

interface Props {
  agree: Record<ConsentKey, boolean>;
  childAlert: boolean;
  onToggleAll: () => void;
  onToggle: (key: ConsentKey) => void;
  onOpenPolicy: (key: ConsentKey) => void;
  onAnalyze: () => void;
}

function Check({ on }: { on: boolean }): JSX.Element {
  return (
    <span className={`${styles.check} ${on ? styles.checkOn : ''}`} aria-hidden="true">
      <Icon name="check" size={66} strokeWidth={3.4} />
    </span>
  );
}

export function FillmeConsent({ agree, childAlert, onToggleAll, onToggle, onOpenPolicy, onAnalyze }: Props): JSX.Element {
  const all = CONSENT_KEYS.every((k) => agree[k]);
  return (
    <div className={styles.root}>
      <Stepper className={styles.stepper} active={2} />

      <div className={styles.lead}>
        <p className={styles.leadTitle}>분석을 위해 아래 내용에 동의해 주세요</p>
        <p className={styles.leadSub}>손톱 분석은 FillMe(주식회사 링커버스)가 제공해요</p>
      </div>

      <button
        type="button"
        className={`${styles.all} ${all ? styles.allOn : ''}`}
        onClick={onToggleAll}
        aria-pressed={all}
      >
        <Check on={all} />
        전체 동의
      </button>

      <ul className={styles.items}>
        {CONSENT_KEYS.map((key) => (
          <li key={key} className={styles.item}>
            <div className={styles.itemHead}>
              <button
                type="button"
                className={styles.itemToggle}
                onClick={() => onToggle(key)}
                aria-pressed={agree[key]}
              >
                <Check on={agree[key]} />
                {CONSENTS[key].title}
                <em>(필수)</em>
              </button>
              <button type="button" className={styles.more} onClick={() => onOpenPolicy(key)}>
                전문 보기
                <Icon name="chevron" size={52} strokeWidth={2.6} />
              </button>
            </div>
            <dl className={styles.summary}>
              {CONSENTS[key].rows.map(([term, desc]) => (
                <div key={term} className={styles.row}>
                  <dt>{term}</dt>
                  <dd>{desc}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <p className={styles.refuse}>{REFUSE_NOTICE}</p>
      <p className={`${styles.child} ${childAlert ? styles.childAlert : ''}`}>
        <Icon name="info" size={60} strokeWidth={2.2} />
        {CHILD_NOTICE}
      </p>

      <button type="button" className={`${ui.cta} ${styles.cta}`} disabled={!all} onClick={onAnalyze}>
        분석 시작
      </button>
    </div>
  );
}
