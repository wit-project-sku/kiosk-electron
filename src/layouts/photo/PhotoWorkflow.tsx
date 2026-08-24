import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { WEB_EMBED_URLS } from '@shared/constants/webEmbeds';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { usePhotoWorkflow } from '@renderer/hooks/usePhotoWorkflow';
import { useSpotDiffRounds } from '@renderer/hooks/useSpotDiffRound';
import { usePhotoStore } from '@renderer/store/photoStore';
import { useKioskStore } from '@renderer/store/kioskStore';
import { generatedUrl } from '@renderer/lib/media';
import { pick, useLang } from '@renderer/lib/i18n';
import { ui } from '@renderer/lib/uiText';
import { trackEvent } from '@renderer/lib/analytics';
import { resolveButton } from '@renderer/lib/buttonCatalog';
import { HanbokSelect, type CaptureMode } from './HanbokSelect';
import { JejuHanbokSelect } from '../jeju/JejuHanbokSelect';
import { JejuSpotDiffGame } from '../jeju/JejuSpotDiffGame';
import { usePhotoChrome } from './photoChrome';
import { RESULT } from './photoTexts';
import styles from './PhotoWorkflow.module.css';

/** Where the 굿즈제작 button's QR points. */
const GOODS_URL = 'https://insarang.kr/';
/** Phone save page — the result image URL is appended. Matches the (working)
 *  Unity kiosk, which uses the Vercel host (netlify is the fallback mirror). */
const SAVE_BASE = 'https://withphoto.vercel.app/?imageUrl=';

/**
 * AI 한복 photo workflow — Monitor 1 (touch kiosk).
 *
 * Phase map:
 *   clothing / style  → HanbokSelect (outfit selection, no popup)
 *   preview / countdown → camera-popup.png only (nothing else)
 *   generating        → camera popup; 제주 plays 틀린그림찾기 instead
 *   result            → WIT Store webview (Monitor 2 shows result image),
 *                       gated on the 제주 game finishing — see the gate below
 */
