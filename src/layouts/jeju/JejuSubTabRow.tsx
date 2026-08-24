/**
 * 제주 sub-tab row — the ㅣ-separated 60px band at y920.
 *
 * Shared because three pages draw the byte-identical control: 안녕 '하영's
 * 취미생활 and 건강습관 tabs, and 도와줘 '하영's floor picker. Only the labels
 * differ, so that is all a caller supplies.
 */
import { Fragment } from 'react';
import styles from './JejuSubTabRow.module.css';

interface Item<Id extends string> {
  id: Id;
  label: string;
}

interface Props<Id extends string> {
  items: ReadonlyArray<Item<Id>>;
  value: Id;
  onChange: (next: Id) => void;
  /** Extra class on the row, for callers that re-place it — 안녕 '하영' moves it
   *  below the tab row at the foot of the page in the low-reach layout, and
   *  도와줘 '하영' draws its band on y940 rather than y920. */
  className?: string;
  /** Smaller band for the W007 home board's 국제항 ㅣ 연안항 row. */
  compact?: boolean;
}

export function JejuSubTabRow<Id extends string>({
  items,
  value,
  onChange,
  className,
  compact,
}: Props<Id>): JSX.Element {
  return (
    <div className={`${styles.row} ${compact ? styles.compact : ''} ${className ?? ''}`}>
      {items.map(({ id, label }, i) => (
        <Fragment key={id}>
          {i > 0 && (
            <span className={styles.sep} aria-hidden="true">
              ㅣ
            </span>
          )}
          <button
            type="button"
            className={`${styles.item} ${id === value ? styles.itemActive : ''}`}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
