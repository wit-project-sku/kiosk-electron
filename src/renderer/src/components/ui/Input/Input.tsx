import { forwardRef, type InputHTMLAttributes } from 'react';
import styles from './controls.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...rest },
  ref,
) {
  const classes = [styles.control, invalid ? styles.invalid : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return <input ref={ref} className={classes} {...rest} />;
});
