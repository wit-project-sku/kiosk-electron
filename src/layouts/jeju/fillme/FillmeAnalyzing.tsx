import type { JSX } from 'react';
import { ANALYZE_STEPS, ANALYZE_SUBS } from './copy';
import { fillmeArtUrl } from '@renderer/assets/fillme';
import { Icon } from './Icon';
import styles from './FillmeAnalyzing.module.css';

interface Props {
  /** 0~100. 실제 진행률을 알 수 없어 92%까지 점점 느리게 채운다(샘플과 같음). */
  progress: number;
}

export function FillmeAnalyzing({ progress }: Props): JSX.Element {
  const p = Math.max(0, Math.min(100, progress));
  const step = p >= 100 ? 4 : Math.floor(p / 25);
  return (
    <div className={styles.root}>
      <section className={styles.card}>
        <div className={styles.ring} aria-hidden="true">
          <svg viewBox="0 0 120 120" className={styles.ringSvg}>
            <circle cx="60" cy="60" r="56" className={styles.ringBase} />
            <circle cx="60" cy="60" r="56" className={styles.ringArcs} pathLength="100" />
          </svg>
          <img src={fillmeArtUrl('hand')} alt="" className={styles.hand} draggable={false} />
          <span className={styles.scan} />
        </div>

        <h2 className={styles.title}>AI가 손톱을 분석하고 있어요</h2>
        <p className={styles.sub} aria-live="polite">
          {ANALYZE_SUBS[step]}
        </p>

        <div className={styles.progress}>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${p}%` }} />
          </div>
          <span className={styles.percent}>{Math.floor(p)}%</span>
        </div>

        <ul className={styles.steps}>
          {ANALYZE_STEPS.map((label, i) => {
            const state = i < step ? styles.done : i === step ? styles.current : '';
            return (
              <li key={label} className={`${styles.step} ${state}`}>
                <span className={styles.stepCheck}>
                  {i < step ? <Icon name="check" size={52} strokeWidth={3.4} /> : <span className={styles.stepDot} />}
                </span>
                {label}
              </li>
            );
          })}
        </ul>
      </section>

      <p className={styles.note}>
        <Icon name="clock" size={58} strokeWidth={2.2} />
        보통 10~30초 걸려요. 화면을 떠나지 말고 잠시 기다려 주세요
      </p>
      <p className={styles.powered}>
        Powered by <img src={fillmeArtUrl('fillme-logo')} alt="FillMe" />
      </p>
    </div>
  );
}
