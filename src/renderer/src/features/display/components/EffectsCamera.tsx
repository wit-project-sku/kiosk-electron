import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useKioskCamera } from '@renderer/hooks/useKioskCamera';
import { useHandGesture, type SwipeDirection } from '@renderer/hooks/useHandGesture';
import { useFaceTracking, type FaceMetrics } from '@renderer/hooks/useFaceTracking';
import { PHOTO_FILTERS, filterAt, filterCssFor } from '../effectsFilters';
import { wearableById, type Wearable } from '../wearables';
import styles from './EffectsCamera.module.css';

interface EffectsCameraProps {
  /** Camera device chosen by the workflow (same Elgato as the photo flow). */
  deviceId: string | null;
}

/** Thumbnails shown each side of the active filter in the carousel. */
const VISIBLE_EACH_SIDE = 2;

/** A live mini-preview of one filter, sharing the main camera stream. */
function FilterThumb({ stream, filterId }: { stream: MediaStream | null; filterId: string }): JSX.Element {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      className={styles.thumbVideo}
      style={{ filter: filterCssFor(filterId) }}
      muted
      autoPlay
      playsInline
    />
  );
}

/** Map an AR wearable + face metrics into a cover-correct overlay box (display px). */
function overlayBox(
  w: Wearable,
  m: FaceMetrics,
  video: HTMLVideoElement,
  stageW: number,
  stageH: number,
): { left: number; top: number; width: number; height: number; roll: number } | null {
  const vW = video.videoWidth;
  const vH = video.videoHeight;
  if (vW === 0 || vH === 0) return null;
  // object-fit: cover — the video is scaled to fill the stage, then cropped.
  const scale = Math.max(stageW / vW, stageH / vH);
  const dispW = vW * scale;
  const dispH = vH * scale;
  const offX = (stageW - dispW) / 2;
  const offY = (stageH - dispH) / 2;

  const spanNorm = w.type === 'glasses' ? m.eyeDist : m.faceW;
  const width = spanNorm * dispW * w.widthFactor;
  const height = width / w.aspect;
  const anchorX = (w.type === 'glasses' ? m.eyeX : m.foreheadX) * dispW + offX;
  const anchorY = (w.type === 'glasses' ? m.eyeY : m.foreheadY) * dispH + offY;
  const centerY = anchorY - w.offsetYFactor * height;
  return { left: anchorX - width / 2, top: centerY - height / 2, width, height, roll: m.roll };
}

/**
 * Monitor 2 — gesture-driven 인스타 효과 (Instagram-effects) capture.
 *
 * Live camera fills the screen with the active filter applied; an Instagram-style
 * rounded carousel sits underneath. Optionally an AR wearable (hat / 갓 / glasses)
 * — picked on Monitor 1 — is anchored to the face. The user drives everything by
 * hand: ✋ swipe → change effect · ✌️ hold → capture (no countdown). On capture the
 * filter AND the wearable are baked in, then both monitors flip to the result.
 */
