import { useEffect, useRef, useState } from 'react';
import { Camera, Sparkles } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Grid, FreeMode } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/grid';
import 'swiper/css/free-mode';
import { cameraIconUrl } from '@renderer/assets/icons/insadong/camera';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { usePhotoStore } from '@renderer/store/photoStore';
import { pick, useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { usePhotoChrome } from './photoChrome';
import { OUTFITS_BY_CATEGORY } from '@renderer/assets/photos/insadong/hanbok/clothes';
import hanbokInfo from '@renderer/assets/photos/insadong/hanbok/hanbok-info.png';
import { HANBOK_INFO, PRIVACY } from './photoTexts';
import styles from './HanbokSelect.module.css';

const LABELS = {
  instaEffect: { ko: '인스타 효과', en: 'Insta Effects', ja: 'インスタ効果', zh: '滤镜拍照' },
  hanbokInfo: { ko: '한복 설명', en: 'About Hanbok', ja: '韓服の説明', zh: '韩服说明' },
  privacy: { ko: '[개인정보 처리방침]', en: '[Privacy Policy]', ja: '[プライバシーポリシー]', zh: '[隐私政策]' },
  mapNav: { ko: '인사동 지도', en: 'Insadong Map', ja: '仁寺洞マップ', zh: '仁寺洞地图' },
  restroomNav: { ko: '화장실', en: 'Restroom', ja: 'トイレ', zh: '洗手间' },
};

/** 한복/의상 categories (Figma AR 한복체험). The Korean string is the canonical
 *  id (used for the clothes catalogue lookup); CATEGORY_LABELS localizes it. */
const CATEGORIES = [
  '여자 한복', '여자 모델의상', '남자 한복', '남자 모델의상',
  '글로벌 의상', '프로모션', '브랜드', 'K-CULTURE',
];

/** Localized tab labels keyed by the canonical category id. (No sheet keys
 *  exist for these yet — once added, swap to t().) */
const CATEGORY_LABELS: Record<string, { ko: string; en: string; ja: string; zh: string }> = {
  '여자 한복': { ko: '여자 한복', en: "Women's Hanbok", ja: '女性韓服', zh: '女款韩服' },
  '여자 모델의상': { ko: '여자 모델의상', en: "Women's Outfit", ja: '女性モデル衣装', zh: '女款模特服' },
  '남자 한복': { ko: '남자 한복', en: "Men's Hanbok", ja: '男性韓服', zh: '男款韩服' },
  '남자 모델의상': { ko: '남자 모델의상', en: "Men's Outfit", ja: '男性モデル衣装', zh: '男款模特服' },
  '글로벌 의상': { ko: '글로벌 의상', en: 'Global Outfit', ja: 'グローバル衣装', zh: '全球服饰' },
  '프로모션': { ko: '프로모션', en: 'Promotion', ja: 'プロモーション', zh: '促销' },
  '브랜드': { ko: '브랜드', en: 'Brand', ja: 'ブランド', zh: '品牌' },
  'K-CULTURE': { ko: 'K-CULTURE', en: 'K-CULTURE', ja: 'K-CULTURE', zh: 'K-CULTURE' },
};
/** Click-and-drag (grab) horizontal scrolling for the 한복 설명 carousel. */
function useDragScroll(): {
  ref: React.RefObject<HTMLDivElement | null>;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onClickCapture: (e: React.MouseEvent) => void;
} {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, startX: 0, left: 0, moved: false });

  const onPointerDown = (e: React.PointerEvent): void => {
    const el = ref.current;
    if (!el) return;
    drag.current = { down: true, startX: e.clientX, left: el.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent): void => {
    const el = ref.current;
    if (!el || !drag.current.down) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 6) drag.current.moved = true;
    el.scrollLeft = drag.current.left - dx;
  };
  const end = (): void => {
    drag.current.down = false;
  };
  // Swallow the click that fires after a drag so it doesn't select an outfit.
  const onClickCapture = (e: React.MouseEvent): void => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };
  return { ref, onPointerDown, onPointerMove, onPointerUp: end, onPointerLeave: end, onClickCapture };
}

export type CaptureMode = 'solo' | 'withInsa';

