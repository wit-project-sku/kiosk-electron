import type { ReactNode } from 'react';
import styles from './KioskButton.module.css';

interface KioskButtonProps {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  className?: string;
}

export function KioskButton({
  children,
  onClick,
  variant = 'primary',
  className,
}: KioskButtonProps): JSX.Element {
  const base = variant === 'secondary' ? styles.buttonSecondary : styles.button;
  return (
    <button type="button" className={className ? `${base} ${className}` : base} onClick={onClick}>
      {children}
    </button>
  );
}
