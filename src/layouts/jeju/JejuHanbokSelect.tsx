/**
 * 제주공항 (W006) AR 한복체험 — outfit selection.
 *
 * Figma 6258:48134 · 48264 (개인정보 처리방침) · 48326 · 48469 · 48575 · 48693 ·
 * 49124. A 제주-specific replacement for the shared `HanbokSelect` step: same
 * place in the workflow, same `onCapture` contract, different layout — and,
 * unlike the shared step, no locally-authored category list at all.
 *
 * ── Outfits AND their tabs come from the API ──────────────────────────
 * `GET /api/outfits`, cached in SQLite by OutfitService and grouped by
 * registered `categoryName` in `useOutfitStore`. They used to be a build-time
 * PNG glob, which meant a rebuild and a fleet redeploy to add one; the bundle
 * survives only as the offline fallback.
 *
 * ★ The tab row is `GET /api/outfits/categories` and NOTHING ELSE — one tab per
 * registered category, in the order the API returns, labelled in the visitor's
 * language by the operator. No tab is authored here, not even a pinned one: a
 * locally-added tab would outlive the category behind it and a locally-written
 * label would silently contradict the admin web. The eight hardcoded 제주 names
 * (제주 / 한복 / 직업의상 / 일상의상 / 브랜드 / 프로모션 / 기념일 / K-CULTURE) and
 * their merges are gone. Consequences worth knowing:
 *   · `brand` now reads 이벤트 and `w=model` reads 모델 — that is what the
 *     operator actually set, not a translation slip.
 *   · `New Outfit` (12 outfits, the second-largest category) had NO tab and was
 *     unreachable. It is registered and labelled 직업복, so it now has one.
 *   · 제주 and 기념일 have nothing registered behind them, so they are simply not
 *     tabs. Registering a 제주 category is what brings that tab back — and if it
 *     is registered first it also inherits step ② (see `isLandingTab`).
 *   · An empty tab row means the catalogue has never synced AND the bundled
 *     fallback is empty. There is nothing local left to draw in that case.
 *
 * The sub-category chip row went with them: every tab is exactly one category,
 * so there is nothing left to choose between. The frames that ship a chip row
 * draw it `hidden` anyway (6258:48575).
 *
 * ── 배경 테마 comes from the API ──────────────────────────────────────
 * The plates are the ACTIVE backgrounds assigned to THIS kiosk
 * (`GET /api/kiosks/{kioskNum}/backgrounds`, cached in SQLite by
 * BackgroundService and served through `useBackgroundStore`). A kiosk with none
 * assigned gets an empty list — a legitimate answer, not a failure — so step ②
 * is dropped entirely there and the landing tab falls back to the 사진촬영안내
 * card that every other tab shows. The pick is still local state: see the note
 * above `.themes` in the CSS for what is missing on the AR side.
 *
 * Step ② rides the LANDING tab (the first the API returns), which is where it
 * sat when that tab was hardcoded 제주. Since the 2026-08-24 redraw the
 * 사진촬영안내 card is on EVERY condition — the landing tab drops it into the
 * banner band (and draws no banner), every other tab hangs it above the banner
 * — so the 한복 설명 page is reachable from anywhere.
 */
import { useEffect, useMemo, useState } from 'react';
import { Camera } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Grid, FreeMode } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/grid';
import 'swiper/css/free-mode';
import { usePhotoChrome } from '../photo/photoChrome';
import { HANBOK_INFO, PRIVACY } from '../photo/photoTexts';
import hanbokInfo from '@renderer/assets/photos/insadong/hanbok/hanbok-info.png';
import { t } from '@renderer/lib/loc';
import type { CaptureMode } from '../photo/HanbokSelect';
import { useOutfitStore } from '@renderer/store/outfitStore';
import type { PickerOutfit } from '@renderer/store/outfitStore';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { usePhotoStore } from '@renderer/store/photoStore';
import { useBackgroundStore } from '@renderer/store/backgroundStore';
import { backgroundName } from '@renderer/lib/backgrounds';
import { outfitCategoryLabel } from '@renderer/lib/outfitCategories';
import { cameraIconUrl } from '@renderer/assets/icons/insadong/camera';
import { pick, useLang } from '@renderer/lib/i18n';
import { jejuMascot, type JejuMascot } from './jejuMascot';
/* The privacy modal and the camera-direction popup are identical on every
   layout, so their styles are reused from the shared step rather than copied. */