export function PhotoWorkflow(): JSX.Element {
  const phase = usePhotoStore((s) => s.phase);
  // Identifies the photo session — also what the waiting game keys its puzzle
  // prefetch on, so a new visitor gets a new board.
  const sessionId = usePhotoStore((s) => s.sessionId);
  const errorMessage = usePhotoStore((s) => s.errorMessage);
  const resultFileName = usePhotoStore((s) => s.resultFileName);
  const resultUrl = usePhotoStore((s) => s.resultUrl);
  const reset = usePhotoStore((s) => s.reset);
  const kioskId = useKioskStore((s) => s.config.kioskId);
  const screen = useKioskStore((s) => s.screen);
  const lang = useLang();
  const hasPayment = getKioskLocation(kioskId).hasCardTerminal;
  const rotating = useRotatingBanner();
  const chrome = usePhotoChrome();
  const { isHwaseong, icon, Header, photoTitle, banner: chromeBanner } = chrome;
  // Osan/Hwaseong have their own single promo banner; insadong rotates through several.
  const banner = chromeBanner ?? rotating;
  const [goodsQrOpen, setGoodsQrOpen] = useState(false);
  const [saveQrOpen, setSaveQrOpen] = useState(false);

  usePhotoWorkflow();

  // ── 제주 waiting game gate ──────────────────────────────────────────────
  // 제주 CAN fill the AI wait with 틀린그림찾기 instead of a static popup, and when
  // it does the result is gated on the GAME rather than the clock:
  // `GENERATING_MIN_MS` in photo.handlers is a 60s floor, so the photo can land
  // while someone is still hunting, and `gameDone` is what lets the result
  // screen through.
  //
  // DISABLED 2026-08-24 at the user's request — the wait shows the
  // camera-direction popup again, exactly as it did before the game landed.
  // This one flag is the whole switch: the puzzle prefetch below stops asking
  // for rounds, the Monitor 2 deferral stops holding the big screen back, and
  // the render block further down falls through to the 한복 capture screen,
  // which already draws that popup through `generating`. So the result now
  // hands over the moment it is ready instead of waiting for a player.
  //
  // To bring the game back, restore `chrome.isJeju` — nothing else was removed.
  // Typed `boolean` rather than left as the `false` literal so the branches it
  // guards do not narrow to unreachable code.
  const playsWaitingGame: boolean = false;
  const [gameDone, setGameDone] = useState(false);
  const deferredRef = useRef(false);

  // Pick the puzzles and decode their images NOW — sessionId is set the moment
  // the visitor opens the outfit step, which is ~30s of idle network before the
  // capture. Doing it when the game appears would collide with the photo upload
  // and the synthesis request. Several boards, because a fast player is offered
  // 다시 하기 and that replay must not go to the network either.
  const gameRounds = useSpotDiffRounds(playsWaitingGame ? sessionId : null);

  // Hold Monitor 2 on its waiting screen for as long as the game runs, so the
  // big screen doesn't hand over the photo the visitor is still playing for.
  useEffect(() => {
    if (!playsWaitingGame || phase !== 'generating' || deferredRef.current) return;
    deferredRef.current = true;
    void window.api.photo.setDeferResultDisplay(true);
  }, [playsWaitingGame, phase]);

  // A new session (or a 다시찍기 / 홈) re-arms the gate. Keyed on the phase
  // leaving the generating→result pair rather than on the reset handler, so
  // every route back to the start clears it, not just the button.
  useEffect(() => {
    if (phase === 'generating' || phase === 'result') return;
    setGameDone(false);
    deferredRef.current = false;
  }, [phase]);

  const handleGameFinish = useCallback(() => {
    setGameDone(true);
    deferredRef.current = false;
    void window.api.photo.releaseResultDisplay();
  }, []);

  const handleReset = (): void => {
    void window.api.photo.reset();
    reset();
    // The photo flow left the display reporting 'photo'/'hanbok_explain'; re-sync
    // it to the screen we return to so the customer display plays its video again.
    void window.api.kiosk.setScreen(screen);
  };

  const handleCapture = async (mode: CaptureMode, category: string): Promise<void> => {
    const button = resolveButton(kioskId, mode === 'solo' ? 'photo_solo' : 'photo_together');
    void trackEvent({
      name: 'button_clicked',
      payload: {
        screen: 'photo_capture_start',
        mode,
        category,
        buttonId: button?.id ?? null,
        buttonName: button?.buttonName ?? null,
        position: button?.position ?? null,
        kioskId,
      },
    });
    await window.api.photo.selectClothing(category);
    await window.api.photo.selectStyle(mode);
    // EVERY location hands the trigger to the visitor now (2026-08-24): the
    // press only brings the camera up, and the countdown waits for the
    // open-palm gesture Monitor 2 is watching for. Started as 제주-only; the
    // fallback timers inside the gate (see JejuCameraGuide / CustomerDisplay)
    // are what make this safe on a kiosk whose camera or hand model is dead —
    // the count starts by itself rather than never.
    await window.api.photo.armGestureGate();
  };

  // ── 제주 only: 틀린그림찾기 while the AI works ─────────────────────────────
  // Deliberately ahead of the capture block, which would otherwise keep drawing
  // the camera-direction popup through `generating`. Note the second clause: the
  // game also survives INTO the result phase, which is what makes the finished
  // photo wait for a player who hasn't finished yet.
  // `errorMessage` opts out: a failed generation leaves the phase on
  // 'generating' (setError does not move it), so without this clause the game
  // would sit on "AI 사진을 마무리하고 있어요" forever over a photo that is never
  // coming. Falling through restores the pre-game behaviour for that path.
  if (
    playsWaitingGame &&
    !errorMessage &&
    (phase === 'generating' || (phase === 'result' && !gameDone))
  ) {
    return (
      <JejuSpotDiffGame
        rounds={gameRounds}
        aiReady={phase === 'result'}
        onFinish={handleGameFinish}
        onHome={handleReset}
      />
    );
  }

  // ── Outfit selection + capture (countdown → capture → generating) ──────────
  // Keep the AR 한복체험 screen on Monitor 1 throughout; during capture overlay
  // the camera-direction popup ("look at the camera between the screens").
  if (phase === 'clothing' || phase === 'style' || phase === 'preview' || phase === 'countdown' || phase === 'generating') {
    const capturing = phase === 'preview' || phase === 'countdown' || phase === 'generating';
    // 제주 redraws this step entirely (own taxonomy, background-theme row, its
    // own layout) — same contract, different screen.
    if (chrome.isJeju) {
      return <JejuHanbokSelect onHome={handleReset} onCapture={handleCapture} countdownActive={capturing} />;
    }
    return <HanbokSelect onHome={handleReset} onCapture={handleCapture} countdownActive={capturing} />;
  }

  // ── Result (PAYMENT kiosks W003/W004): WIT Store on Monitor 1; result image big on Monitor 2 ──
  if (phase === 'result' && hasPayment) {
    const imageUrl = resultUrl ?? (resultFileName ? generatedUrl(resultFileName) : '');
    const saveUrl = `${SAVE_BASE}${encodeURIComponent(imageUrl)}`;
    return (
      <>
        {isHwaseong ? (
          <>
            <div className={styles.bgBase} />
            {icon('bg') && <img className={styles.bgHw} src={icon('bg')} alt="" draggable={false} />}
          </>
        ) : (
          icon('bg') && <img className={styles.bg} src={icon('bg')} alt="" draggable={false} />
        )}

        <Header title="위드마켓" onHome={handleReset} />

        <div className={styles.marketBody}>
          {WEB_EMBED_URLS.market ? (
            // eslint-disable-next-line react/no-unknown-property
            <webview src={WEB_EMBED_URLS.market} partition="persist:embeds" className={styles.marketEmbed} />
          ) : (
            <div className={styles.marketPlaceholder}>{ui('marketComingSoon', lang)}</div>
          )}
        </div>

        {/* QR (save to phone) + 저장하기 + 다시찍기 — Figma 1939:17008 */}
        <div className={styles.payActions}>
          <div className={styles.payQrBox}>
            <QRCodeSVG value={saveUrl} level="M" style={{ width: '100%', height: '100%' }} />
          </div>
          <svg className={styles.payArrow} viewBox="0 0 76 86" fill="none" aria-hidden="true">
            <path
              d="M70 43 H8 M32 19 L6 43 L32 67"
              stroke="var(--photo-accent, #fe6c50)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <button type="button" className={styles.paySaveBtn} onClick={() => setSaveQrOpen(true)}>
            저장하기
          </button>
          <button type="button" className={styles.payRetakeBtn} onClick={handleReset}>
            다시찍기
          </button>
        </div>

        <div className={styles.leftNav}>
          <button type="button" className={styles.leftNavBtn} onClick={handleReset} aria-label="홈으로">
            {icon('home-btn') && <img src={icon('home-btn')} alt="" draggable={false} />}
          </button>
          <button type="button" className={styles.leftNavBtn} onClick={handleReset} aria-label="뒤로">
            {icon('back-arrow') && <img src={icon('back-arrow')} alt="" draggable={false} />}
          </button>
        </div>

        {banner && (
          <button type="button" className={styles.banner} onClick={handleReset} aria-label="가상 한복 체험">
            <img src={banner} alt="" draggable={false} />
          </button>
        )}

        {/* 저장하기 → bigger QR popup so the user can scan it comfortably. */}
        {saveQrOpen && (
          <div className={styles.qrOverlay} onClick={() => setSaveQrOpen(false)}>
            <div className={styles.qrModal} onClick={(e) => e.stopPropagation()}>
              <button type="button" className={styles.qrClose} onClick={() => setSaveQrOpen(false)} aria-label="닫기">
                <X className={styles.qrCloseIcon} strokeWidth={2.4} />
              </button>
              <QRCodeSVG className={styles.qrModalImg} value={saveUrl} level="M" />
            </div>
          </div>
        )}

        {errorMessage && <p className={styles.error}>{errorMessage}</p>}
      </>
    );
  }

  // ── Result (NO-PAYMENT kiosks W001/W002/W005): show the result image + QR to save ──
  if (phase === 'result') {
    const c = pick(RESULT, lang);
    const imageUrl = resultUrl ?? (resultFileName ? generatedUrl(resultFileName) : '');
    const saveUrl = `${SAVE_BASE}${encodeURIComponent(imageUrl)}`;

    return (
      <>
        {isHwaseong ? (
          <>
            <div className={styles.bgBase} />
            {icon('bg') && <img className={styles.bgHw} src={icon('bg')} alt="" draggable={false} />}
          </>
        ) : (
          icon('bg') && <img className={styles.bg} src={icon('bg')} alt="" draggable={false} />
        )}

        <Header title={photoTitle} onHome={handleReset} subtitle={c.subtitle} />

        <div className={styles.resultContent}>
          <div className={styles.resultStep}>
            <span className={styles.resultStepNum}>3</span>
            <span className={styles.resultStepTitle}>{c.step}</span>
          </div>

          {resultFileName && (
            <div className={styles.resultPhoto}>
              <img src={generatedUrl(resultFileName)} alt="" draggable={false} />
            </div>
          )}

          <p className={styles.resultHint}>
            {c.saveHint.lead}
            <span className={styles.resultHintAccent}>{c.saveHint.accent}</span>
          </p>

          <div className={styles.resultBottom}>
            <div className={styles.resultQr}>
              <QRCodeSVG value={saveUrl} level="M" style={{ width: '100%', height: '100%' }} />
            </div>
            <div className={styles.resultButtons}>
              <button type="button" className={styles.resultBtn} onClick={() => setSaveQrOpen(true)}>
                {c.save}
              </button>
              <button type="button" className={`${styles.resultBtn} ${styles.resultBtnAlt}`} onClick={() => setGoodsQrOpen(true)}>
                {c.goods}
              </button>
              <button type="button" className={styles.resultBtn} onClick={handleReset}>
                {c.retake}
              </button>
            </div>
          </div>

          {/* Description text — sits under the buttons, with a larger gap above. */}
          <div className={styles.resultNote}>
            {c.note.map((line, i) => (
              <span key={i}>
                {i === 0 ? '★ ' : ''}
                {line}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.leftNav}>
          <button type="button" className={styles.leftNavBtn} onClick={handleReset} aria-label="홈으로">
            {icon('home-btn') && <img src={icon('home-btn')} alt="" draggable={false} />}
          </button>
          <button type="button" className={styles.leftNavBtn} onClick={handleReset} aria-label="뒤로">
            {icon('back-arrow') && <img src={icon('back-arrow')} alt="" draggable={false} />}
          </button>
        </div>

        {banner && (
          <button type="button" className={styles.banner} onClick={handleReset} aria-label="가상 한복 체험">
            <img src={banner} alt="" draggable={false} />
          </button>
        )}

        {/* 저장하기 → bigger QR popup (save to phone) so the user can scan it comfortably. */}
        {saveQrOpen && (
          <div className={styles.qrOverlay} onClick={() => setSaveQrOpen(false)}>
            <div className={styles.qrModal} onClick={(e) => e.stopPropagation()}>
              <button type="button" className={styles.qrClose} onClick={() => setSaveQrOpen(false)} aria-label="닫기">
                <X className={styles.qrCloseIcon} strokeWidth={2.4} />
              </button>
              <QRCodeSVG className={styles.qrModalImg} value={saveUrl} level="M" />
            </div>
          </div>
        )}

        {/* 굿즈제작 QR popup → insarang.kr */}
        {goodsQrOpen && (
          <div className={styles.qrOverlay} onClick={() => setGoodsQrOpen(false)}>
            <div className={styles.qrModal} onClick={(e) => e.stopPropagation()}>
              <button type="button" className={styles.qrClose} onClick={() => setGoodsQrOpen(false)} aria-label="닫기">
                <X className={styles.qrCloseIcon} strokeWidth={2.4} />
              </button>
              <QRCodeSVG className={styles.qrModalImg} value={GOODS_URL} level="M" />
              <span className={styles.qrModalLabel}>{c.goods}</span>
            </div>
          </div>
        )}

        {errorMessage && <p className={styles.error}>{errorMessage}</p>}
      </>
    );
  }

  // Fallback (idle / unknown phase) — should not normally render.
  return (
    <>
      {isHwaseong ? (
        <>
          <div className={styles.bgBase} />
          {icon('bg') && <img className={styles.bgHw} src={icon('bg')} alt="" draggable={false} />}
        </>
      ) : (
        icon('bg') && <img className={styles.bg} src={icon('bg')} alt="" draggable={false} />
      )}
      <div className={styles.waitScreen} />
    </>
  );
}
