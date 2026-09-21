import type { JSX, RefObject } from 'react';
import type { Hand } from './api';
import { cameraRotation } from './camera';
import { FILLME_CONFIG } from './config';
import { fillmeArtUrl } from '@renderer/assets/fillme';
import { Icon } from './Icon';
import { useLang } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { tx, tLines } from './text';
import styles from './FillmeCapture.module.css';

/** 손 이름도 시트가 준다 — copy.ts 의 HAND_LABEL 은 한국어뿐이었다. */
const HAND_KEY: Record<Hand, string> = { left: 'Fillme_text013', right: 'Fillme_text014' };

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

/** 촬영 팁 (7384:85727) — 그림은 시안에서 내보낸 파일, 글은 시트 KEY. */
const TIPS: { art: 'tip-hand' | 'tip-spread' | 'tip-focus'; title: string; caption: string }[] = [
  { art: 'tip-hand', title: 'Fillme_text015', caption: 'Fillme_text016' },
  { art: 'tip-spread', title: 'Fillme_text017', caption: 'Fillme_text018' },
  { art: 'tip-focus', title: 'Fillme_text019', caption: 'Fillme_text020' },
];

/*
 * 시트가 주는 줄은 준비(Fillme_subtitle2)와 카운트다운(Fillme_text012) 둘뿐이고,
 * 둘 다 손 이름이 들어가지 않는 통문장이다("왼손/오른손을 가이드 안에 올려
 * 주세요", "*2초 뒤 촬영이 시작됩니다."). 그래서 예전처럼 손 이름을 문장에 끼워
 * 넣지 않는다 — 조사(을/를)는 언어마다 사라지거나 자리가 달라 끼워 넣을 수가
 * 없다. 지금 찍는 손은 바로 아래 왼손·오른손 칩이 주황으로 알려 준다.
 *
 * 카운트다운 숫자는 시트 문장이 '2초'로 박혀 있어 실제 남은 초로 바꿔 준다 —
 * config 의 countdownSeconds 는 3 이라 그대로 두면 틀린 숫자를 읽는다.
 * 준비 중·오류는 시트에 줄이 없어 빈 문자열이다(그 두 상태는 미리보기 칸 안의
 * .state 안내가 따로 말해 준다).
 */
function statusText(phase: CapturePhase, count: number, lang: Lang): string {
  switch (phase) {
    case 'prepare':
      return tx('Fillme_subtitle2', lang);
    case 'countdown':
      return tx('Fillme_text012', lang).replace(/\d+/, String(count));
    case 'done':
      return tx('Fillme_text022', lang);
    default:
      return '';
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
  const lang = useLang();
  const rotation = cameraRotation();
  const swap = rotation % 180 !== 0;
  const mirror = FILLME_CONFIG.camera.mirrorPreview ? ' scaleX(-1)' : '';
  const shotUrl = phase === 'done' ? shots[current] : null;
  const countdownArt = fillmeArtUrl('capture-countdown');
  /* 왼손 → 엄지 오른쪽, 오른손 → 엄지 왼쪽. 실제 키오스크에서 반대로 보이면
     이 한 줄만 뒤집으면 된다(그림 파일은 서로 대칭이라 이름만 바꿔도 된다). */
  const guideArt = fillmeArtUrl(current === 'left' ? 'guide-left' : 'guide-right');

  return (
    <div className={styles.root}>
      <p className={styles.note} aria-live="polite">
        {statusText(phase, count, lang)}
      </p>

      {/* ── 왼손 · 오른손 (7334:85099) — 지금 찍는 손이 주황. ── */}
      <div className={styles.hands}>
        {(['left', 'right'] as Hand[]).map((hand) => {
          const active = hand === current && hands.includes(hand);
          return (
            <span key={hand} className={active ? `${styles.handTab} ${styles.handActive}` : styles.handTab}>
              {tx(HAND_KEY[hand], lang)}
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
                <p className={styles.tipTitle}>{tx(tip.title, lang)}</p>
                <p className={styles.tipCaption}>
                  {tLines(tip.caption, lang).map((line, i) => (
                    <span key={i} className={styles.tipCaptionLine}>
                      {line}
                    </span>
                  ))}
                </p>
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
            {/* 손 모양 가이드 — 지금 찍는 손의 그림을 미리보기 위에 겹친다.
                두 그림은 서로 좌우 대칭이고, 어느 쪽이 어느 손인지는 카메라가
                손등을 본다는 데서 나온다(팁 '손등이 위로'): 손등을 보면 오른손은
                엄지가 왼쪽에, 왼손은 엄지가 오른쪽에 온다. 화면이 좌우반전이면
                (mirrorPreview) 영상 속 손도 뒤집히므로 가이드도 같이 뒤집어야
                실제 손과 겹친다 — 그래서 video 와 같은 mirror 를 쓴다. */}
            {guideArt ? (
              <img
                src={guideArt}
                alt=""
                className={styles.guideArt}
                style={{ transform: `translateX(-50%)${mirror}` }}
                draggable={false}
              />
            ) : (
              /* 그림이 없는 빌드에서는 예전의 점선 테두리로 돌아간다. */
              <div className={styles.guide} />
            )}
            <span className={styles.guideLabel}>{tx(HAND_KEY[current], lang)}</span>
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
