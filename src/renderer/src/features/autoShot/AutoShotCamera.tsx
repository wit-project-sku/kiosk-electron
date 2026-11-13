import { useEffect, useRef, useState } from 'react';
import { isOk } from '@shared/types/result';
import { DEFAULT_FOOTFALL_TUNING } from '@shared/config/footfall';
import type { FootfallTuning } from '@shared/types/footfall';
import type { AutoShotTiming } from '@shared/types/autoShot';
import { useKioskCamera } from '@renderer/hooks/useKioskCamera';
import { ACTIVITY_EVENTS } from '@renderer/hooks/useInactivityReset';
import { PersonDetector } from '@renderer/lib/footfall/PersonDetector';
import { pickAutoShot } from '@renderer/lib/autoShotPick';
import { useKioskStore } from '@renderer/store/kioskStore';
import { usePhotoStore } from '@renderer/store/photoStore';
import { useOutfitStore } from '@renderer/store/outfitStore';
import { useBackgroundStore } from '@renderer/store/backgroundStore';

/** Give up if the camera does not open in this long. */
const CAMERA_OPEN_TIMEOUT_MS = 10_000;
/** Exposure settles before anything is judged. */
const WARMUP_MS = 1_500;
/** Frames checked for a person, this far apart. Any person in any frame → no shot. */
const PERSON_FRAMES = 3;
const PERSON_FRAME_GAP_MS = 500;

/**
 * Presence, not counting: anyone the detector sees, however far away, means no
 * shot. The footfall counter ignores small boxes (people passing in the distance
 * are not passing the kiosk); here they are exactly who must not be photographed.
 */
const PRESENCE_TUNING: FootfallTuning = { ...DEFAULT_FOOTFALL_TUNING, minBoxAreaRatio: 0 };
const PRESENCE_SCORE = DEFAULT_FOOTFALL_TUNING.trackScoreThreshold;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 자동 촬영 — headless, mounted once in the touch-screen window (App.tsx).
 *
 * Every five minutes (AutoShotTiming, from main) it asks main whether the venue is short of its daily photo
 * minimum (AutoShotService). When it is, and only when the kiosk is truly idle —
 * on the home screen, nobody touched it for five minutes, no photo flow — it
 * opens the photo camera for a few seconds, checks that NOBODY is in the frame,
 * captures one frame and hands it to main, which runs the AR pipeline like a
 * 혼자찍기 with a random outfit. Any touch while the camera is open cancels it.
 * Nothing is shown on either screen.
 *
 * Only venues with `autoShotDailyMin` (제주국제공항, 제주국제여객터미널) ever open
 * the camera here; everywhere else `plan()` answers `enabled: false`.
 */
export function AutoShotCamera(): JSX.Element {
  const [cameraRotation, setCameraRotation] = useState<0 | 90 | 180 | 270 | null>(null);
  const { videoRef, active, capture } = useKioskCamera({
    deviceId: null,
    enabled: cameraRotation !== null,
    rotation: cameraRotation ?? 0,
  });

  // Read from inside the async attempt, which outlives any one render.
  const activeRef = useRef(false);
  activeRef.current = active;
  const captureRef = useRef(capture);
  captureRef.current = capture;
  const lastActivityRef = useRef(Date.now());
  const busyRef = useRef(false);
  const detectorRef = useRef<PersonDetector | null>(null);

  useEffect(() => {
    const touched = (): void => {
      lastActivityRef.current = Date.now();
    };
    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, touched, { passive: true });
    return () => {
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, touched);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timing: AutoShotTiming | null = null;

    const idle = (): boolean =>
      timing !== null &&
      Date.now() - lastActivityRef.current >= timing.idleMs &&
      useKioskStore.getState().screen === 'home' &&
      !usePhotoStore.getState().active;

    const attempt = async (): Promise<void> => {
      if (busyRef.current || !idle()) return;
      const planned = await window.api.autoShot.plan();
      if (!isOk(planned) || !planned.value.enabled || !planned.value.due) return;

      busyRef.current = true;
      const startedAt = Date.now();
      // A touch after this point means a visitor arrived: let go of the camera.
      const stillIdle = (): boolean => !cancelled && lastActivityRef.current < startedAt && idle();
      try {
        setCameraRotation(planned.value.rotation);
        const openBy = Date.now() + CAMERA_OPEN_TIMEOUT_MS;
        while (!activeRef.current && Date.now() < openBy && stillIdle()) await sleep(200);
        if (!activeRef.current || !stillIdle()) return;
        await sleep(WARMUP_MS);

        const video = videoRef.current;
        if (!video || !stillIdle()) return;
        if (!detectorRef.current) {
          const detector = new PersonDetector();
          await detector.load(PRESENCE_TUNING);
          detectorRef.current = detector;
        }
        for (let i = 0; i < PERSON_FRAMES; i += 1) {
          if (i > 0) await sleep(PERSON_FRAME_GAP_MS);
          if (!stillIdle()) return;
          const people = detectorRef.current
            .detect(video, PRESENCE_TUNING)
            .filter((d) => d.confidence >= PRESENCE_SCORE);
          // Someone is in front of the camera — never photograph them. Next check.
          if (people.length > 0) return;
        }

        const dataUrl = captureRef.current();
        setCameraRotation(null);
        if (!dataUrl || !stillIdle()) return;

        const picked = pickAutoShot(
          useOutfitStore.getState().byCategory,
          useBackgroundStore.getState().backgrounds.map((b) => b.backgroundId),
        );
        if (!picked) return;
        await window.api.autoShot.run({ dataUrl, ...picked });
      } catch (error) {
        console.warn('[auto-shot] attempt failed', error);
      } finally {
        setCameraRotation(null);
        busyRef.current = false;
      }
    };

    let timer = 0;
    const loop = (): void => {
      void attempt().finally(() => {
        if (!cancelled && timing) timer = window.setTimeout(loop, timing.checkEveryMs);
      });
    };
    // One ask at mount: a venue without a daily minimum never runs the loop at all.
    void window.api.autoShot.plan().then((planned) => {
      if (cancelled || !isOk(planned) || !planned.value.enabled) return;
      timing = planned.value.timing;
      timer = window.setTimeout(loop, timing.firstCheckMs);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [videoRef]);

  // The camera stream needs an element that keeps decoding — one transparent
  // pixel, never display:none (see FootfallCounter).
  return (
    <video
      ref={videoRef}
      aria-hidden="true"
      muted
      playsInline
      style={{
        position: 'fixed',
        right: 0,
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
