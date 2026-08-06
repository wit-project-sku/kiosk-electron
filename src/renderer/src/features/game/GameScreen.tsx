import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { GameState } from '@shared/types/photo';
import type { SupportedLanguage } from '@shared/types/kiosk';
import { usePoseControl } from '@renderer/hooks/usePoseControl';
import { createDinoEngine, GAME_W, GAME_H, type DinoEngineHandle } from './dinoEngine';
import { gameText, type GameTextKey } from './gameTexts';
import styles from './GameScreen.module.css';

/**
 * Wait-time mini game — Monitor 2 (the big customer display).
 *
 * This screen is the GAME and nothing else: the canvas fills the display edge to
 * edge, with no kiosk chrome around it. The only overlay is the count-in after
 * PLAY, which explains the two moves and then gets out of the way.
 *
 * It is played with the body only — the kiosk camera feeds a MediaPipe pose
 * landmarker, a real jump makes the dino jump, a crouch makes it duck. There is
 * no touch input here by design: Monitor 2 has no touch, and Monitor 1 is the
 * control panel (PLAY / replay / show me the photo). Both screens read one
 * `GameState` broadcast from main, so they can never disagree about whose turn
 * it is.
 *
 * The camera <video> belongs to CustomerDisplay and is passed in — opening a
 * second stream for the same device would fight the capture flow.
 */

/** Count-in after PLAY: 1 … 2 … 3 … go. */
const START_COUNTDOWN = 3;

/**
 * If the player leaves the frame mid-run the world freezes rather than killing
 * them. Stay away this long and the run ends by itself, so an abandoned game
 * can't hold someone else's photo hostage.
 */
const ABANDON_MS = 20_000;

interface GameScreenProps {
  game: GameState;
  lang: SupportedLanguage;
  /** The live camera element owned by CustomerDisplay. */
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function GameScreen({ game, lang, videoRef }: GameScreenProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selfieRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DinoEngineHandle | null>(null);

  const [count, setCount] = useState(1);
  const phase = game.phase;
  const counting = phase === 'starting';
  const playing = phase === 'playing';

  const t = (key: GameTextKey): string => gameText(key, lang);

  // ── Engine ────────────────────────────────────────────────────────────────
  // Created once; it owns its own rAF loop and paints its own score, so a live
  // run never triggers a React render (which would fight MediaPipe for the GPU).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createDinoEngine(canvas, {
      onGameOver: (score) => {
        void window.api.game.over(score);
      },
    });
    engineRef.current = engine;
    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  // The run is laid out (and frozen) during the count-in, so the player sees the
  // world they are about to run through instead of a blank canvas.
  useEffect(() => {
    if (counting) engineRef.current?.start();
  }, [counting]);

  const jump = useCallback((): void => engineRef.current?.jump(), []);

  const { ready: poseReady, tracking, ducking } = usePoseControl({
    videoRef,
    // Detect from the moment the game is offered, so Monitor 1 can enable PLAY
    // the instant someone is actually standing in view.
    enabled: phase !== 'idle',
    onJump: jump,
  });

  useEffect(() => {
    engineRef.current?.setDucking(ducking);
  }, [ducking]);

  // Tell Monitor 1 whether body control is actually usable — it gates PLAY.
  useEffect(() => {
    void window.api.game.reportPose(poseReady, tracking);
  }, [poseReady, tracking]);

  // ── Count-in ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!counting) {
      setCount(1);
      return;
    }
    setCount(1);
    let n = 1;
    const id = setInterval(() => {
      n += 1;
      if (n > START_COUNTDOWN) {
        clearInterval(id);
        void window.api.game.begin();
        return;
      }
      setCount(n);
    }, 1000);
    return () => clearInterval(id);
  }, [counting]);

  // ── Freeze conditions ─────────────────────────────────────────────────────
  // Frozen during the count-in, and whenever the player steps out of frame —
  // walking away should never be scored as a crash.
  const away = playing && poseReady && !tracking;
  useEffect(() => {
    engineRef.current?.setPaused(counting || away);
  }, [counting, away]);

  useEffect(() => {
    if (!away) return;
    const id = setTimeout(() => void window.api.game.over(0), ABANDON_MS);
    return () => clearTimeout(id);
  }, [away]);

  // ── Count-in selfie ───────────────────────────────────────────────────────
  // Only while counting in: a body-controlled game fails badly if the player is
  // standing out of shot, and this is the moment to fix that. It disappears the
  // instant the run starts, leaving nothing but the game.
  useEffect(() => {
    if (!counting) return;
    const canvas = selfieRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const render = (): void => {
      raf = requestAnimationFrame(render);
      const video = videoRef.current;
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;
      // Cover-fit: crop the long edge instead of squashing the picture.
      const scale = Math.max(w / video.videoWidth, h / video.videoHeight);
      const sw = w / scale;
      const sh = h / scale;
      ctx.save();
      ctx.scale(-1, 1); // Mirror — a preview of yourself should read as a mirror.
      ctx.drawImage(
        video,
        (video.videoWidth - sw) / 2,
        (video.videoHeight - sh) / 2,
        sw,
        sh,
        -w,
        0,
        w,
        h,
      );
      ctx.restore();
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [counting, videoRef]);

  return (
    // Before PLAY the customer display keeps showing its waiting video, but this
    // stays mounted (just invisible) so the pose model is warm and Monitor 1 can
    // enable PLAY the moment someone steps into view.
    <div className={`${styles.screen} ${phase === 'ready' ? styles.hidden : ''}`}>
      <canvas ref={canvasRef} className={styles.canvas} width={GAME_W} height={GAME_H} />

      {/* Count-in: the number, the two moves, and a mirror to stand in. */}
      {counting && (
        <div className={styles.countIn}>
          <span className={styles.count}>{count}</span>
          <div className={styles.moves}>
            <div className={styles.move}>
              <span className={styles.moveIcon} aria-hidden>
                🦘
              </span>
              <span className={styles.moveText}>{t('jumpTip')}</span>
            </div>
            <div className={styles.move}>
              <span className={styles.moveIcon} aria-hidden>
                🧎
              </span>
              <span className={styles.moveText}>{t('duckTip')}</span>
            </div>
          </div>
          <div className={styles.selfieWrap}>
            <canvas ref={selfieRef} className={styles.selfie} width={640} height={480} />
            {!tracking && <span className={styles.selfieWarn}>{t('standInFrame')}</span>}
          </div>
        </div>
      )}

      {/* Stepped out of frame mid-run — frozen, not failed. */}
      {away && (
        <div className={styles.frozen}>
          <span className={styles.frozenText}>{t('standInFrame')}</span>
        </div>
      )}
    </div>
  );
}
