import type { JSX, ReactNode } from 'react';
import { fillmeArtUrl } from '@renderer/assets/fillme';
import styles from './Modal.module.css';

export interface ModalAction {
  label: string;
  primary?: boolean;
  onClick: () => void;
}

/** 머리 그림: 분석 실패의 '!' (7334:84538) · 다시 촬영의 새로고침 (7334:84658). */
export type ModalArt = 'alert' | 'retake';

interface Props {
  art: ModalArt;
  title: string;
  body: string;
  /**
   * 막대(942×24)에 그릴 남은 시간, 0~1. 이 화면의 무입력 타이머다 — 모달을 띄운 채
   * 두면 그 시간이 지나 처음으로 돌아가므로, 막대가 그때까지 남은 시간을 보여 준다.
   */
  timeLeft: number;
  /**
   * '처음으로' 의 모습. 시안이 모달마다 다르다: 분석 실패는 회색 판에 흰 글씨
   * (7334:84651), 다시 촬영과 무입력은 흰 판에 회색 글씨(7334:84753).
   */
  secondary: 'solid' | 'plain';
  actions: ModalAction[];
}

/** 세 모달이 함께 쓰는 판 — 1300 폭, 그림 317 · 제목 · 본문 · 막대 · 버튼 둘. */
function Panel({
  art,
  title,
  body,
  timeLeft,
  children,
  label,
}: {
  art: ReactNode;
  title: string;
  body: string;
  timeLeft: number;
  children: ReactNode;
  label: string;
}): JSX.Element {
  const left = Math.max(0, Math.min(1, timeLeft));
  return (
    <div className={styles.panel} role="alertdialog" aria-modal="true" aria-labelledby={label}>
      <div className={styles.art} aria-hidden="true">
        {art}
      </div>
      <h2 id={label} className={styles.title}>
        {title}
      </h2>
      <p className={styles.body}>{body}</p>
      <div className={styles.bar} aria-hidden="true">
        <div className={styles.barFill} style={{ width: `${left * 100}%` }} />
      </div>
      <div className={styles.actions}>{children}</div>
    </div>
  );
}

/** 분석 실패 · 다시 촬영 안내 — Figma 7334:84538 · 7334:84658. */
export function Modal({ art, title, body, timeLeft, secondary, actions }: Props): JSX.Element {
  const disc = fillmeArtUrl('modal-disc');
  const ring = fillmeArtUrl('modal-alert-ring');
  const retake = fillmeArtUrl('modal-retake');
  return (
    <div className={styles.overlay}>
      <Panel
        label="fillme-modal-title"
        title={title}
        body={body}
        timeLeft={timeLeft}
        art={
          <>
            {disc && <img src={disc} alt="" className={styles.disc} draggable={false} />}
            {art === 'alert' ? (
              <>
                {ring && <img src={ring} alt="" className={styles.alertRing} draggable={false} />}
                {/* 시안에서도 그림이 아니라 글자다(Gmarket Sans Bold 64). */}
                <span className={styles.alertMark}>!</span>
              </>
            ) : (
              retake && <img src={retake} alt="" className={styles.retake} draggable={false} />
            )}
          </>
        }
      >
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            className={
              a.primary ? styles.primary : secondary === 'solid' ? styles.secondarySolid : styles.secondaryPlain
            }
            onClick={a.onClick}
          >
            {a.label}
          </button>
        ))}
      </Panel>
    </div>
  );
}

interface IdleProps {
  remaining: number;
  /** 경고가 뜨는 초 — 막대가 이 시간 동안 비워진다. */
  total: number;
  onContinue: () => void;
  onReset: () => void;
}

/**
 * 무입력 경고 — Figma 7334:84788. 남은 초를 주황 고리 안에 크게 보여 준다.
 *
 * ★ 시안의 주황 버튼은 '다시 촬영하기' 인데, 다른 두 모달에서 복사된 것으로 보여
 *   '계속하기' 로 둔다: 이 경고는 정보 입력·동의 화면 위에도 뜨고, 거기서 '다시
 *   촬영하기' 는 이미 찍은 사진을 버리게 한다. 묻는 말(계속 이용하시겠어요?)에
 *   맞는 답이 계속하기다.
 *
 * 화면 뿌리가 모든 터치에서 무입력 시간을 되돌리므로(JejuFillme 의 poke) 아무 곳을
 * 눌러도 계속된다. 그 되돌림이 이 모달을 먼저 닫아 버리므로 '처음으로' 는 click 이
 * 아니라 pointerdown 에서 처리한다 — 같은 터치 안에서 처리되어야 사라지지 않는다.
 */
export function IdleModal({ remaining, total, onContinue, onReset }: IdleProps): JSX.Element {
  const ring = fillmeArtUrl('modal-idle-ring');
  const left = Math.max(remaining, 0);
  return (
    <div className={styles.overlay}>
      <Panel
        label="fillme-idle-title"
        title="계속 이용하시겠어요?"
        body={'잠시 후 입력한 정보와 사진이 삭제되고\n처음 화면으로 돌아가요'}
        timeLeft={total > 0 ? left / total : 0}
        art={
          <>
            {ring && <img src={ring} alt="" className={styles.disc} draggable={false} />}
            <span className={styles.count}>{left}</span>
          </>
        }
      >
        <button type="button" className={styles.secondaryPlain} onPointerDown={onReset} onClick={onReset}>
          처음으로
        </button>
        <button type="button" className={styles.primary} onClick={onContinue}>
          계속하기
        </button>
      </Panel>
    </div>
  );
}