import shared from '../photo/HanbokSelect.module.css';
import styles from './JejuHanbokSelect.module.css';

interface Props {
  onCapture: (mode: CaptureMode, category: string) => void;
  onHome: () => void;
  countdownActive?: boolean;
}

/** One tab in the row. Every one of them is a registered category. */
interface Tab {
  /**
   * The registered `categoryName` — the filter code, e.g. "w=hannbok". Also the
   * selection key. NOT a display label; matching an outfit against it is exact
   * (case-insensitive).
   */
  id: string;
  /** Already resolved to the terminal's language. */
  label: string;
  /** Korean label, for matching an `initialCategory` handed over by another page. */
  ko: string;
}

/**
 * The 한복 설명 page's own illustration strip — NOT a tab.
 *
 * That page is specifically about 한복 (its copy is `HANBOK_INFO`), so its
 * carousel shows 한복 whatever tab it was opened from. These are the two
 * registered category names the garments live under; if neither is registered
 * the carousel is simply empty and the page still reads.
 */
const HANBOK_INFO_CATS = ['w=hannbok', 'm=hanbok'];

/**
 * Tab-row geometry. Figma 6258:48134 draws 8 tabs as 2 rows of 4 — 420-wide
 * buttons in the 1820 column, so the gaps are (1820 − 4×420) / 3.
 *
 * The count is no longer ours to fix: the API decides how many tabs there are,
 * and the operator can register another one tomorrow. The ROWS stay at 2,
 * because everything below (the strip at 1385, step ② at 1978, the capture
 * buttons) is absolutely positioned and a third row would land on top of it —
 * so the columns are what grows, and the button width is derived from them in
 * CSS (`--cat-cols`). At 4 columns that arithmetic gives back the exact 420.
 */
const TAB_ROWS = 2;
/** The design's own column count — also the floor, see `tabColumns`. */
const TAB_MIN_COLUMNS = 4;
/** Past this the labels are cramped enough to want the smaller type. */
const TAB_TIGHT_FROM = 5;

/**
 * Outfit-strip geometry, straight off the 2026-08-24 frames — 350-wide cards
 * justify-between across the 1820 column, i.e. a 17.5 gap. Swiper sizes slides
 * from `slidesPerView`, and (1820 + 17.5) / (350 + 17.5) is exactly 5: the
 * design shows five whole cards with no peek.
 */
const CARD_GAP = 17.5;
const CARDS_PER_VIEW = (1820 + CARD_GAP) / (350 + CARD_GAP); // = 5

const SUBTITLE = {
  ko: '원하시는 의상을 고르고 하단의 버튼을 눌러주세요',
  en: 'Pick an outfit, then press a button below',
  ja: 'お好みの衣装を選び、下のボタンを押してください',
  zh: '选择您喜欢的服装后，请按下方按钮',
  vi: 'Chọn trang phục rồi nhấn nút bên dưới',
  th: 'เลือกชุดที่ต้องการแล้วกดปุ่มด้านล่าง',
  ru: 'Выберите наряд и нажмите кнопку ниже',
  id: 'Pilih busana lalu tekan tombol di bawah',
};

const STEP_OUTFIT = {
  ko: '의상 선택하기',
  en: 'Choose an outfit',
  ja: '衣装を選ぶ',
  zh: '选择服装',
  vi: 'Chọn trang phục',
  th: 'เลือกชุด',
  ru: 'Выбор наряда',
  id: 'Pilih busana',
};

