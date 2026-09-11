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
  /** Play the list through exactly once — no looping, no wrapping — and call
   *  `onDone` when the last clip ends. Used for the one-shot weather clip, which
   *  must hand the display back to the idle sequence when it finishes. */
  playOnce?: boolean;
  /** Fires when a `playOnce` list reaches the end of its last clip. */
  onDone?: () => void;
}

/**
 * AI-model video for the customer display, with a TWO-LAYER double buffer:
 *
 * - A single clip loops forever (native `loop`).
 * - Several clips auto-advance on `ended`, wrapping — this is how the sheet's
 *   numbered home videos (기본화면_1…10) cycle.
 * - `playOnce` opts out of both: the list runs through once and reports `onDone`.
 * - The back layer always has the NEXT clip preloaded, so advancing is an
 *   instant cut with no black frame. On a screen change the swap happens
 *   IMMEDIATELY: the layers switch by z-order, and since a <video> paints
 *   nothing until its first frame is decoded, the outgoing clip (still playing
 *   underneath) covers exactly the decode gap — no wait, no blank.
 *
 * Stacking is driven by React state (`front`); the video `src` is set
 * imperatively so React never clears it on re-render.
 */
export function AiModelVideoWall({
  clips,
  hideLabel = false,
  hideLogo = false,
  playOnce = false,
  onDone,
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
    // A playOnce list never wraps, so there is nothing to preload past the end.
    if (playOnce && index >= list.length - 1) return;
    const el = elOf(frontLayer === 'a' ? 'b' : 'a');
    const nextClip = list[(index + 1) % list.length];
    if (el && nextClip && el.src !== nextClip.url) {
      el.loop = false;
      el.src = nextClip.url;
      el.load();
    }
  };

  // Cut to clips[index] IMMEDIATELY on the back layer — no waiting.
  //
  // The two layers are stacked by z-order (front on top), and a <video> paints
  // nothing until its first frame is decoded, so the outgoing clip — still
  // playing on the layer underneath — stays on screen for exactly the frames
  // the decoder needs and not one more. The switch is as fast as physically
  // possible: caption and state flip on the spot, the new picture lands the
  // instant it exists, and there is never a blank or a stuck old video.
  const transitionTo = (list: DisplayClip[], index: number, frontLayer: 'a' | 'b'): void => {
    const clip = list[index];
    const back: 'a' | 'b' = frontLayer === 'a' ? 'b' : 'a';
    const el = elOf(back);
    if (!el || !clip) return;
    if (eng.current.cleanup) {
      eng.current.cleanup();
      eng.current.cleanup = null;
    }

    // The front layer is already playing this exact file (screens often share a
    // clip — e.g. two pages that both resolve Default): adopt the new list in
    // place instead of reloading the same bytes into the back layer. The video
    // doesn't restart; only the caption swaps.
    const frontEl = elOf(frontLayer);
    if (frontEl && frontEl.src === clip.url) {
      frontEl.loop = !playOnce && list.length <= 1;
      if (frontEl.paused) void frontEl.play().catch(() => {});
      eng.current.clips = list;
      eng.current.index = index;
      setActive(clip);
      preloadNext(frontLayer, list, index);
      return;
    }

    el.loop = !playOnce && list.length <= 1;
    if (el.src !== clip.url) {
      el.src = clip.url;
      el.load();
    } else {
      // Reusing the layer's preloaded file — rewind in case it played before.
      el.currentTime = 0;
    }
    void el.play().catch(() => {});
    eng.current.clips = list;
    eng.current.index = index;
    setFront(back);
    setActive(clip);

    // Preload the FOLLOWING clip only once the new front is actually rendering:
    // until its first frame, the old front is the visible under-layer, and
    // repointing that layer's src early would blank the screen.
    if (el.readyState >= 2 /* HAVE_CURRENT_DATA */) {
      preloadNext(back, list, index);
    } else {
      const handlers: Array<[keyof HTMLVideoElementEventMap, () => void]> = [];
      const detach = (): void => {
        for (const [ev, fn] of handlers) el.removeEventListener(ev, fn);
        eng.current.cleanup = null;
      };
      const onReady = (): void => {
        detach();
        preloadNext(back, list, index);
      };
      const onError = (): void => {
        detach();
        // A broken/missing file: the transparent front leaves the old clip
        // visible underneath. Log it — the screen shows the previous video.
        console.warn('[wall] clip failed to load — previous video stays visible', clip.url);
      };
      handlers.push(['loadeddata', onReady], ['canplay', onReady], ['error', onError]);
      for (const [ev, fn] of handlers) el.addEventListener(ev, fn);
      eng.current.cleanup = detach;
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
        a.loop = !playOnce && clips.length <= 1;
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
    // The front's own data hasn't loaded yet (cleanup = its pending listeners) —
    // an `ended` here would be a stale event; the load path finishes the job.
    if (eng.current.cleanup) return;
    const list = eng.current.clips;
    // One-shot list (the weather clip): walk to the end, then hand back.
    if (playOnce) {
      if (eng.current.index >= list.length - 1) onDone?.();
      else transitionTo(list, eng.current.index + 1, layer);
      return;
    }
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

  if (clips.length === 0) return null;

  // Label/subtitle are rendered from the LIVE clips prop (matched by URL), not
  // the imperatively-stored `active` clip. This way a language change — which
  // recomputes the clips with new subtitle/label text but the SAME video URL —
  // updates the caption immediately, instead of only on the next clip/screen
  // change. Falls back to the stored clip if the URL isn't in the new list.
  const activeClip = active ? clips.find((c) => c.url === active.url) ?? active : null;

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
      {!hideLabel && activeClip?.label && <div className={styles.label}>{activeClip.label}</div>}
      {activeClip?.subtitle && <div className={styles.subtitle}>{activeClip.subtitle}</div>}
    </div>
  );
}
