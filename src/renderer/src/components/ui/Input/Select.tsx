import { forwardRef, type SelectHTMLAttributes } from 'react';
import styles from './controls.module.css';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, ...rest },
  ref,
) {
  const classes = [styles.control, styles.select, invalid ? styles.invalid : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <select ref={ref} className={classes} {...rest}>
      {children}
    </select>
  );
});
