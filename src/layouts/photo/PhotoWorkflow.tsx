import { useState } from 'react';
import { X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { WEB_EMBED_URLS } from '@shared/constants/webEmbeds';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { usePhotoWorkflow } from '@renderer/hooks/usePhotoWorkflow';
import { usePhotoStore } from '@renderer/store/photoStore';
import { useKioskStore } from '@renderer/store/kioskStore';
import { generatedUrl } from '@renderer/lib/media';
import { pick, useLang } from '@renderer/lib/i18n';
import { trackEvent } from '@renderer/lib/analytics';
import { resolveButton } from '@renderer/lib/buttonCatalog';
import { WEARABLES } from '@renderer/features/display/wearables';
import { GameControlPanel } from '@renderer/features/game/GameControlPanel';
import { HanbokSelect, type CaptureMode } from './HanbokSelect';
import { usePhotoChrome } from './photoChrome';
import { RESULT } from './photoTexts';
import styles from './PhotoWorkflow.module.css';

/** Where the 굿즈제작 button's QR points. */
const GOODS_URL = 'https://insarang.kr/';
/** Phone save page — the result image URL is appended. Matches the (working)
 *  Unity kiosk, which uses the Vercel host (netlify is the fallback mirror). */
const SAVE_BASE = 'https://withphoto.vercel.app/?imageUrl=';

/** 인스타 효과 guide copy (Monitor 1 — the user shoots by gesture on Monitor 2). */
const EFFECTS_GUIDE = {
  header: { ko: '인스타 효과', en: 'Insta Effects', ja: 'インスタ効果', zh: '滤镜拍照' },
  lead: {
    ko: '오른쪽 화면을 보며 손동작으로 촬영하세요',
    en: 'Watch the right screen and shoot with gestures',
    ja: '右の画面を見ながら手で撮影してください',
    zh: '看着右侧屏幕，用手势拍照',
  },
  swipe: {
    ko: '좌우로 효과 변경',
    en: 'Swipe to change effect',
    ja: '左右で効果を変更',
    zh: '左右切换滤镜',
  },
  capture: {
    ko: '브이로 촬영',
    en: 'Peace sign to shoot',
    ja: 'ピースで撮影',
    zh: '比剪刀手拍照',
  },
  wear: { ko: '착용할 아이템을 골라보세요', en: 'Pick an item to wear', ja: '着用アイテムを選んでください', zh: '挑选佩戴道具' },
  none: { ko: '없음', en: 'None', ja: 'なし', zh: '无' },
  home: { ko: '홈으로', en: 'Home', ja: 'ホーム', zh: '主页' },
} as const;

/**
 * AI 한복 photo workflow — Monitor 1 (touch kiosk).
 *
 * Phase map:
 *   clothing / style  → HanbokSelect (outfit selection, no popup)
 *   preview / countdown / generating → camera-popup.png only (nothing else)
 *   result            → WIT Store webview (Monitor 2 shows result image)
 */
export function PhotoWorkflow(): JSX.Element {
  const phase = usePhotoStore((s) => s.phase);
  const errorMessage = usePhotoStore((s) => s.errorMessage);
  const resultFileName = usePhotoStore((s) => s.resultFileName);
  const resultUrl = usePhotoStore((s) => s.resultUrl);
  const effectsMode = usePhotoStore((s) => s.effectsMode);
  const game = usePhotoStore((s) => s.game);
  const reset = usePhotoStore((s) => s.reset);
  const kioskId = useKioskStore((s) => s.config.kioskId);
  const screen = useKioskStore((s) => s.screen);
  const lang = useLang();
  const hasPayment = getKioskLocation(kioskId).hasCardTerminal;
  const rotating = useRotatingBanner();
  const { isOsan, icon, Header, photoTitle } = usePhotoChrome();
  // Osan has its own single promo banner; insadong rotates through several.
  const banner = isOsan ? icon('banner') : rotating;
  const [goodsQrOpen, setGoodsQrOpen] = useState(false);
  const [saveQrOpen, setSaveQrOpen] = useState(false);
  // Selected AR wearable on the 인스타 효과 screen ('' = none).
  const [wearableId, setWearableId] = useState('');

  usePhotoWorkflow();

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
    await window.api.photo.beginCountdown();
  };

  const handleEffects = (): void => {
    void trackEvent({
      name: 'button_clicked',
      payload: { screen: 'photo_capture_start', mode: 'effects', kioskId },
    });
    setWearableId('');
    void window.api.photo.startEffects();
  };

  const pickWearable = (id: string): void => {
    setWearableId(id);
    void window.api.kiosk.setEffectsWearable(id);
  };

  // ── Generating — control panel for the wait-time mini game ────────────────
  // The game itself runs on Monitor 2 (played with the body, no touch); this
  // screen is the only thing the visitor touches: PLAY, then after they crash,
  // their photo or another round. Main holds the finished photo back while a run
  // is live, so nothing is yanked away mid-jump. A failed generation leaves the
  // phase at `generating` with an errorMessage, so keep the old screen for that
  // case instead of offering a game over a photo that is never coming.
  if (phase === 'generating' && !errorMessage && game.phase !== 'idle') {
    return <GameControlPanel game={game} />;
  }

  // ── Outfit selection + capture (countdown → capture → generating) ──────────
  // Keep the AR 한복체험 screen on Monitor 1 throughout; during capture overlay
  // the camera-direction popup ("look at the camera between the screens").
  if (phase === 'clothing' || phase === 'style' || phase === 'preview' || phase === 'countdown' || phase === 'generating') {
    const capturing = phase === 'preview' || phase === 'countdown' || phase === 'generating';
    return (
      <HanbokSelect
        onHome={handleReset}
        onCapture={handleCapture}
        onEffects={handleEffects}
        countdownActive={capturing}
      />
    );
  }

  // ── 인스타 효과 — Monitor 1 just guides; the user interacts by hand on Monitor 2 ──
  if (phase === 'effects') {
    return (
      <>
        {icon('bg') && <img className={styles.bg} src={icon('bg')} alt="" draggable={false} />}
        <Header title={pick(EFFECTS_GUIDE.header, lang)} onHome={handleReset} />
        <div className={styles.effectsGuide}>
          <p className={styles.effectsLead}>{pick(EFFECTS_GUIDE.lead, lang)}</p>
          <div className={styles.effectsChips}>
            <div className={styles.effectsChip}>
              <span className={styles.effectsChipEmoji}>✋</span>
              {pick(EFFECTS_GUIDE.swipe, lang)}
            </div>
            <div className={`${styles.effectsChip} ${styles.effectsChipAccent}`}>
              <span className={styles.effectsChipEmoji}>✌️</span>
              {pick(EFFECTS_GUIDE.capture, lang)}
            </div>
          </div>

          <p className={styles.effectsWearTitle}>{pick(EFFECTS_GUIDE.wear, lang)}</p>
          <div className={styles.effectsWearGrid}>
            <button
              type="button"
              className={`${styles.effectsWearItem} ${wearableId === '' ? styles.effectsWearItemSel : ''}`}
              onClick={() => pickWearable('')}
            >
              <span className={styles.effectsWearNone}>✕</span>
              <span className={styles.effectsWearLabel}>{pick(EFFECTS_GUIDE.none, lang)}</span>
            </button>
            {WEARABLES.map((w) => (
              <button
                key={w.id}
                type="button"
                className={`${styles.effectsWearItem} ${wearableId === w.id ? styles.effectsWearItemSel : ''}`}
                onClick={() => pickWearable(w.id)}
              >
                <img className={styles.effectsWearImg} src={w.src} alt="" draggable={false} />
                <span className={styles.effectsWearLabel}>{pick(w.name, lang)}</span>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  // ── Result (PAYMENT kiosks W003/W004): WIT Store on Monitor 1; result image big on Monitor 2 ──
  // 인스타 효과 captures skip the store and use the simple photo + save-QR result.
  if (phase === 'result' && hasPayment && !effectsMode) {
    const imageUrl = resultUrl ?? (resultFileName ? generatedUrl(resultFileName) : '');
    const saveUrl = `${SAVE_BASE}${encodeURIComponent(imageUrl)}`;
    return (
      <>
        {icon('bg') && <img className={styles.bg} src={icon('bg')} alt="" draggable={false} />}

        <Header title="위드마켓" onHome={handleReset} />

        <div className={styles.marketBody}>
          {WEB_EMBED_URLS.market ? (
            // eslint-disable-next-line react/no-unknown-property
            <webview src={WEB_EMBED_URLS.market} partition="persist:embeds" className={styles.marketEmbed} />
          ) : (
            <div className={styles.marketPlaceholder}>위드마켓 준비 중</div>
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

  // ── Result (NO-PAYMENT kiosks W001/W002): show the result image + QR to save ──
  if (phase === 'result') {
    const c = pick(RESULT, lang);
    // Prefer the public AI result URL (phone-openable); fall back to the local
    // reference only when the AI didn't return one.
    const imageUrl = resultUrl ?? (resultFileName ? generatedUrl(resultFileName) : '');
    const saveUrl = `${SAVE_BASE}${encodeURIComponent(imageUrl)}`;

    return (
      <>
        {icon('bg') && <img className={styles.bg} src={icon('bg')} alt="" draggable={false} />}

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

          <p className={styles.resultHint}>{c.saveHint}</p>
          <div className={styles.resultNote}>
            {c.note.map((line, i) => (
              <span key={i}>
                {i === 0 ? '★ ' : ''}
                {line}
              </span>
            ))}
          </div>

          <div className={styles.resultBottom}>
            <div className={styles.resultQr}>
              <QRCodeSVG value={saveUrl} level="M" style={{ width: '100%', height: '100%' }} />
            </div>
            <div className={styles.resultButtons}>
              <button type="button" className={styles.resultBtn} onClick={() => setGoodsQrOpen(false)}>
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
      {icon('bg') && <img className={styles.bg} src={icon('bg')} alt="" draggable={false} />}
      <div className={styles.waitScreen} />
    </>
  );
}
