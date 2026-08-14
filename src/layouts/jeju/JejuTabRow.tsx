/**
 * 제주 three-pill tab row.
 *
 * Shared because two pages draw the byte-identical row — same 1820×170 band at
 * y700, same 580×170 pills, same active plate (#ffeac7 on a #ff7f0f rule):
 *   여기는 제주도   6212:59067   역사 / 문화 / 관광명소
 *   안녕 '하영'     6217:94656   '하영'소개 / '하영'취미생활 / '하영' 건강습관
 * Only the labels differ, so that is all a caller supplies.
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
}

export function JejuTabRow<Id extends string>({ tabs, value, onChange }: Props<Id>): JSX.Element {
  return (
    <div className={styles.tabs}>
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