const STEP_THEME = {
  ko: '배경 테마 선택하기',
  en: 'Choose a background',
  ja: '背景テーマを選ぶ',
  zh: '选择背景主题',
  vi: 'Chọn nền',
  th: 'เลือกธีมพื้นหลัง',
  ru: 'Выбор фона',
  id: 'Pilih tema latar',
};

const SOLO = {
  ko: '사진촬영 (혼자 찍기)',
  en: 'Take a photo (alone)',
  ja: '写真撮影（ひとりで）',
  zh: '拍照（单人）',
  vi: 'Chụp ảnh (một mình)',
  th: 'ถ่ายรูป (คนเดียว)',
  ru: 'Фото (одному)',
  id: 'Foto (sendiri)',
};

/**
 * Built per mascot: 하영 on W006/W007, 유산 on W008. Only the LAST-RESORT
 * fallback — the sheet's Photo_SelectTogether row is already venue-split
 * (see LocalizationSyncParser.VENUE_MASCOTS) and wins whenever it has a cell.
 */
const togetherLabel = (m: JejuMascot) => ({
  ko: `사진촬영(with '${m.ko}')`,
  en: `Take a photo (with '${m.mixed}')`,
  ja: `写真撮影（${m.ko}と）`,
  zh: `拍照（与'${m.ko}'）`,
  vi: `Chụp ảnh (với '${m.mixed}')`,
  th: `ถ่ายรูป (กับ '${m.mixed}')`,
  ru: `Фото (с «${m.ru}»)`,
  id: `Foto (dengan '${m.mixed}')`,
});

const NO_OUTFITS = {
  ko: '준비 중인 의상입니다.',
  en: 'These outfits are on the way.',
  ja: '準備中の衣装です。',
  zh: '服装正在准备中。',
  vi: 'Trang phục đang được chuẩn bị.',
  th: 'ชุดกำลังจัดเตรียม',
  ru: 'Наряды готовятся.',
  id: 'Busana sedang disiapkan.',
};

const PRIVACY_LINK = {
  ko: '[개인정보처리방침]',
  en: '[Privacy Policy]',
  ja: '[個人情報処理方針]',
  zh: '[隐私政策]',
  vi: '[Chính sách bảo mật]',
  th: '[นโยบายความเป็นส่วนตัว]',
  ru: '[Политика конфиденциальности]',
  id: '[Kebijakan Privasi]',
};

