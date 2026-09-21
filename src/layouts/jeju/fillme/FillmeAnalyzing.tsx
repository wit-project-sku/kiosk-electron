import type { JSX } from 'react';
import { ANALYZE_STEP_KEYS } from './copy';
import { fillmeArtUrl } from '@renderer/assets/fillme';
import { useLang } from '@renderer/lib/i18n';
import { tx, tLines } from './text';
import styles from './FillmeAnalyzing.module.css';

interface Props {
  /** 0~100. 실제 진행률을 알 수 없어 92%까지 점점 느리게 채운다(샘플과 같음). */
  progress: number;
}

/**
 * 스캔 격자 (analysis-overlay) — 823×823 정사각형을 4×4 로 나누는 가로·세로 다섯
 * 줄씩. 시안 좌표 그대로(분석 판 안에서 x174 · y112 부터 204.46 간격).
 */
const GRID_STEP = 823 / 4;
const GRID_LINES = [0, 1, 2, 3, 4].map((i) => i * GRID_STEP);

/** 단계 아이콘: 끝남 · 지금 · 아직 (7370:14320 · 14329 · 14334). */
const STEP_ART = {
  done: 'step-done',
  current: 'step-current',
  pending: 'step-pending',
} as const;

/**
 * AI 분석 중 — Figma 7334:54793. 좌표와 시안과 다른 곳은 스타일시트 머리말 참고.
 */
export function FillmeAnalyzing({ progress }: Props): JSX.Element {
  const lang = useLang();
  const p = Math.max(0, Math.min(100, progress));
  const step = p >= 100 ? 4 : Math.floor(p / 25);
  const hand = fillmeArtUrl('hand-scan');
  const beam = fillmeArtUrl('scan-beam');
  return (
    <div className={styles.root}>
      <section className={styles.card}>
        <div className={styles.texts}>
          <h2 className={styles.title}>{tx('Fillme_text038', lang)}</h2>
          {/* 단계마다 바뀌던 줄이었다 — 시트가 한 줄만 주는 이유는 copy.ts 참고. */}
          <p className={styles.sub} aria-live="polite">
            {tx('Fillme_text039', lang)}
          </p>
        </div>

        {/* 분석 판 (7334:84386) — 두 손, 그 위에 격자, 맨 위에 스캔 빛줄기. */}
        <div className={styles.stage} aria-hidden="true">
          {hand && <img src={hand} alt="" className={`${styles.hand} ${styles.handLeft}`} draggable={false} />}
          {hand && <img src={hand} alt="" className={`${styles.hand} ${styles.handRight}`} draggable={false} />}
          {GRID_LINES.map((d) => (
            <span key={`h${d}`} className={`${styles.line} ${styles.lineH}`} style={{ top: 112 + d }} />
          ))}
          {GRID_LINES.map((d) => (
            <span key={`v${d}`} className={`${styles.line} ${styles.lineV}`} style={{ left: 174 + d }} />
          ))}
          {beam && <img src={beam} alt="" className={styles.beam} draggable={false} />}
        </div>

        <p className={styles.note}>
          {tLines('Fillme_text040', lang).map((line, i) => (
            <span key={i} className={styles.noteLine}>
              {line}
            </span>
          ))}
        </p>

        <div className={styles.progress}>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${p}%` }} />
          </div>
          <span className={styles.percent}>{Math.floor(p)}%</span>
        </div>

        <ul className={styles.steps}>
          {ANALYZE_STEP_KEYS.map((key, i) => {
            const state = i < step ? 'done' : i === step ? 'current' : 'pending';
            const art = fillmeArtUrl(STEP_ART[state]);
            return (
              <li key={key} className={`${styles.step} ${styles[state]}`}>
                {art && <img src={art} alt="" className={styles.stepIcon} draggable={false} />}
                <span className={styles.stepLabel}>{tx(key, lang)}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
