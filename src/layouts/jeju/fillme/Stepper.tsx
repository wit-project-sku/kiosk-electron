import type { JSX } from 'react';
import { Icon } from './Icon';
import ui from './fillmeUi.module.css';

const STEPS = ['정보 입력', '개인정보 동의'];

/** 촬영 뒤 두 단계(정보 입력 → 동의) 중 어디인지. */
export function Stepper({ active, className }: { active: 1 | 2; className?: string }): JSX.Element {
  return (
    <ol className={`${ui.stepper} ${className ?? ''}`} aria-label={`${STEPS.length}단계 중 ${active}단계`}>
      {STEPS.map((label, i) => {
        const no = i + 1;
        const state = no < active ? ui.stepDone : no === active ? ui.stepActive : '';
        return (
          <li key={label} style={{ display: 'contents' }}>
            {i > 0 && <span className={`${ui.stepLine} ${no <= active ? ui.stepLineDone : ''}`} />}
            <span className={`${ui.step} ${state}`}>
              <span className={ui.stepNo}>{no < active ? <Icon name="check" size={54} strokeWidth={3.2} /> : no}</span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
