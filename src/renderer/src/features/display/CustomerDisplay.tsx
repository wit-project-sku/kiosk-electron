import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSettings, DisplayState, ImageAsset } from '@shared/types/domain';
import type { SupportedLanguage } from '@shared/types/kiosk';
import { isOk } from '@shared/types/result';
import { DEFAULT_SETTINGS } from '@shared/constants';
import { PHOTO_COUNTDOWN_SECONDS } from '@shared/constants/photoOptions';
import { assetUrl, generatedUrl } from '@renderer/lib/media';
import { useKioskCamera } from '@renderer/hooks/useKioskCamera';
import { useFacePresence } from '@renderer/hooks/useFacePresence';
import { usePhotoWorkflow } from '@renderer/hooks/usePhotoWorkflow';
import { usePhotoStore } from '@renderer/store/photoStore';
import { stayInFrameAudioUrl } from '@renderer/assets/audio';
import { trackEvent } from '@renderer/lib/analytics';
import { displayVideosFor } from '@renderer/assets/videos';
import { cameraIconUrl } from '@renderer/assets/icons/insadong/camera';
import { clipsForScreen } from '@renderer/lib/videoMap';
import spinnerImg from '@renderer/assets/spinner.svg';
import { KioskArtboard } from '@layouts/components/KioskScreenImage';
import { Slideshow } from './components/Slideshow';
import { VideoWall } from './components/VideoWall';
import { AiModelVideoWall } from './components/AiModelVideoWall';
import { EffectsCamera } from './components/EffectsCamera';
import { GameScreen } from '@renderer/features/game/GameScreen';
import styles from './CustomerDisplay.module.css';

const ATTRACT_STATE: DisplayState = {
  mode: 'attract',
  assetIds: [],
  message: null,
  cameraDeviceId: null,
  countdown: null,
  resultFileName: null,
};

const GEN_WAIT_SECS = 60;

/** "Please stand in front of the camera" — shown + spoken when no face is seen. */
const STAY_IN_FRAME: Record<SupportedLanguage, string> = {
  ko: '카메라 앞에 서 주세요',
  en: 'Please stand in front of the camera',
  ja: 'カメラの前に立ってください',
  zh: '请站在镜头前',
  zh_cn: '请站在镜头前',
  zh_tw: '請站在鏡頭前',
  vi: 'Vui lòng đứng trước máy ảnh',
  th: 'กรุณายืนอยู่หน้ากล้อง',
  es: 'Por favor, colócate frente a la cámara',
};

