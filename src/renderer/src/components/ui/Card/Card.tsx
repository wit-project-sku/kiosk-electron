import { type HTMLAttributes, type ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

/** Generic elevated surface used to group related content. */
export function Card({ children, padded = true, className, ...rest }: CardProps): JSX.Element {
  const classes = [styles.card, padded ? styles.padded : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
