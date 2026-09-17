import type { JSX, RefObject } from 'react';
import type { Hand } from './api';
import { HAND_LABEL } from './copy';
import { cameraRotation } from './camera';
import { FILLME_CONFIG } from './config';
import { fillmeArtUrl } from '@renderer/assets/fillme';
import { Icon } from './Icon';
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

/** 촬영 팁 (7384:85727) — 그림은 시안에서 내보낸 파일. */
const TIPS: { art: 'tip-hand' | 'tip-spread' | 'tip-focus'; title: string; caption: string }[] = [
  { art: 'tip-hand', title: '손등이 위로', caption: '손톱이 카메라를 향하게\n올려 주세요' },
  { art: 'tip-spread', title: '손가락은 쫙', caption: '손가락 사이를\n벌려 주세요' },
  { art: 'tip-focus', title: '가이드 안에', caption: '손톱 3개 이상이\n선명하게 보여야 해요' },
];

/** 머리말 아래 주황 한 줄 (7334:85110 "*2초 뒤 촬영이 시작됩니다.") — 단계마다 바뀐다. */
function statusText(phase: CapturePhase, hand: Hand, count: number): string {
  const label = HAND_LABEL[hand];
  switch (phase) {
    case 'loading':
      return '*카메라를 준비하고 있어요';
    case 'prepare':
      return `*${label}을 가이드 안에 올려 주세요`;
    case 'countdown':
      return `*${count}초 뒤 촬영이 시작됩니다.`;
    case 'done':
      return `*${label} 촬영이 끝났어요`;
    default:
      return '*카메라 연결을 확인해 주세요';
  }
}

/** 미리보기 칸 1718×1285 안에 4:3 영상을 채운다. */
const VIDEO_W = 1718;
const VIDEO_H = Math.round((VIDEO_W * 3) / 4);

/**
 * 손톱 촬영 — Figma 7334:84998. 좌표와 시안과 다른 곳은 스타일시트 머리말 참고.
 *
 * 시안의 미리보기는 자리만 잡은 사진이다. 실제 촬영에 필요한 겹침(가이드·스캔선·
 * 촬영 완료 표시·플래시·준비 중/오류 안내)은 그 칸 안에 그대로 둔다 — 두 번째 팁이
 * 말하는 '가이드' 가 바로 그것이다.
 */
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
  const countdownArt = fillmeArtUrl('capture-countdown');

  return (
    <div className={styles.root}>
      <p className={styles.note} aria-live="polite">
        {statusText(phase, current, count)}
      </p>

      {/* ── 왼손 · 오른손 (7334:85099) — 지금 찍는 손이 주황. ── */}
      <div className={styles.hands}>
        {(['left', 'right'] as Hand[]).map((hand) => {
          const active = hand === current && hands.includes(hand);
          return (
            <span key={hand} className={active ? `${styles.handTab} ${styles.handActive}` : styles.handTab}>
              {HAND_LABEL[hand]}
            </span>
          );
        })}
      </div>

      {/* ── 촬영 팁 (7384:85728) ── */}
      <ul className={styles.tips}>
        {TIPS.map((tip) => {
          const art = fillmeArtUrl(tip.art);
          return (
            <li key={tip.title} className={styles.tip}>
              <span className={styles.tipIcon}>
                {art && <img src={art} alt="" className={styles[tip.art]} draggable={false} />}
              </span>
              <div className={styles.tipText}>
                <p className={styles.tipTitle}>{tip.title}</p>
                <p className={styles.tipCaption}>{tip.caption}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* ── 카메라 미리보기 (7334:85007) ── */}
      <div className={styles.camBox}>
        <video
          ref={videoRef}
          className={styles.video}
          style={{
            width: swap ? VIDEO_H : VIDEO_W,
            height: swap ? VIDEO_W : VIDEO_H,
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
            {/* 시안의 'Countdown' 원 112 — 남은 초를 그 안에 쓴다. */}
            <div className={styles.count} key={count}>
              {countdownArt && <img src={countdownArt} alt="" className={styles.countArt} draggable={false} />}
              <span className={styles.countNum}>{count}</span>
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
    </div>
  );
}
