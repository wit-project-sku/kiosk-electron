import { forwardRef, type TextareaHTMLAttributes } from 'react';
import styles from './controls.module.css';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, ...rest },
  ref,
) {
  const classes = [styles.control, styles.textarea, invalid ? styles.invalid : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return <textarea ref={ref} className={classes} {...rest} />;
});
