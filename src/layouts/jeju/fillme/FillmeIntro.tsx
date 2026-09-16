import type { JSX } from 'react';
import { Icon, type IconName } from './Icon';
import { fillmeArtUrl } from '@renderer/assets/fillme';
import ui from './fillmeUi.module.css';
import styles from './FillmeIntro.module.css';

const STEPS: { icon: IconName; title: string; caption: string }[] = [
  { icon: 'camera', title: '손톱 촬영', caption: '왼손, 오른손 순서로\n자동 촬영돼요' },
  { icon: 'user', title: '정보 입력', caption: '나이·키·몸무게·성별을\n입력해요' },
  { icon: 'sparkle', title: '결과 확인', caption: '건강분석과\n추천 영양제를 봐요' },
];

interface Props {
  onStart: () => void;
}

export function FillmeIntro({ onStart }: Props): JSX.Element {
  return (
    <div className={styles.root}>
      <section className={`${ui.card} ${styles.hero}`}>
        <div className={styles.heroText}>
          <div className={styles.badges}>
            <span className={styles.badge}>AI 손톱 건강분석</span>
            <span className={styles.with}>
              with <img src={fillmeArtUrl('fillme-logo')} alt="FillMe" className={styles.logo} />
            </span>
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
          <svg className={styles.ring} viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="56" className={styles.ringBase} />
            <circle cx="60" cy="60" r="56" className={styles.ringArcs} pathLength="100" />
          </svg>
          <img src={fillmeArtUrl('hand')} alt="" className={styles.hand} draggable={false} />
        </div>
      </section>

      <p className={`${ui.sectionLabel} ${styles.stepsLabel}`}>이렇게 진행돼요</p>
      <ol className={styles.steps}>
        {STEPS.map((s, i) => (
          <li key={s.title} className={styles.stepCard}>
            <span className={styles.stepNo}>{i + 1}</span>
            <span className={styles.stepIcon}>
              <Icon name={s.icon} size={104} strokeWidth={1.8} />
            </span>
            <p className={styles.stepTitle}>{s.title}</p>
            <p className={styles.stepCaption}>{s.caption}</p>
          </li>
        ))}
      </ol>

      <div className={styles.notice}>
        <Icon name="lock" size={72} strokeWidth={2} className={styles.noticeIcon} />
        <div>
          <p>촬영한 사진은 동의하기 전까지 키오스크 밖으로 나가지 않아요</p>
          <p className={styles.noticeSub}>만 14세 미만은 법정대리인의 동의와 보호 아래 이용해 주세요</p>
        </div>
      </div>

      <button type="button" className={`${ui.cta} ${styles.cta}`} onClick={onStart}>
        시작하기
      </button>
    </div>
  );
}
