import type { JSX } from 'react';
import { Icon } from './Icon';
import { fillmeArtUrl } from '@renderer/assets/fillme';
import ui from './fillmeUi.module.css';
import styles from './FillmeIntro.module.css';

/**
 * 단계 그림. 시안의 카메라(7377:155125)는 내보내면 렌즈 선이 빠진 몸통만 나와서,
 * 같은 모양(렌즈 있는 카메라)의 앱 선 아이콘을 시안 크기·굵기로 그린다 —
 * 130 에 획 11 은 24 격자로 2.03. 사람과 결과 그림은 시안에서 내보낸 파일 그대로다
 * (결과 그림은 연주황 원까지 한 장).
 */
const STEPS: { art: 'camera' | 'intro-user' | 'intro-result'; title: string; caption: string }[] = [
  { art: 'camera', title: '손톱 촬영', caption: '왼손, 오른손 순서로\n자동으로 촬영돼요' },
  { art: 'intro-user', title: '정보 입력', caption: '나이·키·몸무게·성별을\n입력해요' },
  { art: 'intro-result', title: '결과 확인', caption: '건강 분석과\n추천 영양제를 알려줘요' },
];

interface Props {
  onStart: () => void;
}

/** 시작 화면 — Figma 7212:66398. 좌표와 시안과 다른 곳은 스타일시트 머리말 참고. */
export function FillmeIntro({ onStart }: Props): JSX.Element {
  const hand = fillmeArtUrl('hand-scan');
  return (
    <div className={styles.root}>
      {/* ── 히어로 카드 (7377:155057) ── */}
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <div className={styles.badges}>
            <span className={styles.badge}>AI 손톱 건강분석</span>
            <span className={styles.with}>with</span>
            {/* 시안에서도 로고 그림이 아니라 글자다 (ExtraBold 50 #2644da). */}
            <span className={styles.brand}>Fillme</span>
          </div>
          <h2 className={styles.title}>
            손톱 사진으로
            <br />
            <em>영양 상태</em>를 확인해요
          </h2>
          <p className={styles.desc}>
            양손 손톱을 촬영하면 AI가 분석해
            <br />
            나에게 맞는 영양제를 추천해 드려요
          </p>
        </div>
        <div className={styles.art} aria-hidden="true">
          <span className={styles.artRing} />
          {hand && <img src={hand} alt="" className={styles.artHand} draggable={false} />}
        </div>
      </section>

      {/* ── 진행순서 (7334:85451) ── */}
      <p className={`${ui.sectionLabel} ${styles.stepsLabel}`}>진행순서</p>
      <ol className={styles.steps}>
        {STEPS.map((s, i) => {
          const art = s.art === 'camera' ? null : fillmeArtUrl(s.art);
          return (
            <li key={s.title} className={styles.step}>
              <span className={styles.stepNo}>{i + 1}</span>
              <div className={styles.stepCard}>
                {s.art === 'camera' ? (
                  <span className={styles.stepIcon}>
                    <Icon name="camera" size={130} strokeWidth={2.03} />
                  </span>
                ) : s.art === 'intro-result' ? (
                  art && <img src={art} alt="" className={styles.stepArt} draggable={false} />
                ) : (
                  <span className={styles.stepIcon}>
                    {art && <img src={art} alt="" className={styles.stepGlyph} draggable={false} />}
                  </span>
                )}
                <div className={styles.stepText}>
                  <p className={styles.stepTitle}>{s.title}</p>
                  <p className={styles.stepCaption}>{s.caption}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <button type="button" className={`${ui.cta} ${styles.cta}`} onClick={onStart}>
        시작하기
      </button>
    </div>
  );
}
