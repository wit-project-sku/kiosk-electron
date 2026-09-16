import type { JSX } from 'react';
import { CONSENTS, POLICY_FULL, POLICY_SUB, REFUSE_NOTICE, type ConsentKey } from './copy';
import styles from './PolicySheet.module.css';

interface Props {
  target: ConsentKey;
  onClose: () => void;
  onAgree: () => void;
}

/** 동의 항목 요약 + 개인정보처리방침 전문. 전문은 스크롤로 읽는다. */
export function PolicySheet({ target, onClose, onAgree }: Props): JSX.Element {
  const consent = CONSENTS[target];
  return (
    <div className={styles.overlay}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="policy-title">
        <header className={styles.head}>
          <h2 id="policy-title" className={styles.title}>
            {consent.title}
          </h2>
          <p className={styles.sub}>{POLICY_SUB}</p>
        </header>

        <div className={styles.body}>
          <dl className={styles.summary}>
            {consent.rows.map(([term, desc]) => (
              <div key={term} className={styles.row}>
                <dt>{term}</dt>
                <dd>{desc}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.refuse}>{REFUSE_NOTICE}</p>

          <h3 className={styles.fullTitle}>개인정보처리방침 전문</h3>
          {POLICY_FULL.map((section, i) => (
            <section key={section.heading ?? i} className={styles.section}>
              {section.heading && <h4>{section.heading}</h4>}
              {section.paragraphs.map((p) =>
                p.startsWith('· ') ? (
                  <p key={p} className={styles.bullet}>
                    {p.slice(2)}
                  </p>
                ) : /^[가-힣]\. /.test(p) ? (
                  <h5 key={p}>{p}</h5>
                ) : (
                  <p key={p}>{p}</p>
                ),
              )}
            </section>
          ))}
        </div>

        <footer className={styles.actions}>
          <button type="button" className={styles.close} onClick={onClose}>
            닫기
          </button>
          <button type="button" className={styles.agree} onClick={onAgree}>
            동의하기
          </button>
        </footer>
      </div>
    </div>
  );
}
