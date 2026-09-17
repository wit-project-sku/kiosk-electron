/**
 * The one button every game screen uses.
 *
 * Wraps the tap sound so no game has to remember it, and defaults `type` to
 * "button" — these all live inside the kiosk's page, and a stray submit would
 * reload the renderer and take the visitor's photo session with it.
 */
import type { ReactNode } from 'react';
import { sfx } from '../gameSound';
import styles from './gameUi.module.css';

export type GameButtonVariant = 'primary' | 'ghost' | 'gold';

interface Props {
  children: ReactNode;
  onClick: () => void;
  variant?: GameButtonVariant;
  disabled?: boolean;
  /** Extra class from the calling screen, for width or placement only. */
  className?: string;
}

const VARIANT_CLASS: Record<GameButtonVariant, string> = {
  primary: styles.btnPrimary as string,
  ghost: styles.btnGhost as string,
  gold: styles.btnGold as string,
};

export function GameButton({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  className,
}: Props): JSX.Element {
  return (
    <button
      type="button"
      className={`${styles.btn} ${VARIANT_CLASS[variant]} ${className ?? ''}`}
      disabled={disabled}
      onClick={() => {
        // Guard even though `disabled` already blocks the handler: variants of
        // this button get re-enabled by state that can land between the press
        // and the click on a slow frame.
        if (disabled) return;
        sfx.tap();
        onClick();
      }}
    >
      {children}
    </button>
  );
}