/** Re-speak the "stand in frame" prompt this often while still absent. */
const VOICE_REPROMPT_MS = 4500;

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
  const [lang, setLang] = useState<SupportedLanguage>('ko');
  // Which kiosk this is (W004 → Osaek videos/subtitles). The display window
  // isn't bootstrap-hydrated, so fetch the config over IPC.
  const [kioskId, setKioskId] = useState<string | undefined>(undefined);
  // Which clip of the current screen's list is showing. Tapping the home
  // weather card advances this; navigating to another screen resets it to 0 so
  // each screen always starts on its own first (related) clip.
  const [clipIndex, setClipIndex] = useState(0);

  // Countdown shown on the generating/waiting screen (counts 60 → 0).
  const [genCountdown, setGenCountdown] = useState(GEN_WAIT_SECS);
  const genTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void window.api.display.getState().then((r) => isOk(r) && setState(r.value));
    void window.api.settings.get().then((r) => isOk(r) && setSettings(r.value));
    void window.api.language.get().then((r) => isOk(r) && setLang(r.value));
    void window.api.app.bootstrap().then((r) => isOk(r) && setKioskId(r.value.kioskConfig.kioskId));

    const offState = window.api.events.onDisplayStateChanged(setState);
    const offSettings = window.api.events.onSettingsChanged(setSettings);
    const offLang = window.api.events.onLanguageChanged(setLang);
    const offScreen = window.api.events.onKioskScreenChanged((screen) => {
      // New screen → start on its first (related) clip.
      setKioskScreen(screen);
      setClipIndex(0);
    });
    const offAdvance = window.api.events.onKioskVideoAdvanced(() =>
      setClipIndex((i) => i + 1),
    );
    return () => {
      offState();
      offSettings();
      offLang();
      offScreen();
      offAdvance();
    };
  }, []);

  const screenClips = clipsForScreen(kioskScreen, lang, kioskId);
  // Rotate so the tapped clip is first (AiModelVideoWall loops clips[0]). Wraps
  // around so repeated taps cycle through every clip for the screen.
  const activeIndex = screenClips.length ? clipIndex % screenClips.length : 0;
  const modelClips = screenClips.length
    ? [...screenClips.slice(activeIndex), ...screenClips.slice(0, activeIndex)]
    : screenClips;
  const genClips = clipsForScreen('photo', lang, kioskId);
  // Generic-wall fallback URLs for the active kiosk's video set (W004 → osaek).
  const displayVideos = displayVideosFor(kioskId);

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

  // The wait-time mini game runs here during `generating` and needs the camera
  // for body control, so the stream outlives the capture itself.
  const game = usePhotoStore((s) => s.game);
  // Mounted (and holding the camera) for the whole offer, so the pose model is
  // warm before PLAY. Only VISIBLE once the visitor actually starts a run —
  // until then this display keeps playing its waiting video as usual.
  const gameActive = state.mode === 'generating' && game.phase !== 'idle';
  const gameVisible = gameActive && game.phase !== 'ready';

  const captureEnabled = state.mode === 'camera' || state.mode === 'countdown';
  const { videoRef, setVideoEl, capture } = useKioskCamera({
    deviceId: state.cameraDeviceId,
    enabled: captureEnabled || gameActive,
  });

  // Is a person actually in front of the camera? Used to hold the countdown so
  // we never auto-capture an empty frame and feed it to the AI. Scoped to the
  // capture phases only: during the game the pose landmarker owns the video, and
  // two MediaPipe graphs against one <video> starve each other.
  const { present, ready: faceReady } = useFacePresence({ videoRef, enabled: captureEnabled });

  const sessionId = usePhotoStore((s) => s.sessionId);
  const clothingKey = usePhotoStore((s) => s.clothingKey);
  const styleKey = usePhotoStore((s) => s.styleKey);

  const captureAndGenerate = useCallback(async () => {
    if (!sessionId || !clothingKey || !styleKey) return;
    // Belt-and-suspenders: the countdown is held while absent, so it can only
    // reach 0 with a face present — but never send an empty frame regardless.
    if (faceReady && !present) return;
    const dataUrl = capture();
    if (!dataUrl) return;
    const result = await window.api.photo.captureAndGenerate({ sessionId, dataUrl, clothingKey, styleKey });
    if (!isOk(result)) void trackEvent({ name: 'ai_request_failed', payload: { sessionId } });
  }, [sessionId, clothingKey, styleKey, capture, faceReady, present]);

  usePhotoWorkflow(() => {
    void captureAndGenerate();
  });

  // ── Presence gating: pause/resume the capture countdown + voice prompt ──────
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const wasPresentRef = useRef(true);

  const playStayInFrame = useCallback(() => {
    const url = stayInFrameAudioUrl(lang);
    if (!url) return;
    try {
      const el = voiceRef.current ?? (voiceRef.current = new Audio());
      if (el.src !== url) el.src = url;
      el.currentTime = 0;
      void el.play().catch(() => {});
    } catch {
      // Audio playback is best-effort; the on-screen prompt still shows.
    }
  }, [lang]);

  useEffect(() => {
    // Only gate during the live countdown, and only once the detector is ready.
    if (state.mode !== 'countdown' || !faceReady) {
      wasPresentRef.current = true;
      return;
    }
    if (present) {
      if (!wasPresentRef.current) void window.api.photo.resumeCountdown();
      wasPresentRef.current = true;
    } else {
      if (wasPresentRef.current) {
        void window.api.photo.pauseCountdown();
        playStayInFrame();
      }
      wasPresentRef.current = false;
    }
  }, [present, faceReady, state.mode, playStayInFrame]);

  // Keep nudging (audio) every few seconds while the person is still away.
  useEffect(() => {
    if (state.mode !== 'countdown' || !faceReady || present) return;
    const id = setInterval(playStayInFrame, VOICE_REPROMPT_MS);
    return () => clearInterval(id);
  }, [state.mode, faceReady, present, playStayInFrame]);

  const showStayPrompt = state.mode === 'countdown' && faceReady && !present;

  // Camera-guide assets (Figma 4795:43166). Names match the Figma node names.
  const guideOverlay = cameraIconUrl('guide-overlay');
  const noGlasses = cameraIconUrl('no-glasses');
  const poseLeft = cameraIconUrl('pose-ref-left');
  const poseRightFrame = cameraIconUrl('pose-ref-right-frame');
  const poseRight = cameraIconUrl('pose-ref-right');

  return (
    <KioskArtboard>
      <div className={styles.stage}>
      {/* ── Idle / attract ── */}
      {(state.mode === 'attract' || state.mode === 'idle') && (
        <>
          {modelClips.length > 0 ? (
            <AiModelVideoWall key={`${kioskScreen}:${activeIndex}`} clips={modelClips} />
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

      {/* ── 인스타 효과 (gesture-driven Instagram effects) ── */}
      {state.mode === 'effects' && <EffectsCamera deviceId={state.cameraDeviceId} />}

      {state.mode === 'slideshow' && assets.length > 0 && (
        <Slideshow assets={assets} intervalMs={settings.slideshowIntervalMs} />
      )}

      {state.mode === 'image' && assets[0] && (
        <img className={styles.media} src={assetUrl(assets[0])} alt="" />
      )}

      {state.mode === 'video' && assets[0] && (
        <video className={styles.media} src={assetUrl(assets[0])} autoPlay loop muted />
      )}

      {/* ── Camera / countdown ── (Figma 4795:43166, 2160×3840 artboard) */}
      {(state.mode === 'camera' || state.mode === 'countdown') && (
        <div className={styles.cameraScreen}>
          {/* Top: title + numbered tips. Left '10' is static info; the badge on
              the right is the LIVE countdown. */}
          <div className={styles.camText}>
            <div className={styles.camTitleRow}>
              <p className={styles.camTitle}>
                <span className={styles.camCount}>&apos;{PHOTO_COUNTDOWN_SECONDS}&apos;</span>
                <span className={styles.camTitleRest}> 초후에 촬영이 됩니다.</span>
              </p>
              <div className={styles.camLiveCount}>{state.countdown ?? PHOTO_COUNTDOWN_SECONDS}</div>
            </div>
            <ol className={styles.camTips}>
              <li className={styles.camTip}>
                <span className={styles.camTipIconGap} aria-hidden />안경은 벗고 찍어주세요.
              </li>
              <li className={styles.camTip}>원안에 ‘얼굴’과 ‘손’을 넣어주세요.</li>
              <li className={styles.camTip}>원 밖으로 나가면 이상하게 합성될 수 있어요.</li>
            </ol>
          </div>
          {noGlasses && (
            <img src={noGlasses} className={styles.camNoGlasses} alt="" draggable={false} />
          )}

          {/* Middle: live camera + dashed guide overlay */}
          <div className={styles.camFeedWrap}>
            <video ref={setVideoEl} className={styles.camFeed} muted playsInline />
            {guideOverlay && (
              <img src={guideOverlay} className={styles.camGuide} alt="" draggable={false} />
            )}
            {showStayPrompt && (
              <div className={styles.camPrompt}>
                <span>{STAY_IN_FRAME[lang] ?? STAY_IN_FRAME.ko}</span>
              </div>
            )}
          </div>

          {/* Bottom: two reference-pose boxes */}
          {poseLeft && (
            <img src={poseLeft} className={styles.camRefLeft} alt="" draggable={false} />
          )}
          <div className={styles.camRefRight}>
            {poseRightFrame && (
              <img src={poseRightFrame} className={styles.camRefRightFrame} alt="" draggable={false} />
            )}
            {poseRight && (
              <img src={poseRight} className={styles.camRefRightImg} alt="" draggable={false} />
            )}
          </div>

          <p className={styles.camDisclaimer}>
            # 날씨가 어둡거나 흐린날은 AI 사진 합성이 어색할 수 있어요
          </p>
          <p className={styles.camBranding}>WIT GLOBAL &nbsp;x&nbsp; DIGICON</p>
        </div>
      )}

      {/* ── Generating — wait-time mini game, played with the body ──
          The camera <video> is mounted (offscreen) so the pose landmarker has a
          source; GameScreen paints its frames into the coach canvas itself. It
          is safe to share `videoRef` with the capture screen above because the
          two branches are mutually exclusive modes. */}
      {gameActive && (
        <>
          <video ref={setVideoEl} className={styles.gameFeed} muted playsInline />
          <GameScreen game={game} lang={lang} videoRef={videoRef} />
        </>
      )}

      {/* ── Generating / waiting — shown until a run actually starts ── */}
      {state.mode === 'generating' && !gameVisible && (
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
              <span className={styles.genSpinnerNum}>{genCountdown}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {state.mode === 'result' && state.resultFileName && (
        <img
          className={styles.media}
          src={generatedUrl(state.resultFileName)}
          alt="Generated result"
        />
      )}
      </div>
    </KioskArtboard>
  );
}
