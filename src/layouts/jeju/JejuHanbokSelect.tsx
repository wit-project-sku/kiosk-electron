/**
 * 제주공항 (W006) AR 한복체험 — outfit selection.
 *
 * Figma 6258:48134 · 48264 (개인정보 처리방침) · 48326 · 48469 · 48575 · 48693 ·
 * 49124. A 제주-specific replacement for the shared `HanbokSelect` step: same
 * place in the workflow, same `onCapture` contract, different layout and a
 * different category taxonomy.
 *
 * ── Outfits come from the API ─────────────────────────────────────────
 * `GET /api/outfits`, cached in SQLite by OutfitService and grouped by
 * registered `categoryName` in `useOutfitStore`. They used to be a build-time
 * PNG glob, which meant a rebuild and a fleet redeploy to add one; the bundle
 * survives only as the offline fallback.
 *
 * 제주's tabs are its own naming, so the map to the registered names is explicit
 * here rather than positional:
 *
 *   제주        ←  w=hannbok + m=hanbok   (placeholder — no 제주 set exists yet)
 *   한복        ←  w=hannbok + m=hanbok
 *   직업의상    ←  w=model
 *   일상의상    ←  m=everyday
 *   브랜드      ←  brand
 *   프로모션    ←  promotion
 *   기념일      —  nothing registered
 *   K-CULTURE   ←  K-Culture + global
 *
 * Merging two categories is safe: gender is derived per outfit (the `w=`/`m=`
 * prefix, or an explicit -F/-M on the code), so a merged 한복 tab still hands
 * the AR API the right gender per card. A tab whose categories return nothing
 * is drawn disabled — letting it through would send the AR API a category name
 * as an outfit code.
 *
 * ★ The live catalogue has a `New Outfit` category — 12 outfits, the second
 * largest — that NO tab points at, so it is currently unreachable. Which tab it
 * belongs to (or whether it needs its own) is a decision for the designer, not
 * a guess here. Live counts 2026-08-14: w=hannbok 13 · New Outfit 12 · m=hanbok
 * 9 · w=model 9 · promotion 5 · m=everyday 5 · K-Culture 3 · global 3 · brand 2.
 *
 * ── 배경 테마 comes from the API ──────────────────────────────────────
 * The plates are the ACTIVE backgrounds assigned to THIS kiosk
 * (`GET /api/kiosks/{kioskNum}/backgrounds`, cached in SQLite by
 * BackgroundService and served through `useBackgroundStore`). A kiosk with none
 * assigned gets an empty list — a legitimate answer, not a failure — so step ②
 * is dropped entirely there and 제주 falls back to the 사진촬영안내 card that
 * every other tab shows. The pick is still local state: see the note above
 * `.themes` in the CSS for what is missing on the AR side.
 */
import { useEffect, useState } from 'react';
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
import { cameraIconUrl } from '@renderer/assets/icons/insadong/camera';
import { pick, useLang } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { JejuPhotoRegister } from './JejuPhotoRegister';
/* The privacy modal and the camera-direction popup are identical on every
   layout, so their styles are reused from the shared step rather than copied. */
import shared from '../photo/HanbokSelect.module.css';
import styles from './JejuHanbokSelect.module.css';

interface Props {
  onCapture: (mode: CaptureMode, category: string) => void;
  onHome: () => void;
  countdownActive?: boolean;
}

interface Category {
  /** Canonical Korean id — also the analytics label. */
  id: string;
  /**
   * Registered `categoryName` values from `GET /api/categories/outfits`, in the
   * order their chips appear. Empty = this tab has no content yet.
   * NOT display labels — matching is exact (case-insensitive).
   */
  cats: string[];
  label: Partial<Record<Lang, string>>;
}

