import type { JSX, RefObject } from 'react';
import type { Hand } from './api';
import { HAND_LABEL } from './copy';
import { cameraRotation } from './camera';
import { FILLME_CONFIG } from './config';
import { Icon, type IconName } from './Icon';
import ui from './fillmeUi.module.css';
import styles from './FillmeCapture.module.css';

export type CapturePhase = 'loading' | 'prepare' | 'countdown' | 'done' | 'error';

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  phase: CapturePhase;
  hands: Hand[];
  current: Hand;
  shots: Record<Hand, string | null>;
  count: number;
  /** 촬영 순간 플래시 — 값이 바뀔 때마다 한 번 번쩍인다. */
  flashKey: number;
  onRetryCamera: () => void;
}

const TIPS: { icon: IconName; title: string; caption: string }[] = [
  { icon: 'hand', title: '손등이 위로', caption: '손톱이 카메라를\n향하게 올려 주세요' },
  { icon: 'spread', title: '손가락은 쫙', caption: '손가락 사이를\n벌려 주세요' },
  { icon: 'focus', title: '가이드 안에', caption: '손톱 3개 이상이\n선명하게 보여야 해요' },
];

function statusText(phase: CapturePhase, hand: Hand, count: number): string {
  const label = HAND_LABEL[hand];
  switch (phase) {
    case 'loading':
      return '카메라를 준비하고 있어요';
    case 'prepare':
      return `${label}을 가이드 안에 올려 주세요`;
    case 'countdown':
      return `${count}초 뒤에 촬영해요`;
    case 'done':
      return `${label} 촬영이 끝났어요`;
    default:
      return '카메라 연결을 확인해 주세요';
  }
}

export function FillmeCapture({
  videoRef,
  phase,
  hands,
  current,
  shots,
  count,
  flashKey,
  onRetryCamera,
}: Props): JSX.Element {
  const rotation = cameraRotation();
  const swap = rotation % 180 !== 0;
  const mirror = FILLME_CONFIG.camera.mirrorPreview ? ' scaleX(-1)' : '';
  const shotUrl = phase === 'done' ? shots[current] : null;

  return (
    <div className={styles.root}>
      <div className={`${styles.status} ${phase === 'done' ? styles.statusDone : ''} ${phase === 'error' ? styles.statusError : ''}`}>
        <span className={styles.statusIcon}>
          <Icon name={phase === 'done' ? 'check' : phase === 'error' ? 'alert' : 'camera'} size={88} strokeWidth={2.2} />
        </span>
        <p className={styles.statusText} aria-live="polite">
          {statusText(phase, current, count)}
        </p>
      </div>

      <div className={styles.hands}>
        {(['left', 'right'] as Hand[]).map((hand) => {
          const done = !!shots[hand];
          const active = hand === current && !done && hands.includes(hand);
          return (
            <span
              key={hand}
              className={`${styles.handChip} ${done ? styles.handDone : ''} ${active ? styles.handActive : ''}`}
            >
              {done ? <Icon name="check" size={64} strokeWidth={3} /> : <span className={styles.handDot} />}
              {HAND_LABEL[hand]}
            </span>
          );
        })}
      </div>

      <div className={styles.camBox}>
        <video
          ref={videoRef}
          className={styles.video}
          style={{
            width: swap ? 1365 : 1820,
            height: swap ? 1820 : 1365,
            transform: `translate(-50%, -50%)${mirror} rotate(${rotation}deg)`,
          }}
          playsInline
          muted
          autoPlay
        />
        {shotUrl && <img src={shotUrl} alt="" className={styles.shot} style={{ transform: mirror.trim() || undefined }} />}

        <i className={`${styles.corner} ${styles.tl}`} />
        <i className={`${styles.corner} ${styles.tr}`} />
        <i className={`${styles.corner} ${styles.bl}`} />
        <i className={`${styles.corner} ${styles.br}`} />

        {(phase === 'prepare' || phase === 'countdown') && (
          <>
            <div className={styles.guide} />
            <span className={styles.guideLabel}>{HAND_LABEL[current]} 가이드</span>
          </>
        )}
        {phase === 'countdown' && (
          <>
            <div className={styles.scan} />
            <div className={styles.count} key={count}>
              {count}
            </div>
          </>
        )}
        {phase === 'done' && (
          <div className={styles.doneBadge}>
            <Icon name="check" size={150} strokeWidth={3} />
          </div>
        )}
        <div key={flashKey} className={flashKey ? styles.flash : undefined} />

        {phase === 'loading' && (
          <div className={styles.state}>
            <span className={styles.spinner} />
            <p>카메라를 준비하고 있어요</p>
          </div>
        )}
        {phase === 'error' && (
          <div className={styles.state}>
            <p className={styles.stateTitle}>카메라를 사용할 수 없어요</p>
            <p>카메라 연결을 확인하거나 직원에게 문의해 주세요</p>
            <button type="button" className={styles.retry} onClick={onRetryCamera}>
              <Icon name="retry" size={64} strokeWidth={2.4} />
              다시 연결하기
            </button>
          </div>
        )}
      </div>

      <p className={`${ui.sectionLabel} ${styles.tipsLabel}`}>촬영 팁</p>
      <ul className={styles.tips}>
        {TIPS.map((tip) => (
          <li key={tip.title} className={styles.tip}>
            <span className={styles.tipIcon}>
              <Icon name={tip.icon} size={92} strokeWidth={1.9} />
            </span>
            <div>
              <p className={styles.tipTitle}>{tip.title}</p>
              <p className={styles.tipCaption}>{tip.caption}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className={styles.auto}>버튼을 누르지 않아도 자동으로 촬영돼요</p>
    </div>
  );
}
