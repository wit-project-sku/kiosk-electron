import { Loader2 } from 'lucide-react';
import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: number;
  label?: string;
}

/** Centered loading indicator with an optional caption. */
export function Spinner({ size = 24, label }: SpinnerProps): JSX.Element {
  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <Loader2 className={styles.icon} size={size} aria-hidden />
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
}