const CATEGORIES: Category[] = [
  // TODO(제주 W006): 제주 has no folder of its own yet. Every frame draws this
  // tab selected WITH outfits, so it points at the hanbok folders until 제주
  // artwork lands — an empty default tab is not what the design shows. Repoint
  // this the moment a cat9-jeju (or similar) folder exists.
  {
    id: '제주',
    cats: ['w=hannbok', 'm=hanbok'],
    label: {
      ko: '제주',
      en: 'Jeju',
      ja: '済州',
      zh: '济州',
      vi: 'Jeju',
      th: 'เชจู',
      ru: 'Чеджу',
      id: 'Jeju',
    },
  },
  {
    id: '한복',
    cats: ['w=hannbok', 'm=hanbok'],
    label: {
      ko: '한복',
      en: 'Hanbok',
      ja: '韓服',
      zh: '韩服',
      vi: 'Hanbok',
      th: 'ฮันบก',
      ru: 'Ханбок',
      id: 'Hanbok',
    },
  },
  {
    id: '직업의상',
    cats: ['w=model'],
    label: {
      ko: '직업의상',
      en: 'Uniforms',
      ja: '職業衣装',
      zh: '职业服装',
      vi: 'Đồng phục',
      th: 'ชุดอาชีพ',
      ru: 'Униформа',
      id: 'Seragam',
    },
  },
  {
    id: '일상의상',
    cats: ['m=everyday'],
    label: {
      ko: '일상의상',
      en: 'Everyday',
      ja: '日常着',
      zh: '日常服装',
      vi: 'Thường ngày',
      th: 'ชุดลำลอง',
      ru: 'Повседневное',
      id: 'Kasual',
    },
  },
  {
    id: '브랜드',
    cats: ['brand'],
    label: {
      ko: '브랜드',
      en: 'Brands',
      ja: 'ブランド',
      zh: '品牌',
      vi: 'Thương hiệu',
      th: 'แบรนด์',
      ru: 'Бренды',
      id: 'Merek',
    },
  },
  {
    id: '프로모션',
    cats: ['promotion'],
    label: {
      ko: '프로모션',
      en: 'Promotion',
      ja: 'プロモーション',
      zh: '促销',
      vi: 'Khuyến mãi',
      th: 'โปรโมชัน',
      ru: 'Акции',
      id: 'Promosi',
    },
  },
  {
    id: '기념일',
    cats: [],
    label: {
      ko: '기념일',
      en: 'Occasions',
      ja: '記念日',
      zh: '纪念日',
      vi: 'Dịp lễ',
      th: 'วันพิเศษ',
      ru: 'Праздники',
      id: 'Perayaan',
    },
  },
  { id: 'K-CULTURE', cats: ['K-Culture', 'global'], label: { ko: 'K-CULTURE' } },
];

/**
 * Label per registered category, for the sub-category chips. A tab that spans
 * more than one category gets a chip row (6258:48134 shows 여자 한복 / 남자 한복);
 * a single-category tab has nothing to choose between and gets none.
 *
 * Keys are the API's own names, lower-cased — the CMS ships no translations for
 * them, and "w=hannbok" is not something to put in front of a visitor.
 */
const CAT_LABELS: Record<string, Partial<Record<Lang, string>>> = {
  'w=hannbok': {
    ko: '여자 한복',
    en: "Women's Hanbok",
    ja: '女性韓服',
    zh: '女式韩服',
    vi: 'Hanbok nữ',
    th: 'ฮันบกหญิง',
    ru: 'Женский ханбок',
    id: 'Hanbok wanita',
  },
  'w=model': {
    ko: '여자 의상',
    en: "Women's",
    ja: '女性衣装',
    zh: '女式服装',
    vi: 'Trang phục nữ',
    th: 'ชุดหญิง',
    ru: 'Женское',
    id: 'Busana wanita',
  },
  'm=hanbok': {
    ko: '남자 한복',
    en: "Men's Hanbok",
    ja: '男性韓服',
    zh: '男式韩服',
    vi: 'Hanbok nam',
    th: 'ฮันบกชาย',
    ru: 'Мужской ханбок',
    id: 'Hanbok pria',
  },
  'm=everyday': {
    ko: '남자 의상',
    en: "Men's",
    ja: '男性衣装',
    zh: '男式服装',
    vi: 'Trang phục nam',
    th: 'ชุดชาย',
    ru: 'Мужское',
    id: 'Busana pria',
  },
  'global': {
    ko: '글로벌 의상',
    en: 'Global',
    ja: 'グローバル',
    zh: '全球服装',
    vi: 'Quốc tế',
    th: 'สากล',
    ru: 'Мировое',
    id: 'Global',
  },
  promotion: { ko: '프로모션', en: 'Promotion' },
  brand: { ko: '브랜드', en: 'Brands' },
  'k-culture': { ko: 'K-CULTURE' },
};

/**
 * Outfit-strip geometry, straight off 6258:48611 — 478-wide cards on a 508
 * pitch inside the 1820 column. Swiper sizes slides from `slidesPerView`, so
 * the card width is expressed as "how many fit", not as a fixed px: four cards
 * overrun the column, and the fractional value is what leaves the design's
 * peek of the next card at the right edge.
 */
const CARD_GAP = 30;
const CARDS_PER_VIEW = (1820 + CARD_GAP) / (478 + CARD_GAP); // 3.6417…

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

