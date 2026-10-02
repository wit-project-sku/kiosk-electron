/**
 * ← → swipe buttons for an outfit strip (Figma 6258:48326, 7489:67510…67516).
 *
 * The outfit grids have always been draggable and nothing on screen said so:
 * a catalogue of 22 한복 shows ten cards and the other twelve are reachable
 * only by a visitor who guesses to swipe. The frame answers that with a pair of
 * 85px circles at the right end of the chip band — grey at the edge it cannot
 * move past, the layout's accent otherwise — so this is shared by 제주 and by
 * the 인사동 / 오색 / 화성 picker rather than drawn twice.
 *
 * ── Why it drives the translate rather than calling slideNext ──────────
 * Both pickers run Swiper in `freeMode` with a `Grid`, where a "slide" is a
 * CELL (two per column) and `slideNext()` would step half a column on 제주 and
 * a third of a card on the shared picker. Paging by
 * `(card + gap) × ⌊slidesPerView⌋` moves a whole VIEW and lands the next page's
 * first card exactly on the strip's left edge — 5 cards on 제주's 350/17 grid,
 * 3 of the shared picker's 3.54-per-view (which keeps its peek of the fourth).
 *
 * The buttons are one 85px circle + the frame's own chevron path, drawn inline:
 * the colour has to follow the layout (제주 orange, 화성 blue …) and an exported
 * PNG/SVG pair per kiosk would not.
 */
import { useCallback, useRef, useState } from 'react';
import type { Swiper as SwiperClass } from 'swiper';
import styles from './SwipeNav.module.css';

export interface SwipeNavState {
  /**
   * Spread onto `<Swiper>`. `onSwiper` catches the instance, the rest keep the
   * two buttons' enabled state in step with a drag, a resize or a re-measure.
   */
  bind: {
    onSwiper: (swiper: SwiperClass) => void;
    onProgress: (swiper: SwiperClass) => void;
    onResize: (swiper: SwiperClass) => void;
    onUpdate: (swiper: SwiperClass) => void;
  };
  /** The strip is parked at its left edge — ← is dead. */
  atStart: boolean;
  /** …and at its right edge — → is dead. True as well when nothing scrolls. */
  atEnd: boolean;
  page: (dir: 1 | -1) => void;
}

/** Edge state for a strip that has not measured yet: both buttons dead. */
const PARKED = { atStart: true, atEnd: true };

export function useSwipeNav(): SwipeNavState {
  const ref = useRef<SwiperClass | null>(null);
  const [edges, setEdges] = useState(PARKED);

  const read = useCallback((swiper: SwiperClass) => {
    if (!swiper || swiper.destroyed) return;
    // translate runs from maxTranslate() (right edge, negative) up to
    // minTranslate() (left edge, 0). A span of nothing means the whole
    // catalogue already fits — both ends at once, so neither button lights.
    const span = swiper.minTranslate() - swiper.maxTranslate();
    if (!(span > 1)) {
      setEdges(PARKED);
      return;
    }
    setEdges({
      atStart: swiper.translate >= swiper.minTranslate() - 1,
      atEnd: swiper.translate <= swiper.maxTranslate() + 1,
    });
  }, []);

  const page = useCallback(
    (dir: 1 | -1) => {
      const swiper = ref.current;
      if (!swiper || swiper.destroyed) return;
      const card = swiper.slidesSizesGrid?.[0] || swiper.width;
      const gap = Number(swiper.params.spaceBetween ?? 0);
      const perView = Math.max(1, Math.floor(Number(swiper.params.slidesPerView) || 1));
      const step = (card + gap) * perView;
      const target = Math.min(
        swiper.minTranslate(),
        Math.max(swiper.maxTranslate(), swiper.translate - dir * step),
      );
      swiper.translateTo(target, 320);
      read(swiper);
    },
    [read],
  );

  const onSwiper = useCallback(
    (swiper: SwiperClass) => {
      ref.current = swiper;
      read(swiper);
    },
    [read],
  );

  return { bind: { onSwiper, onProgress: read, onResize: read, onUpdate: read }, ...edges, page };
}

/** The frame's chevron: a 36×18 stroke centred in the 85 circle, ← by default. */
function Chevron(): React.ReactElement {
  return (
    <svg className={styles.icon} viewBox="0 0 85 85" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M48.875 24.4375L30.8125 42.5L48.875 60.5625"
        stroke="#fff"
        strokeWidth="6.435"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SwipeNav({
  nav,
  className,
}: {
  nav: SwipeNavState;
  className?: string;
}): React.ReactElement {
  return (
    <div className={`${styles.nav} ${className ?? ''}`}>
      <button
        type="button"
        className={`${styles.btn} ${nav.atStart ? styles.btnOff : ''}`}
        onClick={() => nav.page(-1)}
        disabled={nav.atStart}
        aria-label="이전"
      >
        <Chevron />
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnNext} ${nav.atEnd ? styles.btnOff : ''}`}
        onClick={() => nav.page(1)}
        disabled={nav.atEnd}
        aria-label="다음"
      >
        <Chevron />
      </button>
    </div>
  );
}
