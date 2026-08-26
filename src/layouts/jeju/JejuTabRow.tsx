/**
 * 제주 three-pill tab row.
 *
 * Shared because two pages draw the byte-identical row — same 1820×170 band at
 * y700, same 580×170 pills, same states:
 *   여기는 제주도   6212:59068   관광명소 / 역사 / 문화
 *   안녕 '하영'     6217:94656   '하영'소개 / '하영'취미생활 / '하영' 건강습관
 * Only the labels differ, so that is all a caller supplies.
 *
 * 2026-08-24: both frames dropped the #e8e8e8 hairline and moved the picked pill
 * from a pale #ffeac7 plate with an orange rule and orange label to a solid
 * #FF7F0F plate with white Bold — checked against BOTH nodes before touching the
 * shared component, since it is the one place the two pages meet.
 */
import styles from './JejuTabRow.module.css';

interface Tab<Id extends string> {
  id: Id;
  label: string;
}

interface Props<Id extends string> {
  tabs: ReadonlyArray<Tab<Id>>;
  value: Id;
  onChange: (next: Id) => void;
  /** Extra class on the row, for callers that re-place it — 여기는 제주도 moves
   *  it to the foot of the page in the low-reach layout. */
  className?: string;
}

export function JejuTabRow<Id extends string>({
  tabs,
  value,
  onChange,
  className,
}: Props<Id>): JSX.Element {
  return (
    <div className={`${styles.tabs} ${className ?? ''}`}>
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={`${styles.tab} ${id === value ? styles.tabActive : ''}`}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