const TOGETHER = {
  ko: "사진촬영(with '하영')",
  en: "Take a photo (with 'Hayoung')",
  ja: '写真撮影（하영と）',
  zh: "拍照（与'하영'）",
  vi: "Chụp ảnh (với 'Hayoung')",
  th: "ถ่ายรูป (กับ 'Hayoung')",
  ru: 'Фото (с «Хаён»)',
  id: "Foto (dengan 'Hayoung')",
};

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
  const loadOutfits = useOutfitStore((s) => s.load);
  const reloadOutfits = useOutfitStore((s) => s.reload);
  useEffect(() => {
    void loadOutfits();
    return window.api.events.onOutfitsChanged(() => void reloadOutfits());
  }, [loadOutfits, reloadOutfits]);

  // A session can be opened with a pre-selected tab (e.g. 프로모션 from K-DRAMA).
  const initialCategory = usePhotoStore((s) => s.initialCategory);
  const setInitialCategory = usePhotoStore((s) => s.setInitialCategory);
  // 제주 is the landing tab — it is the one selected in every frame.
  const [categoryId, setCategoryId] = useState<string>(() =>
    initialCategory && CATEGORIES.some((c) => c.id === initialCategory && c.cats.length)
      ? initialCategory
      : '제주',
  );
  useEffect(() => {
    if (initialCategory) setInitialCategory(null);
  }, [initialCategory, setInitialCategory]);

  const [outfitCode, setOutfitCode] = useState('');
  /** Index INTO `category.cats` when the tab spans more than one. */
  const [subIdx, setSubIdx] = useState(0);
  // No background is pre-selected — the frames draw every plate unhighlighted.
  const [backgroundId, setBackgroundId] = useState<number | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  /**
   * 정보 입력 (Figma 6258:49690) stands between the capture buttons and the
   * camera: it holds the chosen mode until 등록하기 confirms consent.
   */
  const [pendingMode, setPendingMode] = useState<CaptureMode | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  // Cards whose image fails to load are dropped rather than left as empty boxes.
  const [brokenCodes, setBrokenCodes] = useState<Set<string>>(new Set());
  const markBroken = (code: string): void => setBrokenCodes((s) => new Set(s).add(code));

  const category = CATEGORIES.find((c) => c.id === categoryId) ?? (CATEGORIES[1] as Category);
  // A multi-folder category shows chips and lists ONE folder at a time; a
  // single-folder one lists its folder outright.
  const hasSubs = category.cats.length > 1;
  const shownCats = hasSubs
    ? [category.cats[Math.min(subIdx, category.cats.length - 1)] as string]
    : category.cats;
  const outfits: PickerOutfit[] = shownCats
    .flatMap((name) => byCategory[name.toLowerCase()] ?? [])
    .filter((o) => Boolean(o.url) && !brokenCodes.has(o.code));

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

  const askForDetails = (mode: CaptureMode): void => {
    if (!selectedOutfit) return; // nothing chosen — never send a bare category
    setPendingMode(mode);
  };

  const star = jejuIconUrl('star');
  /** 제주 is the only category with a background-theme step. */
  const isJejuTab = categoryId === '제주';
  /**
   * Step ② only exists when this kiosk actually has backgrounds assigned.
   * With none — an empty API list, or the very first launch before the fetch
   * lands — 제주 draws the same 사진촬영안내 card as every other tab, which is
   * also why this (not `isJejuTab`) drives the outfit strip's row count: the two
   * halves of that slot must agree or the strip overlaps the capture buttons.
   */
  const showThemes = isJejuTab && backgrounds.length > 0;

  // ── 한복 설명 (opened from the 사진촬영안내 card) ──
  // Same content and chrome as the shared step's page, so it reuses those
  // styles rather than re-authoring them; 뒤로 in JejuHeader closes it.
  if (infoOpen) {
    const info = pick(HANBOK_INFO, lang);
    const allHanbok = ['w=hannbok', 'm=hanbok']
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

  /**
   * 정보 입력 replaces this page's BODY rather than veiling it. Figma 6258:49690
   * draws that step as an ordinary sub-page — background, header, banner, the
   * card — with no trace of the outfit step behind it. Rendering it over a
   * translucent scrim left the tabs, the outfit strip and the capture buttons
   * showing through, which is not what either frame draws.
   */
  const registering = pendingMode !== null && !countdownActive;

  return (
    <div className={styles.root}>
      {icon('bg') && <img src={icon('bg')} alt="" className={styles.bg} draggable={false} />}

      {/* 뒤로 backs out of 정보 입력 first — the frame draws the same chevron, and
          it is the only way back now that there is no scrim to tap. */}
      <Header
        title={photoTitle}
        onHome={onHome}
        onBack={registering ? () => setPendingMode(null) : undefined}
      />

      {!registering && (
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

          <div className={styles.cats}>
            {[0, 1].map((row) => (
              <div key={row} className={styles.catRow}>
                {CATEGORIES.slice(row * 4, row * 4 + 4).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.cat} ${c.id === categoryId ? styles.catActive : ''}`}
                    onClick={() => {
                      setCategoryId(c.id);
                      setOutfitCode('');
                      setSubIdx(0);
                    }}
                  >
                    {pick(c.label, lang)}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {hasSubs && (
            <div className={styles.subChips}>
              {category.cats.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  className={`${styles.subChip} ${i === subIdx ? styles.subChipActive : ''}`}
                  onClick={() => {
                    setSubIdx(i);
                    setOutfitCode('');
                  }}
                >
                  {pick(CAT_LABELS[name.toLowerCase()] ?? { ko: name }, lang)}
                </button>
              ))}
            </div>
          )}

          {outfits.length > 0 ? (
            <Swiper
              className={`${styles.outfits} ${showThemes ? '' : styles.outfitsGrid}`}
              modules={[Grid, FreeMode]}
              /* The ② 배경 테마 step is what decides: where it exists it occupies
                 1978 onward, so the strip gets ONE row; where it does not, the
                 strip takes that space back as a second. See `.outfits`. */
              grid={{ rows: showThemes ? 1 : 2, fill: 'row' }}
              slidesPerView={CARDS_PER_VIEW}
              spaceBetween={CARD_GAP}
              freeMode
              /* Remount on a tab change so the strip starts back at the first card
             and Swiper re-measures the new (possibly shorter) list. The row count
             is in the key because Swiper does not re-grid an existing instance. */
              key={`${categoryId}-${subIdx}-${showThemes ? 1 : 2}`}
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
            <p className={styles.emptyCat}>{pick(NO_OUTFITS, lang)}</p>
          )}

          {/* ── Step ② — the 제주 tab gets the background themes WHEN this kiosk
             has any; every other category (and a kiosk with none assigned) gets
             the 사진촬영안내 card. Mutually exclusive, same slot. ── */}
          {showThemes ? (
            <>
              <div className={`${styles.step} ${styles.stepTheme}`}>
                <span className={styles.stepBadge}>2</span>
                <p className={styles.stepTitle}>{pick(STEP_THEME, lang)}</p>
              </div>
              {/* Plates are the API's 9:16 previews; `object-fit: cover` fits
                  them to the design's 381×762 card, under the milky veil that
                  carries the name (see `.theme::after` in the CSS). See the note
                  above `.themes` for why the pick does not travel with the
                  capture. A plate whose image 404s keeps its name and falls back
                  to the bare plate on its own — the veil and the label sit over
                  the button, not over the <img>. */}
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
          ) : (
            <div className={styles.guide}>
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
          )}

          {/* ── Capture ── */}
          <div className={`${styles.captureRow} ${showThemes ? '' : styles.captureRowGuide}`}>
            <button
              type="button"
              className={`${styles.capture} ${selectedOutfit ? '' : styles.captureDisabled}`}
              disabled={!selectedOutfit}
              onClick={() => askForDetails('solo')}
            >
              <Camera className={styles.captureIcon} strokeWidth={2} />
              {pick(SOLO, lang)}
            </button>
            <button
              type="button"
              className={`${styles.capture} ${selectedOutfit ? '' : styles.captureDisabled}`}
              disabled={!selectedOutfit}
              onClick={() => askForDetails('withInsa')}
            >
              <Camera className={styles.captureIcon} strokeWidth={2} />
              {pick(TOGETHER, lang)}
            </button>
          </div>
        </>
      )}

      {banner && (
        <div className={styles.banner}>
          <img src={banner} alt="" draggable={false} />
        </div>
      )}

      {/* 정보 입력 — 등록하기 is what actually starts the capture. */}
      {registering && (
        <JejuPhotoRegister
          onOpenPolicy={() => setPrivacyOpen(true)}
          onSubmit={() => {
            const mode = pendingMode;
            setPendingMode(null);
            onCapture(mode, outfitKey);
          }}
        />
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
        <div className={shared.privacyOverlay} onClick={() => setPrivacyOpen(false)}>
          <div className={shared.privacyModal} onClick={(e) => e.stopPropagation()}>
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
