import type { JSX } from 'react';
import { CONSENTS, POLICY_FULL, POLICY_SUB, REFUSE_NOTICE, type ConsentKey } from './copy';
import { useLang } from '@renderer/lib/i18n';
import { tPolicy } from './text';
import styles from './PolicySheet.module.css';

/** 목록 항목 표시 — authored 전문은 가운뎃점, 시트는 붙임표를 쓴다. */
const BULLET = /^[-·]\s*/;
/** '가. ' · 'A. ' 같은 조 안의 작은 제목. */
const SUBHEAD = /^[\uAC00-\uD7A3A-Z]\.\s/;

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
  const lang = useLang();
  const consent = CONSENTS[target];
  /*
   * 전문은 시트가 여덟 언어로 준다. 시트에 줄이 없을 때만 authored 한국어 전문으로
   * 돌아간다 — 그때는 제목도 예전처럼 한국어다.
   *
   * ★ 아직 한국어로 남는 것: 위의 요약 상자(수집 항목·이용 목적·보유 기간)와 거부
   *   안내, 그리고 시행일자 한 줄. 시트에 해당 줄이 없다. 법적 문구라 여기서 지어
   *   옮기지 않는다.
   */
  const doc = tPolicy(lang);
  const sections = doc?.sections ?? POLICY_FULL;
  return (
    <div className={styles.overlay}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="policy-title">
        <header className={styles.head}>
          {/* 시안의 제목은 읽는 문서의 이름이다 — 어느 동의에서 열었는지는 아래
              요약 상자(수집 항목·이용 목적·보유 기간)가 말한다. */}
          <h2 id="policy-title" className={styles.title}>
            {doc?.title ?? '개인정보처리방침'}
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
          {sections.map((section, i) => (
            <section key={section.heading ?? i} className={styles.section}>
              {section.heading && <h4>{section.heading}</h4>}
              {section.paragraphs.map((p, j) =>
                /* 목록 항목: authored 전문은 '·', 시트는 '-' 로 적는다. */
                BULLET.test(p) ? (
                  <p key={j} className={styles.bullet}>
                    {p.replace(BULLET, '')}
                  </p>
                ) : SUBHEAD.test(p) ? (
                  <h5 key={j}>{p}</h5>
                ) : (
                  <p key={j}>{p}</p>
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
