import { type ReactNode, useId } from 'react';
import styles from './Field.module.css';

interface FieldProps {
  label: string;
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  /** Render prop receives the id to wire label + control for a11y. */
  children: (id: string) => ReactNode;
}

/**
 * Accessible field wrapper: associates a label, optional hint, and validation
 * error with its control via a generated id. Keeps form markup DRY across every
 * feature form.
 */
export function Field({ label, error, hint, required, children }: FieldProps): JSX.Element {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>
      {children(id)}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
