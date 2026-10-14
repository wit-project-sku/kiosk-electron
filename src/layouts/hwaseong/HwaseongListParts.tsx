/**
 * Pieces shared by the 화성 list screens that follow the 오산 list frame —
 * '휴' 뭐먹지 / 뭐사지 (HwaseongListScreen) and 전국시장 / 전국 휴게소
 * (HwaseongMarketList): the ㄱ–ㅎ row and the list window's scroll pill + ▲/▼.
 * Both render with HwaseongListScreen.module.css.
 */
import { Fragment, useEffect, useRef, useState, type RefObject } from 'react';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import styles from './HwaseongListScreen.module.css';

/** The ㄱ–ㅎ row; a tap keeps the names starting with that consonant (tense
    ㄲ/ㄸ/ㅃ/ㅆ/ㅉ count as their plain letter). */
const INITIALS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const PLAIN: Record<string, string> = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' };

/** First consonant of a name's first Hangul syllable ('' for "TOY 매장", "JDX"). */
export function initialOf(name: string): string {
  const code = name.trim().charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return '';
  const c = CHOSEONG[Math.floor(code / 588)]!;
  return PLAIN[c] ?? c;
}

/** One card (390) + the 60 gap — what ▲/▼ move the list by. */
const CARD_PITCH = 450;

export function InitialsRow({ value, onPick }: { value: string; onPick: (c: string) => void }): JSX.Element {
  return (
    <p className={styles.initials}>
      {INITIALS.map((c, i) => (
        <Fragment key={c}>
          <button
            type="button"
            className={`${styles.initial} ${c === value ? styles.initialSelected : ''}`}
            onClick={() => onPick(c)}
          >
            {c}
          </button>
          {i < INITIALS.length - 1 && ' '}
        </Fragment>
      ))}
    </p>
  );
}

/**
 * The list window's scroll state: the 34px pill on the artboard's right edge
 * (null, and no ▲/▼, while everything fits). Re-measures when `contentKey`
 * changes (a new tab or filter).
 */
export function useListScroll(contentKey: unknown): {
  listRef: RefObject<HTMLDivElement | null>;
  thumb: { top: number; size: number } | null;
  scrollBy: (dir: 1 | -1) => void;
  toTop: () => void;
} {
  const listRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ top: number; size: number } | null>(null);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;
    const sync = (): void => {
      const range = el.scrollHeight - el.clientHeight;
      if (range <= 1) return setThumb(null);
      const size = Math.min(1, el.clientHeight / el.scrollHeight);
      setThumb({ size, top: (el.scrollTop / range) * (1 - size) });
    };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', sync);
      ro.disconnect();
    };
  }, [contentKey]);
  return {
    listRef,
    thumb,
    scrollBy: (dir) => listRef.current?.scrollBy({ top: dir * CARD_PITCH, behavior: 'smooth' }),
    toTop: () => listRef.current?.scrollTo({ top: 0 }),
  };
}

/** The pill track and ▲/▼ at (2027, 2103 / 2223); nothing while the list fits. */
export function ListScrollControls({
  thumb,
  scrollBy,
}: {
  thumb: { top: number; size: number } | null;
  scrollBy: (dir: 1 | -1) => void;
}): JSX.Element | null {
  if (!thumb) return null;
  const arrow = hwaseongIconUrl('search-scroll-arrow');
  return (
    <>
      <div className={styles.track} aria-hidden>
        <span className={styles.trackThumb} style={{ top: `${thumb.top * 100}%`, height: `${thumb.size * 100}%` }} />
      </div>
      <button type="button" className={`${styles.scrollBtn} ${styles.scrollUp}`} onClick={() => scrollBy(-1)} aria-label="위로">
        {arrow && <img src={arrow} alt="" className={styles.scrollBtnImg} draggable={false} />}
      </button>
      <button type="button" className={`${styles.scrollBtn} ${styles.scrollDown}`} onClick={() => scrollBy(1)} aria-label="아래로">
        {arrow && <img src={arrow} alt="" className={styles.scrollBtnImg} draggable={false} />}
      </button>
    </>
  );
}