export function JejuHanbokSelect({
  onCapture,
  onHome,
  countdownActive = false,
}: Props): JSX.Element {
  const lang = useLang();
  const rotating = useRotatingBanner();
  const { icon, Header, photoTitle, banner: chromeBanner } = usePhotoChrome();
  const banner = chromeBanner ?? rotating;
  const camPopupSrc = icon('camera-popup') || cameraIconUrl('camera-popup');

  // The 배경 테마 plates for THIS kiosk, already ACTIVE-filtered and in
  // `sortOrder`. Loaded once at app start (App.tsx) and refreshed on the
  // nightly sync, so this read is instant and offline-safe.
  const backgrounds = useBackgroundStore((s) => s.backgrounds);

  // The outfit catalogue, grouped by registered category name. Same deal as the
  // backgrounds: SQLite-cached API content, loaded at app start and refreshed on
  // the nightly sync, so switching tabs never touches the network. Falls back to
  // the bundled PNGs on a kiosk that has never synced — see outfitStore.
  const byCategory = useOutfitStore((s) => s.byCategory);
  const categories = useOutfitStore((s) => s.categories);
  const loadOutfits = useOutfitStore((s) => s.load);
  const reloadOutfits = useOutfitStore((s) => s.reload);
  useEffect(() => {
    void loadOutfits();
    return window.api.events.onOutfitsChanged(() => void reloadOutfits());
  }, [loadOutfits, reloadOutfits]);

  /**
   * The tab row: exactly the registered categories, in the API's own order.
   * Labels are resolved here, so a language switch relabels the row without
   * touching the selection — `id` is the filter code, never a label.
   */
  const tabs: Tab[] = useMemo(
    () =>
      categories.map((c) => ({
        id: c.categoryName,
        label: outfitCategoryLabel(c, lang),
        ko: c.labelKr,
      })),
    [categories, lang],
  );

  // A session can be opened with a pre-selected tab (e.g. 프로모션 from K-DRAMA).
  const initialCategory = usePhotoStore((s) => s.initialCategory);
  const setInitialCategory = usePhotoStore((s) => s.setInitialCategory);
  /** Empty until the tabs arrive; resolved to the landing tab below. */
  const [categoryId, setCategoryId] = useState('');
  useEffect(() => {
    // The row arrives asynchronously, so neither the default nor the hand-over
    // can be settled in a state initialiser — wait for it, then decide once.
    if (tabs.length === 0) return;
    const landing = tabs[0] as Tab;
    if (initialCategory) {
      // The caller names the tab in Korean (`프로모션`), which is a label rather
      // than a code, so both are accepted.
      const match = tabs.find((t) => t.id === initialCategory || t.ko === initialCategory);
      setCategoryId((match ?? landing).id);
      setInitialCategory(null);
      return;
    }
    // Also re-runs when the operator un-registers the selected category mid-
    // session: the row changes under us and the selection falls back to landing.
    if (!tabs.some((t) => t.id === categoryId)) setCategoryId(landing.id);
  }, [initialCategory, tabs, categoryId, setInitialCategory]);

  const [outfitCode, setOutfitCode] = useState('');
  // No background is pre-selected — the frames draw every plate unhighlighted.
  const [backgroundId, setBackgroundId] = useState<number | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // Cards whose image fails to load are dropped rather than left as empty boxes.
  const [brokenCodes, setBrokenCodes] = useState<Set<string>>(new Set());
  const markBroken = (code: string): void => setBrokenCodes((s) => new Set(s).add(code));

  // Undefined only for the frame before the tabs arrive — the effect above
  // settles the selection as soon as there is a row to settle it against.
  const category = tabs.find((c) => c.id === categoryId);
  const outfits: PickerOutfit[] = (byCategory[category?.id.toLowerCase() ?? ''] ?? []).filter(
    (o) => Boolean(o.url) && !brokenCodes.has(o.code),
  );

  /**
   * 2 rows, columns derived from the count — see TAB_ROWS. The first row takes
   * the remainder, so an odd list leaves the gap at the end of the SECOND row,
   * which is where the design's own short row would be.
   *
   * Never fewer than the design's 4, so a short row (or the empty one before the
   * catalogue arrives) keeps the design's button size instead of stretching one
   * tab across the full 1820.
   */
  const tabColumns = Math.max(TAB_MIN_COLUMNS, Math.ceil(tabs.length / TAB_ROWS));
  const tabRows = Array.from({ length: TAB_ROWS }, (_, r) =>
    tabs.slice(r * tabColumns, r * tabColumns + tabColumns),
  ).filter((row) => row.length > 0);

  /**
   * NOTHING is selected until the visitor taps a card: 6258:48693 draws all four
   * cards plain and 6258:48575 draws the tapped one orange/cream, so the two
   * frames are the before and after of one choice. The shared step defaults to
   * the first card; 제주 deliberately does not, because its subtitle asks for the
   * choice ("원하시는 의상을 고르고 하단의 버튼을 눌러주세요") and a pre-selected
   * card would silently decide it.
   */
  const selectedOutfit = outfits.find((o) => o.code === outfitCode);
  /** The AR clothing key: `gender|code`, exactly as the shared step builds it. */
  const outfitKey = selectedOutfit ? `${selectedOutfit.gender ?? ''}|${selectedOutfit.code}` : '';

  /**
   * Straight to the camera. The 정보 입력 step (JejuPhotoRegister — 국적/키 plus
   * a consent tick) used to stand here; removed 2026-08-24 by request. The two
   * fields were collected-but-never-sent anyway, and dropping the step is also
   * what every other location does — their capture buttons have always fired
   * directly. The component file stays in the repo should the step return.
   */
  const startCapture = (mode: CaptureMode): void => {
    if (!selectedOutfit) return; // nothing chosen — never send a bare category
    onCapture(mode, outfitKey);
  };

  const star = jejuIconUrl('star');
  /**
   * The landing tab — the first the API returns — is the only one with a
   * background-theme step. That is where it sat when the landing tab was a
   * hardcoded 제주, and it stays there rather than spreading to every tab,
   * because step ② and the 사진촬영안내 card share a slot and that card is the
   * only way into the 한복 설명 page.
   */
  const isLandingTab = tabs.length > 0 && categoryId === tabs[0]?.id;
  /**
   * Step ② only exists when this kiosk actually has backgrounds assigned.
   * With none — an empty API list, or the very first launch before the fetch
   * lands — the landing tab draws the same 사진촬영안내 card as every other tab,
   * which is also why this (not `isLandingTab`) drives the outfit strip's row
   * count: the two halves of that slot must agree or the strip overlaps the
   * capture buttons.
   */
  const showThemes = isLandingTab && backgrounds.length > 0;

  // ── 한복 설명 (opened from the 사진촬영안내 card) ──
  // Same content and chrome as the shared step's page, so it reuses those
  // styles rather than re-authoring them; 뒤로 in JejuHeader closes it.
  if (infoOpen) {
    const info = pick(HANBOK_INFO, lang);
    const allHanbok = HANBOK_INFO_CATS
      .flatMap((name) => byCategory[name.toLowerCase()] ?? [])
      .filter((o) => Boolean(o.url) && !brokenCodes.has(o.code));
    return (
      <div className={styles.root}>
        {icon('bg') && <img src={icon('bg')} alt="" className={styles.bg} draggable={false} />}
        <Header
          title={t('MainButton_Hanbok', lang)}
          onHome={onHome}
          onBack={() => setInfoOpen(false)}
        />
        <div className={shared.infoContent}>
          <div className={shared.infoCarousel}>
            {allHanbok.map((o, i) => (
              <div
                key={o.code}
                className={`${shared.infoThumb} ${i === 0 ? shared.infoThumbSel : ''}`}
              >
                <img src={o.url} alt="" draggable={false} onError={() => markBroken(o.code)} />
              </div>
            ))}
          </div>
          <div className={shared.infoCard}>
            <p className={shared.infoHeading}>{info.heading}</p>
            <div className={shared.infoBody}>
              {info.paragraphs.map((p, i) => (
                <p key={i} className={shared.infoPara}>
                  {p}
                </p>
              ))}
            </div>
          </div>
        </div>
        {banner && (
          <div className={styles.banner}>
            <img src={banner} alt="" draggable={false} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {icon('bg') && <img src={icon('bg')} alt="" className={styles.bg} draggable={false} />}

      <Header title={photoTitle} onHome={onHome} />

      <>
          {/* ── ① 의상 선택하기 ── */}
          <div className={`${styles.step} ${styles.stepOutfit}`}>
            <span className={styles.stepBadge}>1</span>
            <p className={styles.stepTitle}>{pick(STEP_OUTFIT, lang)}</p>
          </div>
          <div className={styles.subtitle}>
            {star && <img src={star} alt="" className={styles.subtitleStar} draggable={false} />}
            <p className={styles.subtitleText}>{pick(SUBTITLE, lang)}</p>
          </div>

          {/* The column count drives the button width in CSS, so the row still
              measures the design's 420 at 8 tabs and simply divides the same
              1820 differently when the operator registers more. */}
          <div
            className={`${styles.cats} ${tabColumns >= TAB_TIGHT_FROM ? styles.catsTight : ''}`}
            style={{ '--cat-cols': tabColumns } as React.CSSProperties}
          >
            {tabRows.map((row, i) => (
              <div key={i} className={styles.catRow}>
                {row.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.cat} ${c.id === categoryId ? styles.catActive : ''}`}
                    onClick={() => {
                      setCategoryId(c.id);
                      setOutfitCode('');
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {outfits.length > 0 ? (
            <Swiper
              className={`${styles.outfits} ${showThemes ? '' : styles.outfitsGrid}`}
              modules={[Grid, FreeMode]}
              /* The ② 배경 테마 step is what decides: where it exists it occupies
                 1855 onward, so the strip gets ONE row; where it does not, the
                 strip takes that space back as a second. See `.outfits`. */
              grid={{ rows: showThemes ? 1 : 2, fill: 'row' }}
              slidesPerView={CARDS_PER_VIEW}
              spaceBetween={CARD_GAP}
              freeMode
              /* Remount on a tab change so the strip starts back at the first card
             and Swiper re-measures the new (possibly shorter) list. The row count
             is in the key because Swiper does not re-grid an existing instance. */
              key={`${categoryId}-${showThemes ? 1 : 2}`}
            >
              {outfits.map((o) => (
                <SwiperSlide key={o.code} className={styles.outfitSlide}>
                  <button
                    type="button"
                    className={`${styles.outfit} ${o.code === selectedOutfit?.code ? styles.outfitActive : ''}`}
                    onClick={() => setOutfitCode(o.code)}
                  >
                    <img
                      src={o.url}
                      alt=""
                      className={styles.outfitImg}
                      draggable={false}
                      decoding="async"
                      onError={() => markBroken(o.code)}
                    />
                  </button>
                </SwiperSlide>
              ))}
            </Swiper>
          ) : (
            /* Only once there IS a tab: before the catalogue arrives every tab
               is empty, and "준비 중" would flash on a screen that is merely
               still loading. */
            category && <p className={styles.emptyCat}>{pick(NO_OUTFITS, lang)}</p>
          )}

          {/* ── Step ② — the landing tab gets the background themes WHEN this
             kiosk has any; the 사진촬영안내 card is on EVERY condition since the
             2026-08-24 redraw, just lower on the landing tab (where it takes the
             banner's band — see .guideLanding). ── */}
          {showThemes && (
            <>
              <div className={`${styles.step} ${styles.stepTheme}`}>
                <span className={styles.stepBadge}>2</span>
                <p className={styles.stepTitle}>{pick(STEP_THEME, lang)}</p>
              </div>
              {/* Plates are the API's 9:16 previews; `object-fit: cover` fits
                  them to the design's 340×680 tile, under the 20% black wash
                  that carries the white name (see `.theme::after` in the CSS).
                  See the note above `.themes` for why the pick does not travel
                  with the capture. A plate whose photo 404s keeps its name and
                  falls back to the bare washed plate on its own — the wash and
                  the label sit over the button, not over the image element. */}
              <div className={styles.themes}>
                {backgrounds.map((bg) => {
                  const on = bg.backgroundId === backgroundId;
                  return (
                    <button
                      key={bg.backgroundId}
                      type="button"
                      className={`${styles.theme} ${on ? styles.themeActive : ''}`}
                      aria-pressed={on}
                      onClick={() => setBackgroundId(bg.backgroundId)}
                    >
                      <img
                        src={bg.imageUrl}
                        alt=""
                        className={styles.themeImg}
                        draggable={false}
                        decoding="async"
                      />
                      <p className={styles.themeLabel}>{backgroundName(bg, lang)}</p>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* On every condition — landing drops it into the banner band. */}
          <div className={`${styles.guide} ${showThemes ? styles.guideLanding : ''}`}>
              <div className={styles.guideMain}>
                <div className={styles.guideTitle}>
                  <span className={styles.guideDot} />
                  <p className={styles.guideTitleText}>{t('Photo_TakePhoto', lang)}</p>
                </div>
                <div className={styles.guideSub}>
                  {star && <img src={star} alt="" className={styles.guideStar} draggable={false} />}
                  <div className={styles.guideLines}>
                    {t('Photo_TakePhotoContent', lang)
                      .split('\n')
                      .map((line, i) => (
                        <span key={i}>{line.trim()}</span>
                      ))}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.guidePrivacy}
                  onClick={() => setPrivacyOpen(true)}
                >
                  {pick(PRIVACY_LINK, lang)}
                </button>
              </div>
              <button type="button" className={styles.guideInfo} onClick={() => setInfoOpen(true)}>
                <span className={styles.guideInfoCircle}>
                  <img src={hanbokInfo} alt="" draggable={false} />
                </span>
                <span className={styles.guideInfoLabel}>{t('MainButton_Hanbok', lang)}</span>
              </button>
          </div>

          {/* ── Capture ── */}
          <div className={`${styles.captureRow} ${showThemes ? '' : styles.captureRowGuide}`}>
            <button
              type="button"
              className={`${styles.capture} ${selectedOutfit ? '' : styles.captureDisabled}`}
              disabled={!selectedOutfit}
              onClick={() => startCapture('solo')}
            >
              <Camera className={styles.captureIcon} strokeWidth={2} />
              {pick(SOLO, lang)}
            </button>
            <button
              type="button"
              className={`${styles.capture} ${selectedOutfit ? '' : styles.captureDisabled}`}
              disabled={!selectedOutfit}
              onClick={() => startCapture('withInsa')}
            >
              <Camera className={styles.captureIcon} strokeWidth={2} />
              {pick(togetherLabel(jejuMascot()), lang)}
            </button>
          </div>
      </>

      {/* No banner on the landing outfit view — its 사진촬영안내 card occupies
          the banner band (6258:48575/48469 draw none). */}
      {banner && !showThemes && (
        <div className={styles.banner}>
          <img src={banner} alt="" draggable={false} />
        </div>
      )}

      {/* Camera-direction popup — shown while capturing / generating. */}
      {countdownActive && camPopupSrc && (
        <>
          <div className={shared.camBackdrop} />
          <div className={shared.camPopup}>
            <img src={camPopupSrc} className={shared.camPopupImg} alt="" draggable={false} />
          </div>
        </>
      )}

      {/* 개인정보 처리방침 — Figma 6258:48264. Same copy and chrome as every
          other layout, so it reuses the shared modal styles verbatim. */}
      {privacyOpen && (
        <div
          className={`${shared.privacyOverlay} ${styles.privacyOverlayJeju}`}
          onClick={() => setPrivacyOpen(false)}
        >
          <div
            className={`${shared.privacyModal} ${styles.privacyModalJeju}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={shared.privacyHead}>
              <span className={shared.privacyTitle}>{pick(PRIVACY, lang).title}</span>
              <button
                type="button"
                className={shared.privacyClose}
                onClick={() => setPrivacyOpen(false)}
                aria-label="닫기"
              >
                <svg
                  className={shared.privacyCloseIcon}
                  viewBox="0 0 129 129"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <circle
                    cx="64.3496"
                    cy="64.3496"
                    r="62.2046"
                    stroke="#333333"
                    strokeWidth="4.28997"
                  />
                  <line
                    x1="37.3533"
                    y1="34.3203"
                    x2="94.9892"
                    y2="91.9562"
                    stroke="black"
                    strokeWidth="4.28997"
                    strokeLinecap="round"
                  />
                  <line
                    x1="94.3794"
                    y1="37.3538"
                    x2="36.7435"
                    y2="94.9897"
                    stroke="black"
                    strokeWidth="4.28997"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className={shared.privacyBody}>
              {pick(PRIVACY, lang).sections.map((s, i) => (
                <div key={i} className={shared.privacySection}>
                  <p className={shared.privacySecTitle}>{s.title}</p>
                  {s.lines.map((line, j) => (
                    <p key={j} className={shared.privacySecLine}>
                      {line}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
