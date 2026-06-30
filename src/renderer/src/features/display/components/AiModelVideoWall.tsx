import { useEffect, useRef, useState } from 'react';
import type { DisplayClip } from '@renderer/lib/videoMap';
import logoUrl from '@renderer/assets/icons/insadong/park-sul-nyeo-logo.svg';
import styles from './AiModelVideoWall.module.css';

interface AiModelVideoWallProps {
  /** Ordered clips for the current screen (sheet order). One loops; several
   *  auto-advance on completion, wrapping (e.g. home 기본화면_1…10). */
  clips: DisplayClip[];
  /** Hide the built-in logo + label (the generating screen renders its own). */
  hideLabel?: boolean;
  /** Hide just the top-left brand logo (e.g. Osaek/Hwaseong have no PARK SUL NYEO logo). */
  hideLogo?: boolean;
  /** Bump this to manually advance to the next clip (e.g. tapping the weather box). */
  advanceSignal?: number;
}

/**
 * AI-model video for the customer display, with a TWO-LAYER double buffer:
 *
 * - A single clip loops forever (native `loop`).
 * - Several clips auto-advance on `ended`, wrapping — this is how the sheet's
 *   numbered home videos (기본화면_1…10) cycle.
 * - The hidden back layer always has the NEXT clip preloaded, so advancing is an
 *   instant cut with no black frame. On a screen change the old clip keeps
 *   playing until the new one can play, so navigation switches fast and smooth.
 *
 * Visibility is driven by React state (`front`); the video `src` is set
 * imperatively so React never clears it on re-render.
 */
export function AiModelVideoWall({
  clips,
  hideLabel = false,
  hideLogo = false,
  advanceSignal = 0,
}: AiModelVideoWallProps): JSX.Element | null {
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);
  const [front, setFront] = useState<'a' | 'b'>('a');
  const [active, setActive] = useState<DisplayClip | null>(null);
  // Non-render engine state.
  const eng = useRef<{ clips: DisplayClip[]; index: number; cleanup: (() => void) | null }>({
    clips: [],
    index: 0,
    cleanup: null,
  });

  const elOf = (l: 'a' | 'b'): HTMLVideoElement | null => (l === 'a' ? aRef.current : bRef.current);

  // Preload the next clip into the hidden back layer so advancing is instant.
  const preloadNext = (frontLayer: 'a' | 'b', list: DisplayClip[], index: number): void => {
    if (list.length <= 1) return;
    const el = elOf(frontLayer === 'a' ? 'b' : 'a');
    const nextClip = list[(index + 1) % list.length];
    if (el && nextClip && el.src !== nextClip.url) {
      el.loop = false;
      el.src = nextClip.url;
      el.load();
    }
  };

  // Reveal clips[index] on the back layer once it can play (the old layer stays
  // visible until then → no black/slow gap).
  const transitionTo = (list: DisplayClip[], index: number, frontLayer: 'a' | 'b'): void => {
    const clip = list[index];
    const back: 'a' | 'b' = frontLayer === 'a' ? 'b' : 'a';
    const el = elOf(back);
    if (!el || !clip) return;
    if (eng.current.cleanup) {
      eng.current.cleanup();
      eng.current.cleanup = null;
    }
    el.loop = list.length <= 1;
    if (el.src !== clip.url) {
      el.src = clip.url;
      el.load();
    }
    const reveal = (): void => {
      el.currentTime = 0;
      void el.play().catch(() => {});
      eng.current.clips = list;
      eng.current.index = index;
      setFront(back);
      setActive(clip);
      preloadNext(back, list, index);
    };
    if (el.readyState >= 3 /* HAVE_FUTURE_DATA */) {
      reveal();
    } else {
      el.addEventListener('canplay', reveal, { once: true });
      eng.current.cleanup = () => el.removeEventListener('canplay', reveal);
    }
  };

  // Mount + whenever the screen's clip set changes (stable URL signature, since
  // clipsForScreen returns a fresh array each render).
  const sig = clips.map((c) => c.url).join('|');
  useEffect(() => {
    if (clips.length === 0) {
      setActive(null);
      return;
    }
    if (eng.current.clips.length === 0) {
      // First mount — show clips[0] on layer A immediately.
      const a = aRef.current;
      if (a) {
        a.loop = clips.length <= 1;
        a.src = clips[0]!.url;
        a.load();
        void a.play().catch(() => {});
      }
      eng.current.clips = clips;
      eng.current.index = 0;
      setFront('a');
      setActive(clips[0]!);
      preloadNext('a', clips, 0);
    } else {
      // Screen change — transition smoothly to the new screen's first clip.
      transitionTo(clips, 0, front);
    }
    return () => {
      if (eng.current.cleanup) {
        eng.current.cleanup();
        eng.current.cleanup = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const onEnded = (layer: 'a' | 'b'): void => {
    if (layer !== front) return; // only the visible layer advances the cycle
    const list = eng.current.clips;
    if (list.length <= 1) {
      // Native-loop safety net so a single clip never freezes on its last frame.
      const el = elOf(layer);
      if (el) {
        el.currentTime = 0;
        void el.play().catch(() => el.load());
      }
      return;
    }
    transitionTo(list, (eng.current.index + 1) % list.length, layer);
  };

  // Manual advance (e.g. tapping the home weather box) — skip the initial value.
  const advanceRef = useRef(advanceSignal);
  useEffect(() => {
    if (advanceSignal === advanceRef.current) return;
    advanceRef.current = advanceSignal;
    const list = eng.current.clips;
    if (list.length <= 1) return;
    transitionTo(list, (eng.current.index + 1) % list.length, front);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceSignal]);

  if (clips.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <video
        ref={aRef}
        className={`${styles.video} ${front === 'a' ? styles.show : styles.hide}`}
        muted
        playsInline
        preload="auto"
        onEnded={() => onEnded('a')}
      />
      <video
        ref={bRef}
        className={`${styles.video} ${front === 'b' ? styles.show : styles.hide}`}
        muted
        playsInline
        preload="auto"
        onEnded={() => onEnded('b')}
      />

      {!hideLabel && !hideLogo && <img className={styles.logo} src={logoUrl} alt="" draggable={false} />}
      {!hideLabel && active?.label && <div className={styles.label}>{active.label}</div>}
      {active?.subtitle && <div className={styles.subtitle}>{active.subtitle}</div>}
    </div>
  );
}
