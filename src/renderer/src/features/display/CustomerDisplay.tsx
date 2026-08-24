import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppSettings, DisplayState, ImageAsset } from '@shared/types/domain';
import type { KioskId, SupportedLanguage } from '@shared/types/kiosk';
import { isOk } from '@shared/types/result';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { assetUrl, generatedUrl } from '@renderer/lib/media';
import { useKioskCamera } from '@renderer/hooks/useKioskCamera';
import { useHandGesture } from '@renderer/hooks/useHandGesture';
import { usePhotoWorkflow } from '@renderer/hooks/usePhotoWorkflow';
import { usePhotoStore } from '@renderer/store/photoStore';
import { trackEvent } from '@renderer/lib/analytics';
import { displayVideosFor } from '@renderer/assets/videos';
import { clipsForPlayKey, clipsForScreen, initSubtitles, initVideoFiles } from '@renderer/lib/videoMap';
import type { WeatherPlayKey } from '@shared/config/weatherVideo';
import spinnerImg from '@renderer/assets/spinner.svg';
import { KioskArtboard } from '@layouts/components/KioskScreenImage';
import { Slideshow } from './components/Slideshow';
import { VideoWall } from './components/VideoWall';
import { AiModelVideoWall } from './components/AiModelVideoWall';
import { JejuCameraGuide } from './components/JejuCameraGuide';
import styles from './CustomerDisplay.module.css';

const ATTRACT_STATE: DisplayState = {
  mode: 'attract',
  assetIds: [],
  message: null,
  cameraDeviceId: null,
  countdown: null,
  resultFileName: null,
  resultLocked: false,
};

const GEN_WAIT_SECS = 60;

/**
 * 제주 손동작 게이트 — the safety nets under it.
 *
 * The gate exists so the visitor decides when the shutter starts, but a kiosk
 * that will not take a photo until it sees a hand is a kiosk that is broken
 * whenever it cannot see one: a camera the landmarker can't read, a visitor in
 * a wheelchair whose hands are out of frame, a child who doesn't understand the
 * pictogram, bright airport backlight. Every one of those ends in the countdown
 * starting anyway.
 *
 *  WAIT   — nothing seen while armed. Generous: this is the stretch where they
 *           are walking backwards and looking for their spot, and cutting it
 *           short is exactly the bad UX the gate was added to remove.
 *  BLIND  — detection could not start at all. Short, because there is nothing
 *           to wait FOR — just long enough for the briefing to be read and for
 *           them to get clear of the kiosk.
 *  HELD   — a fist has been holding the count. Long enough for a real pause,
 *           short enough that a false positive (crossed arms, a hand in a coat
 *           pocket) cannot strand the session.
 */
const GESTURE_WAIT_FALLBACK_MS = 30_000;
const GESTURE_BLIND_FALLBACK_MS = 8_000;
const GESTURE_HELD_FALLBACK_MS = 45_000;

/** 결제 전 블러 미리보기 위에 덮는 안내 문구(기부 학교 흐름). */
const LOCKED_RESULT_NOTICE = '기부를 완료해 주세요. 완료 후 사진을 다운로드할 수 있습니다.';

/**
 * Monitor 2 — borderless customer display.
 * Follows the photo workflow automatically via DisplayState from main process.
 */
