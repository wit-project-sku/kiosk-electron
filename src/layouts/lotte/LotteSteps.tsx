/**
 * Numbered how-to list (영화 나눔 참여 방법 · 미션 참여 방법): 140 rose squares with the step number,
 * a bold line and a muted line beside each. Not tappable — it explains, it does not navigate.
 */
import styles from './LotteSteps.module.css';
import ui from './lotteUi.module.css';

export interface Step {
  title: string;
  sub: string;
}

export function LotteSteps({
  steps,
  heading,
  compact = false,
}: {
  steps: readonly Step[];
  heading?: string;
  /** 110 squares with a 10% red wash and tighter lines — the 미션 상세 (M-02) build. */
  compact?: boolean;
}): JSX.Element {
  return (
    <div className={`${ui.card} ${styles.card} ${compact ? styles.compact : ''}`}>
      {heading && <h2 className={ui.heading}>{heading}</h2>}
      {steps.map((st, i) => (
        <div key={st.title} className={styles.step}>
          <span className={styles.num}>{i + 1}</span>
          <div className={styles.text}>
            <span className={styles.title}>{st.title}</span>
            <span className={styles.sub}>{st.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