export function EffectsCamera({ deviceId }: EffectsCameraProps): JSX.Element {
  const { videoRef, active } = useKioskCamera({ deviceId, enabled: true });
  const [index, setIndex] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [flash, setFlash] = useState(false);
  const [wearableId, setWearableId] = useState('');
  // Transient feedback: a directional swipe cue shown for a beat when the
  // active filter changes (the filter-name label self-animates via CSS).
  const [swipeCue, setSwipeCue] = useState<SwipeDirection | null>(null);
  const capturingRef = useRef(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLImageElement>(null);
  // Latest face metrics + timestamp, for compositing the wearable into the shot.
  const faceRef = useRef<{ m: FaceMetrics; t: number } | null>(null);

  const filter = filterAt(index);
  const wearable = wearableById(wearableId);

  // Share the live stream with the carousel thumbnails once the camera is up.
  useEffect(() => {
    if (!active) return;
    const s = videoRef.current?.srcObject;
    if (s instanceof MediaStream) setStream(s);
  }, [active, videoRef]);

  // Monitor 1 picks the AR wearable; mirror that selection here.
  useEffect(() => window.api.events.onEffectsWearableChanged(setWearableId), []);

  const handleSwipe = (dir: SwipeDirection): void => {
    setIndex((i) => (i + (dir === 'next' ? 1 : -1) + PHOTO_FILTERS.length) % PHOTO_FILTERS.length);
    setSwipeCue(dir);
  };

  // Imperatively place the AR overlay each frame (no React re-render churn).
  const handleFace = useCallback(
    (m: FaceMetrics | null): void => {
      const overlay = overlayRef.current;
      const stage = stageRef.current;
      const video = videoRef.current;
      if (!overlay || !stage || !video || !wearable || !m) {
        if (overlay) overlay.style.opacity = '0';
        faceRef.current = null;
        return;
      }
      const box = overlayBox(wearable, m, video, stage.clientWidth, stage.clientHeight);
      if (!box) {
        overlay.style.opacity = '0';
        return;
      }
      overlay.style.left = `${box.left}px`;
      overlay.style.top = `${box.top}px`;
      overlay.style.width = `${box.width}px`;
      overlay.style.height = `${box.height}px`;
      overlay.style.transform = `rotate(${box.roll}deg)`;
      overlay.style.opacity = '1';
      faceRef.current = { m, t: performance.now() };
    },
    [wearable, videoRef],
  );

  useFaceTracking({ videoRef, enabled: active && wearable != null, onFace: handleFace });

  const handleCapture = (): void => {
    if (capturingRef.current) return;
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    capturingRef.current = true;
    setFlash(true);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      capturingRef.current = false;
      setFlash(false);
      return;
    }
    // Bake the active filter in, and mirror so the saved photo matches the
    // selfie preview the user was posing to.
    ctx.save();
    ctx.filter = filterCssFor(filter.id);
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Composite the AR wearable on top, unfiltered, matching the live overlay.
    const face = faceRef.current;
    const overlay = overlayRef.current;
    if (wearable && overlay && face && performance.now() - face.t < 250) {
      const span = wearable.type === 'glasses' ? face.m.eyeDist : face.m.faceW;
      const w = span * canvas.width * wearable.widthFactor;
      const h = w / wearable.aspect;
      const cx = (wearable.type === 'glasses' ? face.m.eyeX : face.m.foreheadX) * canvas.width;
      const cyAnchor = (wearable.type === 'glasses' ? face.m.eyeY : face.m.foreheadY) * canvas.height;
      const cy = cyAnchor - wearable.offsetYFactor * h;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((face.m.roll * Math.PI) / 180);
      try {
        ctx.drawImage(overlay, -w / 2, -h / 2, w, h);
      } catch {
        // SVG draw can occasionally fail — skip the prop rather than the photo.
      }
      ctx.restore();
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    void window.api.photo.captureEffects({ dataUrl, filterId: filter.id });
  };

  const { ready, handPresent, captureProgress } = useHandGesture({
    videoRef,
    enabled: active,
    onCapture: handleCapture,
    onSwipe: handleSwipe,
  });

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 320);
    return () => clearTimeout(t);
  }, [flash]);

  // Clear the directional swipe cue shortly after it fires.
  useEffect(() => {
    if (!swipeCue) return;
    const t = setTimeout(() => setSwipeCue(null), 520);
    return () => clearTimeout(t);
  }, [swipeCue]);

  const thumbs = useMemo(() => {
    const out: Array<{ filterIndex: number; offset: number }> = [];
    for (let o = -VISIBLE_EACH_SIDE; o <= VISIBLE_EACH_SIDE; o++) {
      out.push({ filterIndex: (index + o + PHOTO_FILTERS.length) % PHOTO_FILTERS.length, offset: o });
    }
    return out;
  }, [index]);

  const RING = 132;
  const ringDash = Math.PI * RING;

  return (
    <div className={styles.root} ref={stageRef}>
      <video
        ref={videoRef}
        className={styles.feed}
        style={{ filter: filterCssFor(filter.id) }}
        muted
        autoPlay
        playsInline
      />

      {wearable && (
        <img ref={overlayRef} className={styles.wearable} src={wearable.src} alt="" draggable={false} />
      )}

      {flash && <div className={styles.flash} />}

      <div className={styles.scrimTop} />
      <div className={styles.scrimBottom} />

      {/* While the model loads — the only text on screen; gone once ready. */}
      {!ready && (
        <div className={styles.topBar}>
          <div className={`${styles.handChip} ${styles.handChipLoading}`}>
            <span className={styles.spinnerDot} />
            효과 준비 중…
          </div>
        </div>
      )}

      {/* Top-right: big, round, icon-only gesture guide. Lights up while a hand is seen. */}
      {ready && (
        <div className={`${styles.gestureIcons} ${handPresent ? styles.gestureIconsOn : ''}`}>
          <div className={styles.gestureIcon}>✋</div>
          <div className={`${styles.gestureIcon} ${styles.gestureIconAccent}`}>✌️</div>
        </div>
      )}

      {captureProgress > 0 && (
        <div className={styles.ringWrap}>
          <svg className={styles.ring} viewBox="0 0 150 150" aria-hidden="true">
            <circle className={styles.ringTrack} cx="75" cy="75" r={RING / 2} />
            <circle
              className={styles.ringFill}
              cx="75"
              cy="75"
              r={RING / 2}
              style={{ strokeDasharray: ringDash, strokeDashoffset: ringDash * (1 - captureProgress) }}
            />
          </svg>
        </div>
      )}

      {/* Directional swipe cue — a chevron flashes on the side you swiped. */}
      {swipeCue && (
        <div className={`${styles.swipeCue} ${swipeCue === 'next' ? styles.swipeCueNext : styles.swipeCuePrev}`}>
          {swipeCue === 'next' ? '❯' : '❮'}
        </div>
      )}

      <div className={styles.bottom}>
        {/* Brief filter-name label — pops on change, then fades (CSS keyframe). */}
        <div key={filter.id} className={styles.filterLabel}>
          {filter.name}
        </div>

        <div className={styles.carousel}>
          {thumbs.map(({ filterIndex, offset }) => (
            <div key={`${filterIndex}-${offset}`} className={`${styles.thumb} ${offset === 0 ? styles.thumbActive : ''}`}>
              <div className={styles.thumbCircle}>
                <FilterThumb stream={stream} filterId={filterAt(filterIndex).id} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
