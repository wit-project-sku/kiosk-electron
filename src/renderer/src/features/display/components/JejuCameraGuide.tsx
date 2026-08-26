/**
 * Customer-display camera guide — what the second screen shows while a 제주
 * kiosk's visitor is being photographed (`camera` / `countdown` modes). 제주
 * ONLY since 2026-08-26: it briefly ran fleet-wide (with the 손동작 게이트),
 * but the other venues went back to their own legacy screen and an ungated
 * countdown — see the camera branch in CustomerDisplay.
 *
 * ★ ONE OVERLAY IMAGE since 2026-08-24: the designer shipped the whole guide
 * as a single transparent PNG (repo root icons/"Group 1707482852 (1).png",
 * 2155×3739) — the frosted header plate with its title, the no-glasses line,
 * the two gesture chips AND the glowing pose figure are all baked into it. It
 * is stretched over the full-screen camera feed exactly as delivered
 * ("put as it is"), which also means the copy on it is KOREAN ONLY — the
 * per-language strings the old built-up header carried are gone with it.
 *
 * ── The live countdown ────────────────────────────────────────────────
 * The design bakes "'10'" into the title, but the number must count. The
 * shipped copy of the image (assets/icons/jeju/capture-guide.png) has the two
 * DIGITS patched out — the 460…594×195…288 ink filled with the header plate's
 * own rgba(112,117,129,.7) — leaving the baked quotes standing, and `.count`
 * renders the live number into that slot. Quotes stay baked so a one-digit
 * count simply centres between them, the way a re-typeset title could not.
 * If the designer re-exports the overlay, re-run the patch (the numbers live
 * in the CSS comment above `.count`).
 */
import type { RefObject } from 'react';
import { PHOTO_COUNTDOWN_SECONDS } from '@shared/constants/photoOptions';
import type { PhotoGestureGate } from '@shared/types/photo';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { pick } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import styles from './JejuCameraGuide.module.css';

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  lang: Lang;
  /** Live seconds remaining, or null before the count starts. */
  countdown: number | null;
  /**
   * The venue's camera mount rotation (kioskLocations.cameraRotation) — 90 on
   * the 제주 kiosks, whose cameras are mounted sideways. Must be the SAME value
   * useKioskCamera captures with, or the preview and the photo disagree.
   */
  rotation: 0 | 90 | 180 | 270;
  /** 손동작 게이트 — armed at every location. See PhotoGestureGate. */
  gestureGate: PhotoGestureGate;
  /**
   * Hand detection could not start (no model, no GPU delegate, a camera the
   * landmarker cannot read). The overlay's gesture chips are baked in and
   * cannot be hidden, so this states the truth on top of them: the countdown
   * will start by itself.
   */
  detectionUnavailable: boolean;
}

const PAUSED = {
  ko: '일시정지',
  en: 'Paused',
  ja: '一時停止',
  zh: '已暂停',
  vi: 'Tạm dừng',
  th: 'หยุดชั่วคราว',
  ru: 'Пауза',
  id: 'Dijeda',
};

/** Detection is down — the fallback timer will start the count on its own. */
const AUTO_START = {
  ko: '잠시 후 촬영이 자동으로 시작됩니다.',
  en: 'The photo will start automatically in a moment.',
  ja: 'まもなく自動で撮影が始まります。',
  zh: '稍后将自动开始拍摄。',
  vi: 'Ảnh sẽ được chụp tự động sau giây lát.',
  th: 'ระบบจะเริ่มถ่ายภาพอัตโนมัติในอีกสักครู่',
  ru: 'Съёмка начнётся автоматически через несколько секунд.',
  id: 'Pemotretan akan dimulai otomatis sebentar lagi.',
};

export function JejuCameraGuide({
  videoRef,
  lang,
  countdown,
  rotation,
  gestureGate,
  detectionUnavailable,
}: Props): JSX.Element {
  // Before the count starts the design shows the full duration, not a blank.
  const seconds = countdown ?? PHOTO_COUNTDOWN_SECONDS;
  const held = gestureGate === 'held';
  const overlay = jejuIconUrl('capture-guide');
  /** Sideways-mounted camera → the feed box is sized swapped; see .feedRotated. */
  const sideways = rotation === 90 || rotation === 270;

  return (
    <div className={styles.root}>
      {/* Full-bleed feed. The transform composes screen-space outside-in:
          centre (for the swapped-size rotated box) → mirror (the camera faces
          the visitor, so without the flip "raise your hand" points them the
          wrong way) → the mount rotation that stands the sideways sensor frame
          upright (`rotation` — also applied to the captured JPEG in
          useKioskCamera, so what the AR API gets matches what was on glass). */}
      <video
        ref={videoRef}
        className={`${styles.feed} ${sideways ? styles.feedRotated : ''}`}
        style={{
          transform: `${sideways ? 'translate(-50%, -50%) ' : ''}scaleX(-1) rotate(${rotation}deg)`,
        }}
        muted
        playsInline
      />

      {/* The entire guide, exactly as the designer shipped it. Never mirrored —
          it is guidance, not part of the picture. */}
      {overlay && <img src={overlay} alt="" className={styles.overlay} draggable={false} />}

      {/* The live numeral, in the slot patched out of the overlay. Held: it
          dims — a full-brightness number that has stopped moving reads as a
          crashed kiosk; this reads as the deliberate pause it is. */}
      <p className={`${styles.count} ${held ? styles.countHeld : ''}`}>{seconds}</p>

      {detectionUnavailable && <p className={styles.autoStart}>{pick(AUTO_START, lang)}</p>}

      {/* Over the feed, where the visitor is already looking at themselves to
          check whether the kiosk noticed their fist. */}
      {held && (
        <div className={styles.pausedBadge}>
          <span className={styles.pausedBars} aria-hidden="true" />
          {pick(PAUSED, lang)}
        </div>
      )}
    </div>
  );
}