interface HanbokSelectProps {
  /** Fired when a 사진촬영 button is pressed → starts the camera flow. */
  onCapture: (mode: CaptureMode, category: string) => void;
  /** Fired by the 인스타 효과 button → starts the gesture-driven effects flow. */
  onEffects: () => void;
  onHome: () => void;
  /** When true (countdown/preview phase), show the "look at the camera" popup. */
  countdownActive?: boolean;
}

/** AR 한복체험 — outfit selection (Step 1) + capture-mode buttons (Step 2). */
export function HanbokSelect({ onCapture, onEffects, onHome, countdownActive = false }: HanbokSelectProps): JSX.Element {
  const rotating = useRotatingBanner();
  const lang = useLang();
  const { isOsan, icon, Header, photoTitle } = usePhotoChrome();
  // Osan has its own single promo banner; insadong rotates through several.
  const banner = isOsan ? icon('banner') : rotating;
  // Camera-direction popup (shown while the photo is captured/sent to AI) —
  // Osan uses its own uploaded image; insadong keeps the camera-folder asset.
  const camPopupSrc = (isOsan && icon('camera-popup')) || cameraIconUrl('camera-popup');
  // If the session was opened with a pre-selected tab (e.g. 프로모션 from the
  // K-DRAMA 이벤트 참여 button), start there; then clear it so it doesn't stick.
  const initialCategory = usePhotoStore((s) => s.initialCategory);
  const setInitialCategory = usePhotoStore((s) => s.setInitialCategory);
  const [category, setCategory] = useState<string>(() =>
    initialCategory && CATEGORIES.includes(initialCategory) ? initialCategory : '여자 한복',
  );
  useEffect(() => {
    if (initialCategory) setInitialCategory(null);
  }, [initialCategory, setInitialCategory]);
  const [outfitCode, setOutfitCode] = useState<string>('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const infoDrag = useDragScroll();

  // 한복 설명 plays its own display video; the AR selection page stays on 'photo'.
  useEffect(() => {
    void window.api.kiosk.setScreen(infoOpen ? 'hanbok_explain' : 'photo');
  }, [infoOpen]);

  // Outfit cards whose image fails to load are dropped (no empty boxes).
  const [brokenCodes, setBrokenCodes] = useState<Set<string>>(new Set());
  const markBroken = (code: string): void => setBrokenCodes((s) => new Set(s).add(code));
  const isOk = (o: { code: string; url: string }): boolean => Boolean(o.url) && !brokenCodes.has(o.code);

  // Real outfits for the selected category (from the clothes/ catalogue).
  const catIdx = Math.max(0, CATEGORIES.indexOf(category));
  const outfits = (OUTFITS_BY_CATEGORY[catIdx] ?? []).filter(isOk);
  const selectedOutfit = outfits.find((o) => o.code === outfitCode) ?? outfits[0];
  // AR fields: gender + specific outfit code, passed through as the clothing key.
  const outfitKey = selectedOutfit ? `${selectedOutfit.gender ?? ''}|${selectedOutfit.code}` : category;

  // 한복 설명 always shows ALL hanbok (여자 한복 + 남자 한복), never the last-picked tab.
  const allHanbok = [0, 2].flatMap((i) => OUTFITS_BY_CATEGORY[i] ?? []).filter(isOk);

  // ── 한복 설명 page ──
  if (infoOpen) {
    const info = pick(HANBOK_INFO, lang);
    return (
      <>
        {icon('bg') && <img className={styles.bg} src={icon('bg')} alt="" draggable={false} />}
        <Header title={pick(LABELS.hanbokInfo, lang)} onHome={onHome} onBack={() => setInfoOpen(false)} />
        <div className={styles.infoContent}>
          <div
            ref={infoDrag.ref}
            className={styles.infoCarousel}
            onPointerDown={infoDrag.onPointerDown}
            onPointerMove={infoDrag.onPointerMove}
            onPointerUp={infoDrag.onPointerUp}
            onPointerLeave={infoDrag.onPointerLeave}
            onClickCapture={infoDrag.onClickCapture}
          >
            {allHanbok.map((o, i) => (
              <div key={o.code} className={`${styles.infoThumb} ${i === 0 ? styles.infoThumbSel : ''}`}>
                <img src={o.url} alt="" draggable={false} decoding="async" onError={() => markBroken(o.code)} />
              </div>
            ))}
          </div>
          <div className={styles.infoCard}>
            <p className={styles.infoHeading}>{info.heading}</p>
            <div className={styles.infoBody}>
              {info.paragraphs.map((p, i) => (
                <p key={i} className={styles.infoPara}>
                  {p}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom nav bar (Figma 한복체험_한복설명 하단네비) — same curved bar as the home page. */}
        <div className={styles.infoNav}>
          {icon('bottom-bar-classic') && <img className={styles.infoNavBg} src={icon('bottom-bar-classic')} alt="" draggable={false} />}
          <button type="button" className={styles.infoNavLeft} onClick={() => setInfoOpen(false)}>
            <span
              className={`${styles.infoNavIcon} ${isOsan ? styles.infoNavIconOsan : ''}`}
              style={isOsan && icon('nav-circle') ? { backgroundImage: `url("${icon('nav-circle')}")` } : undefined}
            >
              {icon('map') && <img src={icon('map')} alt="" draggable={false} />}
            </span>
            <span className={styles.infoNavLabel}>{pick(LABELS.mapNav, lang)}</span>
          </button>
          <button
            type="button"
            className={`${styles.infoNavCam} ${isOsan ? styles.infoNavCamOsan : ''}`}
            onClick={() => {
              setInfoOpen(false);
              onCapture('solo', outfitKey);
            }}
            aria-label="사진촬영"
          >
            {isOsan ? (
              <Camera className={styles.infoNavCamGlyph} strokeWidth={2.2} />
            ) : (
              icon('camera') && <img src={icon('camera')} alt="" draggable={false} />
            )}
          </button>
          <button type="button" className={styles.infoNavRight} onClick={() => setInfoOpen(false)}>
            <span className={styles.infoNavIcon}>{icon('restroom') && <img src={icon('restroom')} alt="" draggable={false} />}</span>
            <span className={styles.infoNavLabel}>{pick(LABELS.restroomNav, lang)}</span>
          </button>
        </div>

        <div className={styles.leftNav}>
          <button type="button" className={styles.leftNavBtn} onClick={onHome} aria-label="홈으로">
            {icon('home-btn') && <img src={icon('home-btn')} alt="" draggable={false} />}
          </button>
          <button type="button" className={styles.leftNavBtn} onClick={() => setInfoOpen(false)} aria-label="뒤로">
            {icon('back-arrow') && <img src={icon('back-arrow')} alt="" draggable={false} />}
          </button>
        </div>
        {banner && (
          <div className={styles.banner}>
            <img src={banner} alt="" draggable={false} />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {icon('bg') && <img className={styles.bg} src={icon('bg')} alt="" draggable={false} />}

      <Header title={photoTitle} onHome={onHome} />

      <div className={styles.content}>
        {/* Step 1 */}
        <div className={styles.stepHead}>
          <div className={styles.stepRow}>
            <span className={styles.stepNum}>1</span>
            <span className={styles.stepTitle}>{t('Photo_HanbokSelect', lang)}</span>
          </div>
          <div className={styles.stepSub}>
            <span className={styles.star}>★</span>
            {t('Photo_HanbokSelectContent', lang)}
          </div>
        </div>

        {/* Category tabs (2×4) */}
        <div className={styles.tabs}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.tab} ${category === c ? styles.tabSel : ''}`}
              onClick={() => {
                setCategory(c);
                setOutfitCode('');
              }}
            >
              {pick(CATEGORY_LABELS[c] ?? { ko: c }, lang)}
            </button>
          ))}
        </div>

        {/* Outfit grid — Swiper Grid: 2 rows, swipe horizontally through pages.
            ~3.5 cards per view shows a peek of the next (Figma swipe cue). */}
        <Swiper
          className={styles.grid}
          modules={[Grid, FreeMode]}
          grid={{ rows: 2, fill: 'row' }}
          slidesPerView={3.54}
          spaceBetween={36}
          freeMode
          // The whole card area is draggable; selecting an outfit is a tap.
          key={category}
        >
          {outfits.map((o) => (
            <SwiperSlide key={o.code} className={styles.outfitSlide}>
              <button
                type="button"
                className={`${styles.outfit} ${selectedOutfit?.code === o.code ? styles.outfitSel : ''}`}
                onClick={() => setOutfitCode(o.code)}
              >
                <img src={o.url} alt="" draggable={false} decoding="async" onError={() => markBroken(o.code)} />
              </button>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Capture buttons */}
        <div className={`${styles.captureRow} ${isOsan ? styles.captureRowThree : ''}`}>
          <button type="button" className={styles.captureBtn} onClick={() => onCapture('solo', outfitKey)}>
            <Camera className={styles.captureIcon} strokeWidth={2} />
            {t('Photo_SelectAlone', lang)}
          </button>
          <button type="button" className={styles.captureBtn} onClick={() => onCapture('withInsa', outfitKey)}>
            <Camera className={styles.captureIcon} strokeWidth={2} />
            {t('Photo_SelectTogether', lang)}
          </button>
          {/* 인스타 효과 — Osan (W004) only for now; keep it off the live Insadong kiosks. */}
          {isOsan && (
            <button type="button" className={`${styles.captureBtn} ${styles.effectBtn}`} onClick={onEffects}>
              <Sparkles className={styles.captureIcon} strokeWidth={2} />
              {pick(LABELS.instaEffect, lang)}
            </button>
          )}
        </div>

        {/* Step 2 card */}
        <div className={styles.step2}>
          <div className={styles.step2Main}>
            <div className={styles.stepRow}>
              <span className={styles.stepNum}>2</span>
              <span className={styles.stepTitle}>{t('Photo_TakePhoto', lang)}</span>
            </div>
            <div className={styles.step2Sub}>
              <span className={styles.star}>★</span>
              <div className={styles.step2Lines}>
                {t('Photo_TakePhotoContent', lang)
                  .split('\n')
                  .map((line, i) => (
                    <span key={i}>{line.trim()}</span>
                  ))}
              </div>
            </div>
            <button type="button" className={styles.privacy} onClick={() => setPrivacyOpen(true)}>
              {pick(LABELS.privacy, lang)}
            </button>
          </div>
          <button type="button" className={styles.hanbokInfo} onClick={() => setInfoOpen(true)}>
            <div className={styles.hanbokInfoCircle}>
              <img src={hanbokInfo} alt="" draggable={false} />
            </div>
            <span className={styles.hanbokInfoLabel}>{pick(LABELS.hanbokInfo, lang)}</span>
          </button>
        </div>
      </div>

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={onHome} aria-label="홈으로">
          {icon('home-btn') && <img src={icon('home-btn')} alt="" draggable={false} />}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={onHome} aria-label="뒤로">
          {icon('back-arrow') && <img src={icon('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>

      {banner && (
        <div className={styles.banner}>
          <img src={banner} alt="" draggable={false} />
        </div>
      )}

      {/* Camera direction popup — shown during countdown/preview phase */}
      {countdownActive && camPopupSrc && (
        <>
          <div className={styles.camBackdrop} />
          <div className={styles.camPopup}>
            <img
              src={camPopupSrc}
              className={styles.camPopupImg}
              alt=""
              draggable={false}
            />
          </div>
        </>
      )}

      {/* 개인정보 처리방침 popup */}
      {privacyOpen && (
        <div className={styles.privacyOverlay} onClick={() => setPrivacyOpen(false)}>
          <div className={styles.privacyModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.privacyHead}>
              <span className={styles.privacyTitle}>{pick(PRIVACY, lang).title}</span>
              <button type="button" className={styles.privacyClose} onClick={() => setPrivacyOpen(false)} aria-label="닫기">
                <svg className={styles.privacyCloseIcon} viewBox="0 0 129 129" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <circle cx="64.3496" cy="64.3496" r="62.2046" stroke="#333333" strokeWidth="4.28997" />
                  <line x1="37.3533" y1="34.3203" x2="94.9892" y2="91.9562" stroke="black" strokeWidth="4.28997" strokeLinecap="round" />
                  <line x1="94.3794" y1="37.3538" x2="36.7435" y2="94.9897" stroke="black" strokeWidth="4.28997" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className={styles.privacyBody}>
              {pick(PRIVACY, lang).sections.map((s, i) => (
                <div key={i} className={styles.privacySection}>
                  <p className={styles.privacySecTitle}>{s.title}</p>
                  {s.lines.map((line, j) => (
                    <p key={j} className={styles.privacySecLine}>
                      {line}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
