import type { JSX } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './Modal.module.css';

export interface ModalAction {
  label: string;
  primary?: boolean;
  onClick: () => void;
}

interface Props {
  icon: IconName;
  tone: 'orange' | 'red';
  title: string;
  body: string;
  /** 본문 아래 칩(예: "왼손 손톱 2개 인식"). */
  chips?: string[];
  detail?: string;
  actions: ModalAction[];
}

export function Modal({ icon, tone, title, body, chips, detail, actions }: Props): JSX.Element {
  return (
    <div className={styles.overlay}>
      <div className={styles.panel} role="alertdialog" aria-modal="true" aria-labelledby="modal-title">
        <span className={`${styles.icon} ${tone === 'red' ? styles.red : styles.orange}`}>
          <Icon name={icon} size={130} strokeWidth={2.2} />
        </span>
        <h2 id="modal-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.body}>{body}</p>
        {chips && chips.length > 0 && (
          <div className={styles.chips}>
            {chips.map((c) => (
              <span key={c} className={styles.chip}>
                {c}
              </span>
            ))}
          </div>
        )}
        {detail && <p className={styles.detail}>{detail}</p>}
        <div className={styles.actions}>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={a.primary ? styles.primary : styles.secondary}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface IdleProps {
  remaining: number;
  onContinue: () => void;
}

/** 무입력 경고 — 남은 초를 크게 보여 주고, 계속하기(또는 아무 곳 터치)로 닫는다. */
export function IdleModal({ remaining, onContinue }: IdleProps): JSX.Element {
  return (
    <div className={styles.overlay} onPointerDown={onContinue}>
      <div className={styles.panel} role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
        <span className={styles.count}>{Math.max(remaining, 0)}</span>
        <h2 id="idle-title" className={styles.title}>
          계속 이용하시겠어요?
        </h2>
        <p className={styles.body}>{'잠시 후 입력한 정보와 사진이 삭제되고\n처음 화면으로 돌아가요'}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onContinue}>
            계속하기
          </button>
        </div>
      </div>
    </div>
  );
}
