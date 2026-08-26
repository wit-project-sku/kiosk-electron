import { useRef } from 'react';
import { useFootfallCounter } from '@renderer/hooks/useFootfallCounter';

/**
 * Headless 유동인구 counter, mounted once at the root of the touch-screen window.
 *
 * The only thing it renders is the `<video>` the camera stream has to attach to.
 * That element is deliberately NOT `display: none`: Chromium is free to stop
 * decoding a display-none video, and a video that stops decoding stops producing
 * the frames this whole feature reads. One transparent pixel in the corner keeps
 * the decoder awake and is invisible on a 2160×3840 artboard.
 *
 * `aria-hidden` and `pointer-events: none` keep it out of the way of touch and
 * of assistive technology — it is not content, it is a sensor.
 *
 * Mounted here rather than in the customer-display window because this window
 * always exists. The display window only opens when a second monitor is
 * detected, and a kiosk with one monitor still has a walkway in front of it.
 */
export function FootfallCounter(): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);

  useFootfallCounter({ video: videoRef });

  return (
    <video
      ref={videoRef}
      aria-hidden="true"
      muted
      playsInline
      style={{
        position: 'fixed',
        left: 0,
        bottom: 0,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
        zIndex: -1,
      }}
    />
  );
}
