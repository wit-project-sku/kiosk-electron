import { type ReactNode } from 'react';
import styles from './Badge.module.css';

interface BadgeProps {
  children: ReactNode;
  variant?: 'neutral' | 'success' | 'danger' | 'accent';
}

export function Badge({ children, variant = 'neutral' }: BadgeProps): JSX.Element {
  return <span className={`${styles.badge} ${styles[variant]}`}>{children}</span>;
}