export function CustomerDisplay(): JSX.Element {
  const [state, setState] = useState<DisplayState>(ATTRACT_STATE);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [library, setLibrary] = useState<ImageAsset[]>([]);

  // Current touch-screen + language drive which AI-model video plays here.
  const [kioskScreen, setKioskScreen] = useState<string>('home');
  // DB `buttons.id` of the tapped home tile (null for sub-states / idle) — lets a
  // top-level screen resolve its clip by button id instead of a screen→key guess.
  const [buttonId, setButtonId] = useState<number | null>(null);
  const [lang, setLang] = useState<SupportedLanguage>('ko');
  // Which kiosk this is (W004 → Osaek videos/subtitles). The display window
  // isn't bootstrap-hydrated, so fetch the config over IPC.
  const [kioskId, setKioskId] = useState<string | undefined>(undefined);
  // Set when the user taps the home weather box → the matching Weather_* clip
  // takes over the display; cleared when it finishes, back to the idle sequence.
  const [weatherKey, setWeatherKey] = useState<WeatherPlayKey | null>(null);
  // Bumped once the API subtitles + on-disk video list have loaded, so the clip
  // lookups below recompute against the freshly-populated (was-empty) maps.
  const [dataVersion, setDataVersion] = useState(0);

  // Countdown shown on the generating/waiting screen (counts 60 → 0).
  const [genCountdown, setGenCountdown] = useState(GEN_WAIT_SECS);
  const genTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void window.api.display.getState().then((r) => isOk(r) && setState(r.value));
    void window.api.settings.get().then((r) => isOk(r) && setSettings(r.value));
    void window.api.language.get().then((r) => isOk(r) && setLang(r.value));
    void window.api.app.bootstrap().then((r) => {
      if (!isOk(r)) return;
      const id = r.value.kioskConfig.kioskId as KioskId;
      setKioskId(id);
      // Freshly load, on every launch: (1) the real on-disk video file list,
      // THEN (2) this kiosk's API subtitles. Order matters — initSubtitles drops
      // any entry whose video file isn't known, so the file list must be loaded
      // first. Both replace the initially-empty maps; there is no hardcoded/
      // build-time data. Needs the resolved kioskId so entries land in the right
      // set. Bump dataVersion afterwards so the clip lookups recompute.
      void (async () => {
        const vr = await window.api.videos.list();
        if (isOk(vr) && vr.value) initVideoFiles(vr.value);
        const sr = await window.api.subtitles.get();
        if (isOk(sr) && sr.value) initSubtitles(sr.value, id);
        setDataVersion((v) => v + 1);
      })();
    });

    const offState = window.api.events.onDisplayStateChanged(setState);
    const offSettings = window.api.events.onSettingsChanged(setSettings);
    const offLang = window.api.events.onLanguageChanged(setLang);
    const offScreen = window.api.events.onKioskScreenChanged(({ screen, buttonId }) => {
      setKioskScreen(screen);
      setButtonId(buttonId);
    });
    const offWeatherVideo = window.api.events.onKioskWeatherVideo((key) => setWeatherKey(key));
    return () => {
      offState();
      offSettings();
      offLang();
      offScreen();
      offWeatherVideo();
    };
  }, []);

  // Full ordered clip list for the current screen (sheet order). The wall
  // auto-advances through them on completion (home cycles 기본화면_1…10) and
  // preloads the next clip for an instant, no-flash switch.
  // dataVersion is a dep so these recompute once subtitles/video files load.
  const screenClips = useMemo(
    () => clipsForScreen(kioskScreen, lang, kioskId, buttonId),
    [kioskScreen, buttonId, lang, kioskId, dataVersion],
  );
  const genClips = useMemo(
    () => clipsForScreen('photo', lang, kioskId),
    [lang, kioskId, dataVersion],
  );
  // The clip for the tapped weather condition. Empty when this kiosk's video
  // set doesn't bundle that Weather_* file — then the tap is simply ignored and
  // the idle sequence keeps playing, rather than cutting to an unrelated clip.
  const weatherClips = useMemo(
    () => (weatherKey ? clipsForPlayKey(weatherKey, lang, kioskId) : []),
    [weatherKey, lang, kioskId, dataVersion],
  );

  // Navigating away cancels a playing weather clip — the new screen's own video
  // wins, otherwise the weather clip would keep overriding it.
  useEffect(() => {
    setWeatherKey(null);
  }, [kioskScreen]);

  // The tap resolved to nothing — the API names a Weather_* video this machine
  // doesn't have (see initVideoFiles/initSubtitles). Log it so a missing clip is
  // visible instead of the weather box just looking dead.
  useEffect(() => {
    if (weatherKey && weatherClips.length === 0) {
      console.warn('[display] no weather clip for key — video not bundled?', {
        key: weatherKey,
        kioskId,
      });
    }
  }, [weatherKey, weatherClips.length, kioskId]);
  // Osaek (W004) and Hwaseong (W005) don't use the PARK SUL NYEO brand logo.
  const noBrandLogo = kioskId === 'W004' || kioskId === 'W005';
  // Generic-wall fallback URLs for the active kiosk's video set (W004 → osaek).
  const displayVideos = useMemo(() => displayVideosFor(kioskId), [kioskId, dataVersion]);

  useEffect(() => {
    if (state.mode === 'generating') {
      setGenCountdown(GEN_WAIT_SECS);
      genTimerRef.current = setInterval(() => {
        setGenCountdown((prev) => {
          if (prev <= 1) {
            if (genTimerRef.current) clearInterval(genTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (genTimerRef.current) {
        clearInterval(genTimerRef.current);
        genTimerRef.current = null;
      }
    }
    return () => {
      if (genTimerRef.current) clearInterval(genTimerRef.current);
    };
  }, [state.mode]);

  useEffect(() => {
    if (state.assetIds.length === 0) {
      setLibrary([]);
      return;
    }
    void window.api.images.list(null).then((r) => {
      if (isOk(r)) setLibrary(r.value);
    });
  }, [state.assetIds]);

  const assets = library.filter((a) => state.assetIds.includes(a.id));

  const cameraEnabled = state.mode === 'camera' || state.mode === 'countdown';
  const { videoRef, capture } = useKioskCamera({
    deviceId: state.cameraDeviceId,
    enabled: cameraEnabled,
  });

  const sessionId = usePhotoStore((s) => s.sessionId);
  const clothingKey = usePhotoStore((s) => s.clothingKey);
  const styleKey = usePhotoStore((s) => s.styleKey);

  const captureAndGenerate = useCallback(async () => {
    if (!sessionId || !clothingKey || !styleKey) return;
    const dataUrl = capture();
    if (!dataUrl) return;
    const result = await window.api.photo.captureAndGenerate({ sessionId, dataUrl, clothingKey, styleKey });
    if (!isOk(result)) void trackEvent({ name: 'ai_request_failed', payload: { sessionId } });
  }, [sessionId, clothingKey, styleKey, capture]);

  usePhotoWorkflow(() => {
    void captureAndGenerate();
  });

  // ── 제주 손동작 게이트 ─────────────────────────────────────────────────
  // This window owns the camera stream, so it is the only one that can see the
  // visitor's hand — the gate is therefore driven from here and merely recorded
  // in main. 'off' everywhere else, which makes every branch below inert.
  const gestureGate = usePhotoStore((s) => s.gestureGate);
  const gated = gestureGate !== 'off';

  const { gesture, status: gestureStatus } = useHandGesture({
    video: videoRef,
    enabled: gated && cameraEnabled,
  });

  // Each transition is guarded on the gate main reports rather than on a local
  // flag, so the visitor simply LEAVING their palm up after the count starts
  // sends nothing: 'open' + 'running' matches no branch. Without that, a held
  // pose would fire an IPC call on every stable frame.
  useEffect(() => {
    if (gesture === 'open') {
      if (gestureGate === 'waiting') void window.api.photo.beginCountdown();
      else if (gestureGate === 'held') void window.api.photo.resumeCountdown();
    } else if (gesture === 'fist' && gestureGate === 'running') {
      void window.api.photo.holdCountdown();
    }
  }, [gesture, gestureGate]);

  // Fallback out of 'waiting' — see the constants for why each of these exists.
  // Re-armed when the detector's status changes, so the generous window is
  // measured from the moment it is actually watching, not from the button press.
  useEffect(() => {
    if (gestureGate !== 'waiting') return;
    const ms =
      gestureStatus === 'unavailable' ? GESTURE_BLIND_FALLBACK_MS : GESTURE_WAIT_FALLBACK_MS;
    const timer = setTimeout(() => void window.api.photo.beginCountdown(), ms);
    return () => clearTimeout(timer);
  }, [gestureGate, gestureStatus]);

  // Fallback out of 'held'. Unconditional: if detection died WHILE paused, the
  // open palm that would release it can no longer be seen either.
  useEffect(() => {
    if (gestureGate !== 'held') return;
    const timer = setTimeout(() => void window.api.photo.resumeCountdown(), GESTURE_HELD_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [gestureGate]);

  return (
    <KioskArtboard>
      <div className={styles.stage}>
      {/* ── Idle / attract ── */}
      {(state.mode === 'attract' || state.mode === 'idle') && (
        <>
          {/* A tapped weather clip takes over (played once, then onDone hands
              the display back to this screen's own sequence). Same element
              position + type as the idle wall, so React keeps the instance and
              the swap is the usual smooth double-buffered cut, not a remount. */}
          {weatherClips.length > 0 || screenClips.length > 0 ? (
            <AiModelVideoWall
              clips={weatherClips.length > 0 ? weatherClips : screenClips}
              hideLogo={noBrandLogo}
              playOnce={weatherClips.length > 0}
              onDone={() => setWeatherKey(null)}
            />
          ) : displayVideos.length > 0 ? (
            <VideoWall videos={displayVideos} />
          ) : assets.length > 0 ? (
            <Slideshow assets={assets} intervalMs={settings.slideshowIntervalMs} />
          ) : (
            <div className={styles.attract}>
              <h1 className={styles.attractHeading}>{state.message ?? settings.businessName}</h1>
              <p className={styles.attractSub}>AI Photo Experience</p>
            </div>
          )}
        </>
      )}

      {state.mode === 'slideshow' && assets.length > 0 && (
        <Slideshow assets={assets} intervalMs={settings.slideshowIntervalMs} />
      )}

      {state.mode === 'image' && assets[0] && (
        <img className={styles.media} src={assetUrl(assets[0])} alt="" />
      )}

      {state.mode === 'video' && assets[0] && (
        <video className={styles.media} src={assetUrl(assets[0])} autoPlay loop muted />
      )}

      {/* ── Camera / countdown ──
          ONE screen for every location since 2026-08-24: the gesture-gated
          guide (dark header, palm/fist chips, live feed with the pose outline).
          The legacy Insadong screen — numbered tips, reference-pose boxes,
          disclaimer, branding — is retired along with its per-location branch;
          its styles remain in the CSS should it ever need to come back. */}
      {(state.mode === 'camera' || state.mode === 'countdown') && (
        <JejuCameraGuide
          videoRef={videoRef}
          lang={lang}
          countdown={state.countdown}
          gestureGate={gestureGate}
          detectionUnavailable={gestureStatus === 'unavailable'}
        />
      )}

      {/* ── Generating / waiting ── */}
      {state.mode === 'generating' && (
        <div className={styles.genScreen}>
          {genClips.length > 0 ? (
            // One clip on native loop → perfectly smooth, non-stop while waiting.
            <AiModelVideoWall key="gen" clips={genClips.slice(0, 1)} hideLabel />
          ) : (
            displayVideos.length > 0 && (
              <video key={displayVideos[0]} className={styles.genVideo} autoPlay muted loop playsInline>
                <source src={displayVideos[0]} type="video/mp4" />
              </video>
            )
          )}

          {/* Top-right row: ambassador label + spinner-with-countdown, side by side. */}
          <div className={styles.genTopRow}>
            {genClips[0]?.label && <span className={styles.genLabel}>{genClips[0].label}</span>}
            <div className={styles.genCountWrap}>
              <img className={styles.genSpinnerImg} src={spinnerImg} alt="" draggable={false} />
              {/* 제주 holds this screen past 0 while the visitor finishes
                  틀린그림찾기 (photo:deferResultDisplay). A frozen '0' reads as a
                  hung kiosk, so the number drops out and the spinner alone
                  carries "still working" for the rest of the wait. */}
              {genCountdown > 0 && <span className={styles.genSpinnerNum}>{genCountdown}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ── Result ──
          resultLocked(기부 학교 흐름, 결제 전) → 블러 + 안내 문구.
          결제 완료 시 revealResult 가 잠금을 풀어 선명하게 보인다. */}
      {state.mode === 'result' && state.resultFileName && (
        <>
          <img
            className={`${styles.media}${state.resultLocked ? ` ${styles.mediaLocked}` : ''}`}
            src={generatedUrl(state.resultFileName)}
            alt="Generated result"
          />
          {state.resultLocked && (
            <div className={styles.lockedNotice}>
              <p className={styles.lockedNoticeText}>{LOCKED_RESULT_NOTICE}</p>
            </div>
          )}
        </>
      )}
      </div>
    </KioskArtboard>
  );
}
