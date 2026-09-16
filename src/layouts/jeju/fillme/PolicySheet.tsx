import type { JSX } from 'react';
import { CONSENTS, POLICY_FULL, POLICY_SUB, REFUSE_NOTICE, type ConsentKey } from './copy';
import styles from './PolicySheet.module.css';

interface Props {
  target: ConsentKey;
  onClose: () => void;
}

/**
 * 동의 항목 요약 + 개인정보처리방침 전문 — Figma 7334:54335. 전문은 스크롤로 읽는다.
 *
 * ★ 읽기만 하는 창이다: 시안이 '동의하기' 를 뺐고, 동의는 정보 입력 화면의 체크 줄과
 *   동의 화면의 체크박스에서 받는다.
 */
export function PolicySheet({ target, onClose }: Props): JSX.Element {
  const consent = CONSENTS[target];
  return (
    <div className={styles.overlay}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="policy-title">
        <header className={styles.head}>
          {/* 시안의 제목은 읽는 문서의 이름이다 — 어느 동의에서 열었는지는 아래
              요약 상자(수집 항목·이용 목적·보유 기간)가 말한다. */}
          <h2 id="policy-title" className={styles.title}>
            개인정보처리방침
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

        <button type="button" className={styles.close} onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
