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
 * registered category, in the operator's `sortOrder`, labelled in the visitor's
 * language by the operator. No tab is authored here, not even a pinned one: a
 * locally-added tab would outlive the category behind it and a locally-written
 * label would silently contradict the admin web. The eight hardcoded 제주 names
 * (제주 / 한복 / 직업의상 / 일상의상 / 브랜드 / 프로모션 / 기념일 / K-CULTURE) and
 * their merges are gone. Consequences worth knowing:
 *   · `brand` now reads 이벤트 and `w=model` reads 모델 — that is what the
 *     operator actually set, not a translation slip.
 *   · `New Outfit` (12 outfits, the second-largest category) had NO tab and was
 *     unreachable. It is registered and labelled 직업복, so it now has one.
 *   · 제주 IS registered now (`'Jeju'`, id 12 — added late, so the API lists it
 *     last) but carries ZERO outfits (checked 2026-08-24: 65 outfits, none with
 *     that categoryName), so its tab honestly shows 준비 중인 의상입니다. The
 *     moment the operator uploads outfits under it, the tab fills itself AND
 *     jumps to the head of the row as the landing tab with step ② — see the
 *     reorder note above `tabs`. 기념일 remains unregistered entirely.
 *   · An empty tab row means the catalogue has never synced AND the bundled
 *     fallback is empty. There is nothing local left to draw in that case.
 *
 * ── The chip row is the category's own sub-categories ────────────────
 * The design's chip row (6258:48326 / 48134, 1266…1386 on the 한복 frames) was
 * left undrawn for as long as a tab was exactly one category and there was
 * nothing to choose between. The catalogue since grew sub-categories — 한복,
 * 직업의상 and 일상의상 each carry 남자/여자 — so the row draws itself for a
 * category that has them and stays absent for one that does not, which is every
 * category on the older catalogue and the rest of them on the newer one.
 *
 * Nothing is pre-picked and a second tap clears the pick: unpicked means the
 * whole category, which is also the only honest reading where `subCategoryId`
 * is null on every outfit. Like the tabs, not one chip is authored here.
 *
 * ★ The chips are ALSO the gender the AR request is sent with. The merge that
 * created them retired the `w=` / `m=` category prefixes, and the codes beneath
 * them carry no `-F` / `-M` either, so the sub-category is the only signal left
 * — see `genderOf` in OutfitService.
 *
 * ── 배경 테마 comes from the API ──────────────────────────────────────
 * The plates are the ACTIVE backgrounds assigned to THIS kiosk
 * (`GET /api/kiosks/{kioskNum}/backgrounds`, cached in SQLite by
 * BackgroundService and served through `useBackgroundStore`). A kiosk with none
 * assigned gets an empty list — a legitimate answer, not a failure — and step
 * ② STILL DRAWS: the heading and the band stay, with 준비 중인 배경입니다 in
 * place of the tiles, the same way an empty tab answers in the strip above.
 * Dropping the step instead (what this did until 2026-08-27) silently re-laid
 * the whole 제주 tab out as a two-row grid, so an operator who had simply not
 * assigned a background yet saw a different PAGE rather than an empty section.
 * The pick reaches the AR request: it rides
 * `onCapture` → `selectStyle` into the workflow and is sent as
 * `background_to_use`. Picking NOTHING is normal (no plate is pre-selected) and
 * sends `change_background=false` — see ARImageTransport for why that field is
 * always sent rather than omitted.
 *
 * ★ Step ② rides the 제주 TAB, not "the first tab" (2026-08-27, Figma
 * 6530:10400). It used to ride the landing tab — where it sat back when the
 * landing tab was a hardcoded 제주 — and prod quietly broke that: `Jeju` is
 * registered (id 12) but carries ZERO outfits, so the reorder below leaves it
 * LAST and step ② landed on 한복 instead, which drew the 제주 tab as a plain
 * two-row grid and 한복 as the one-row-plus-backgrounds view. Both tabs showed
 * the other one's design. Matching on the registered CODE fixes it wherever the
 * operator puts the tab.
 *
 * The 사진촬영안내 card is on EVERY condition — the 제주 tab drops it into the
 * banner band (and draws no banner), every other tab hangs it above the banner
 * — so the 한복 설명 page is reachable from anywhere.
 *
 * ── ♿ 베리어프리 (Figma 6327:85598 · 6422:25455 · 6418:10583) ─────────
 * The ♿ button on the left rail — the third and last control there — now has a
 * layout to switch to. Both tab conditions get one, and they differ from each
 * other the same way the standard ones do (제주: one outfit row plus the theme
 * band; everything else: two outfit rows and the chip band). The whole reachable
 * stack drops into the visitor's reach, the 사진촬영안내 card takes the band
 * under the header instead of the bottom of the page, the promo banner goes, and
 * 제주's two steps become one heading. The measurements live in the CSS's two y
 * maps; what the markup decides is listed at `lowReachTheme` below.
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
import type { OutfitSubCategory } from '@shared/types/outfit';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { usePhotoStore } from '@renderer/store/photoStore';
import { useBackgroundStore } from '@renderer/store/backgroundStore';
import { backgroundName } from '@renderer/lib/backgrounds';
import {
  outfitCategoryLabel,
  outfitLabel,
  outfitSubCategoryLabel,
} from '@renderer/lib/outfitCategories';
import { cameraIconUrl } from '@renderer/assets/icons/insadong/camera';
import { pick, useLang } from '@renderer/lib/i18n';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { jejuMascot, type JejuMascot } from './jejuMascot';
/* The privacy modal and the camera-direction popup are identical on every
   layout, so their styles are reused from the shared step rather than copied. */
import shared from '../photo/HanbokSelect.module.css';
import styles from './JejuHanbokSelect.module.css';

interface Props {
  /** Third argument: the step ② 배경 테마 plate, or null when none was tapped. */
  onCapture: (mode: CaptureMode, category: string, backgroundId?: number | null) => void;
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
  /** This tab's chips, in `sortOrder`. Empty for a category with none. */
  subs: OutfitSubCategory[];
}

/**
 * The 한복 설명 page's own illustration strip — NOT a tab.
 *
 * That page is specifically about 한복 (its copy is `HANBOK_INFO`), so its
 * carousel shows 한복 whatever tab it was opened from. These are the two
 * registered category names the garments live under; if neither is registered
 * the carousel is simply empty and the page still reads.
 */
/**
 * ★ Matched by SHAPE, not by a fixed list of names.
 *
 * This was `['w=hannbok', 'm=hanbok']` — the two categories PROD registers — and
 * on the newer catalogue it found nothing at all, so the page opened with an
 * EMPTY carousel and only the text card. Stage merged the gender-split pair into
 * a single `hanbok` (22 outfits, verified 2026-08-27), and a name the list did
 * not spell simply did not exist as far as this page was concerned.
 *
 * The regex covers every spelling either catalogue has used: the `w=` / `m=`
 * prefixes that the merge retired, and the server-side double-n in "hannbok".
 * A future respelling of the same category keeps working; an unrelated category
 * still cannot match, which is what keeps 직업의상 and 글로벌 out of a page whose
 * copy is specifically about 한복.
 */
const isHanbokCategory = (name: string): boolean => /^(?:[wm]=)?hann?bok$/i.test(name.trim());

/**
 * The registered category name of the 제주 tab — the ONE tab that carries the
 * ② 배경 테마 step and the one-row outfit strip (6530:10400); every other tab
 * draws the two-row strip and no step ② at all (6258:48326).
 *
 * Matched on the registered CODE (`Jeju`, lower-cased here) and never on a
 * label: 제주 is the operator's Korean display name for it, editable in the
 * admin web and absent in the other seven languages.
 */
const JEJU_CATEGORY = 'jeju';

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
 * Outfit-strip geometry, straight off the 2026-08-27 frames (6530:10400 and
 * 6258:48326) — 350-wide cards on a 17 gap, five across the 1820 column
 * (5 × 350 + 4 × 17 = 1818, the two left over being the design's own rounding).
 * Swiper divides the container by `slidesPerView` after taking the gaps out, so
 * a whole 5 lands cards at 350.4: the design's width, and no sliver of a sixth
 * card peeking in.
 *
 * The redraw also hung a NAME under every card — 16 below the plate, 25 tall —
 * so the CARD is still 350 but the SLIDE is 391. See `.outfitSlide` in the CSS.
 */
const CARD_GAP = 17;
const CARDS_PER_VIEW = 5;

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

/**
 * The ♿ 베리어프리 heading for the 제주 tab, which is ONE step there instead of
 * two: 6422:25455 / 6418:10583 draw a single ① 의상 / 테마 선택하기 and no ②
 * badge at all, because the low-reach stack has no room for a second heading
 * between the outfit row and the theme band. Same two choices, one label.
 */
const STEP_OUTFIT_THEME = {
  ko: '의상 / 테마 선택하기',
  en: 'Choose an outfit / background',
  ja: '衣装 / テーマを選ぶ',
  zh: '选择服装 / 主题',
  vi: 'Chọn trang phục / phông nền',
  th: 'เลือกชุด / ธีม',
  ru: 'Выбор наряда и фона',
  id: 'Pilih busana / tema',
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

/**
 * Step ②'s empty state — a kiosk with no ACTIVE background assigned to it.
 *
 * Worded like NO_OUTFITS on purpose: both are "the operator has not put content
 * here yet", not "something failed", and a visitor who meets one on the strip
 * and the other on the band should read the same sentence twice.
 */
const NO_BACKGROUNDS = {
  ko: '준비 중인 배경입니다.',
  en: 'Backgrounds are on the way.',
  ja: '準備中の背景です。',
  zh: '背景正在准备中。',
  vi: 'Phông nền đang được chuẩn bị.',
  th: 'พื้นหลังกำลังจัดเตรียม',
  ru: 'Фоны готовятся.',
  id: 'Latar sedang disiapkan.',
};

/**
 * The ♿ mode bar's own line. Korean only, and a literal rather than a t() call,
 * because that is what every other 제주 page draws (JejuPageFrame.modeBar,
 * JejuHome.modeBar) — the sheet's BarrierFree_Title row has the same Korean and
 * empty cells in all seven other languages, so routing it through t() would
 * blank the bar for a non-Korean visitor. Figma spells it 베리어프리; the
 * shipped pages spell it 배리어프리, and one page reading differently from the
 * rest is worse than either spelling.
 */
const BARRIER_FREE = '지금은 배리어프리 모드입니다.';

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
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const toggleLowReach = useAccessibilityStore((s) => s.toggleLowReach);
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

  /**
   * The tab row: exactly the registered categories, in the operator's
   * `sortOrder` (OutfitService sorts on it) — with ONE reorder left over. The
   * operator registered 제주 late (`'Jeju'`, id 12) on the catalogue that has no
   * sortOrder at all, so THAT one lists it LAST while the design (6431:31052)
   * draws it FIRST as the landing tab with the ② 배경테마 step. When the 제주
   * category actually has outfits it moves to the head of the row, and
   * everything keyed off "the first tab" (the landing default, step ②) follows
   * it for free. While it is
   * still EMPTY it stays where the API puts it: promoting a bare 준비중 tab to
   * the landing slot would open the whole feature on an apology. On the newer
   * catalogue this is already a no-op — 제주 is sortOrder 1 and carries outfits,
   * so it lands first on the operator's say-so rather than on ours.
   *
   * Labels are resolved here, so a language switch relabels the row without
   * touching the selection — `id` is the filter code, never a label.
   */
  const tabs: Tab[] = useMemo(() => {
    const all = categories.map((c) => ({
      id: c.categoryName,
      label: outfitCategoryLabel(c, lang),
      ko: c.labelKr,
      subs: c.subCategories,
    }));
    const i = all.findIndex(
      (t) => t.id.toLowerCase() === 'jeju' && (byCategory[t.id.toLowerCase()]?.length ?? 0) > 0,
    );
    if (i > 0) {
      const [jeju] = all.splice(i, 1) as [Tab];
      all.unshift(jeju);
    }
    return all;
  }, [categories, byCategory, lang]);

  // A session can be opened with a pre-selected tab (e.g. 프로모션 from K-DRAMA).
  const initialCategory = usePhotoStore((s) => s.initialCategory);
  const setInitialCategory = usePhotoStore((s) => s.setInitialCategory);
  /** Empty until the tabs arrive; resolved to the landing tab below. */
  const [categoryId, setCategoryId] = useState('');
  /**
   * The picked chip, or null for the whole category. Null by default: 6258:48326
   * draws the row with nothing active and 48134 with one chip active, so the two
   * frames are the before and after of a single tap.
   */
  const [subId, setSubId] = useState<number | null>(null);
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

  /** The chip row for the selected tab, in `sortOrder`. Empty → no row. */
  // Memoised on the tab rather than recomputed: the fallback would otherwise be
  // a fresh array every render and re-run the effect below with it.
  const subs = useMemo(() => category?.subs ?? [], [category]);
  useEffect(() => {
    // The row is CMS content: the operator can retire the picked chip mid-
    // session, and switching tabs lands on a row that never had it.
    if (subId !== null && !subs.some((sc) => sc.id === subId)) setSubId(null);
  }, [subId, subs]);

  const outfits: PickerOutfit[] = (byCategory[category?.id.toLowerCase() ?? ''] ?? []).filter(
    (o) =>
      Boolean(o.url) &&
      !brokenCodes.has(o.code) &&
      // No chip picked → the whole category, chips or not.
      (subId === null || o.subCategoryId === subId),
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
    // Only forward a plate that is STILL in the active set. The set is CMS
    // content refreshed on launch and nightly, so an operator retiring a 배경
    // 테마 mid-session can leave the tapped id pointing at nothing — and the AR
    // API answers a missing background by silently falling back to the plain
    // template, which would look like the choice was honoured. Drop it here
    // instead, so the request says what it means.
    const chosen = backgrounds.some((b) => b.backgroundId === backgroundId) ? backgroundId : null;
    onCapture(mode, outfitKey, chosen);
  };

  /**
   * The page's illustrated 제주 plate — the orange branch at the top, the
   * 돌하르방 and lighthouse along the bottom, exactly as every frame draws it.
   *
   * ★ `bg-page`, NOT `bg`. Both are 2160×3840 and both resolve, so this looked
   * like it was working: `bg.png` is a BLANK #faf7f2 plate (41KB) and `bg-page`
   * is the artwork (4.7MB). Asking for `bg` therefore painted a flat
   * yellowish-white over the whole body and dropped the illustration without
   * failing. Every other 제주 page gets `bg-page` from JejuPageFrame; this step
   * is the one screen that draws its own chrome, and it asked for the wrong key.
   *
   * `bg` stays as the fallback: it is at least the right base colour if the
   * artwork is ever missing from the bundle.
   */
  const pageBg = icon('bg-page') || icon('bg');

  const star = jejuIconUrl('star');
  const accessibilityIcon =
    (lowReach ? jejuIconUrl('ico-accessibility-on') : undefined) ?? jejuIconUrl('ico-accessibility');
  /**
   * Which tab owns step ② — the 제주 one, wherever the operator has put it.
   *
   * ★ This is the tab's registered CODE, not its position. It used to be
   * `tabs[0]`, and on prod that is wrong today: `Jeju` is registered with zero
   * outfits, so the reorder in `tabs` leaves it last and 한복 inherited the 제주
   * design while 제주 itself drew the plain two-row grid — each tab showing the
   * other's frame.
   *
   * Falls back to the landing tab ONLY where no 제주 category is registered at
   * all. Without that, a catalogue that never had one would strand whatever
   * backgrounds this kiosk has been assigned behind a tab that does not exist.
   */
  const themeTabId = useMemo(
    () => (tabs.find((t) => t.id.toLowerCase() === JEJU_CATEGORY) ?? tabs[0])?.id,
    [tabs],
  );
  /**
   * ★ The 제주 tab's layout, and NOTHING about the background list decides it:
   * one outfit row, then step ② directly under it, on every condition
   * (6258:48469). This used to be `isThemeTab && backgrounds.length > 0`, which
   * made an empty API list re-lay the whole page out as the two-row non-제주
   * grid — an operator who had not assigned a background yet got a different
   * PAGE rather than an empty section, and there was no way to tell the two
   * apart from the kiosk. The band now always draws; only its CONTENTS depend
   * on the list.
   */
  const isThemeTab = themeTabId !== undefined && categoryId === themeTabId;
  /** Tiles, or the 준비 중 message in the same 1820×700 band. */
  const hasBackgrounds = backgrounds.length > 0;

  /**
   * ── ♿ 베리어프리 ───────────────────────────────────────────────────────
   * The ♿ button on the left rail has always toggled `lowReach`; this page had
   * nothing to switch to until 6327:85598 (every tab but 제주) and 6422:25455 /
   * 6418:10583 (the 제주 tab) arrived. The geometry is entirely in the CSS — see
   * the y maps there. Only three things are decisions the markup has to make.
   *
   * ① The 제주 tab is ONE step in low-reach, not two: the frames draw a single
   *    ① 의상 / 테마 선택하기 and no ② badge, since there is no room for a
   *    second heading between the outfit row and the theme band.
   */
  const lowReachTheme = lowReach && isThemeTab;
  /**
   * ② The chip band the 제주 low-reach frames leave out. 제주 registers no
   *    sub-categories today, so the frame closes the band; the row is CMS
   *    content and the operator can add one, so `--lr-sub` re-opens it and
   *    pushes the outfit row, the theme band and the capture buttons down 110 —
   *    a 30px gap either side of the row, with the buttons still landing inside
   *    the 3840 artboard (3667…3817).
   */
  const lowReachSubShift = lowReachTheme && subs.length > 0 ? '110px' : '0px';
  /* ③ No promo banner on either condition — see the render. */

  // ── 한복 설명 (opened from the 사진촬영안내 card) ──
  // Same content and chrome as the shared step's page, so it reuses those
  // styles rather than re-authoring them; 뒤로 in JejuHeader closes it.
  if (infoOpen) {
    const info = pick(HANBOK_INFO, lang);
    // Walk the catalogue's OWN keys rather than probing for names we guessed:
    // whatever the operator registered 한복 under is what gets drawn. Sorted so
    // a catalogue with two 한복 categories (prod's w=/m= pair) keeps a stable
    // order between renders rather than following object insertion.
    const allHanbok = Object.keys(byCategory)
      .filter(isHanbokCategory)
      .sort()
      .flatMap((name) => byCategory[name] ?? [])
      .filter((o) => Boolean(o.url) && !brokenCodes.has(o.code));
    return (
      <div className={`${styles.root} ${lowReach ? styles.rootLowReach : ''}`}>
        {pageBg && <img src={pageBg} alt="" className={styles.bg} draggable={false} />}
        {/* This page has no low-reach frame of its own — it is a scrolling text
            page — so ♿ gives it the mode bar and clears the bar's 113. */}
        {lowReach && <div className={styles.modeBar}>{BARRIER_FREE}</div>}
        <Header
          title={t('MainButton_Hanbok', lang)}
          onHome={onHome}
          onBack={() => setInfoOpen(false)}
        />
        <div className={`${shared.infoContent} ${styles.infoContent}`}>
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

        <div className={styles.leftNav}>
          {jejuIconUrl('nav-left') && (
            <img src={jejuIconUrl('nav-left')} alt="" className={styles.leftNavImg} draggable={false} />
          )}
          <button
            type="button"
            className={`${styles.leftNavZone} ${styles.leftNavHome}`}
            onClick={onHome}
            aria-label="홈"
          />
          <button
            type="button"
            className={`${styles.leftNavZone} ${styles.leftNavBack}`}
            onClick={() => setInfoOpen(false)}
            aria-label="뒤로"
          />
        </div>
        {accessibilityIcon && (
          <button
            type="button"
            className={styles.accessibility}
            onClick={toggleLowReach}
            aria-label="저상 화면"
            aria-pressed={lowReach}
          >
            <img src={accessibilityIcon} alt="" className={styles.accessibilityImg} draggable={false} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={[
        styles.root,
        lowReach ? styles.rootLowReach : '',
        lowReachTheme ? styles.rootLowReachTheme : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={lowReach ? ({ '--lr-sub': lowReachSubShift } as React.CSSProperties) : undefined}
    >
      {pageBg && <img src={pageBg} alt="" className={styles.bg} draggable={false} />}

      {lowReach && <div className={styles.modeBar}>{BARRIER_FREE}</div>}

      {/* Title only — the description row is dropped on this page by request
          (2026-09-03); without the flag JejuHeader would draw the sheet's
          subtitle for 'AR 한복체험', or the generic fallback line.
          ★ Dropped in ♿ too, even though all three low-reach frames still show
          the header component's own 페이지 설명문 placeholder: that is the
          instance's default, not copy anyone wrote, and the request was about
          the page rather than about one of its layouts. */}
      <Header title={photoTitle} onHome={onHome} subtitleHidden />

      <>
        {/* ── ① 의상 선택하기 ── */}
        <div className={`${styles.step} ${styles.stepOutfit}`}>
          <span className={styles.stepBadge}>1</span>
          {/* ♿ on the 제주 tab this ONE heading covers both choices — the ②
              badge below is not drawn there. Every other condition keeps the
              standard 의상 선택하기. */}
          <p className={styles.stepTitle}>
            {pick(lowReachTheme ? STEP_OUTFIT_THEME : STEP_OUTFIT, lang)}
          </p>
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
                    setSubId(null);
                    setOutfitCode('');
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* ── sub-category chips (1266…1386) ──
              Drawn only where the category has them, which is what kept this
              row out of the layout until the API began sending them. */}
        {subs.length > 0 && (
          <div className={styles.subcats}>
            {subs.map((sc) => (
              <button
                key={sc.id}
                type="button"
                className={`${styles.subcat} ${sc.id === subId ? styles.subcatActive : ''}`}
                onClick={() => {
                  // Tapping the picked chip clears it — the only way back to
                  // the whole category, since nothing here is pre-picked.
                  setSubId((cur) => (cur === sc.id ? null : sc.id));
                  setOutfitCode('');
                }}
              >
                {outfitSubCategoryLabel(sc, lang)}
              </button>
            ))}
          </div>
        )}

        {outfits.length > 0 ? (
          <Swiper
            className={`${styles.outfits} ${isThemeTab ? '' : styles.outfitsGrid}`}
            modules={[Grid, FreeMode]}
            /* The TAB decides, not the background list: the 제주 tab hands
               1855 onward to step ②, so the strip gets ONE row there; every
               other tab takes that space back as a second. See `.outfits`. */
            grid={{ rows: isThemeTab ? 1 : 2, fill: 'row' }}
            slidesPerView={CARDS_PER_VIEW}
            spaceBetween={CARD_GAP}
            freeMode
            /* Remount on a tab change so the strip starts back at the first card
             and Swiper re-measures the new (possibly shorter) list. The row count
             is in the key because Swiper does not re-grid an existing instance. */
            key={`${categoryId}-${isThemeTab ? 1 : 2}`}
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
                {/* The outfit's name, added by the 2026-08-27 redraw. It is
                      OUTSIDE the button on purpose: the plate is the tap target
                      and the caption sits under it, so the selected card's
                      cream fill and orange rule stop at the plate edge exactly
                      as both frames draw them. Resolved per language like the
                      tabs and chips — the row's `name` is a slug, not a name —
                      and never empty, the store falls back to the AR code. */}
                <p className={styles.outfitName}>{outfitLabel(o, lang)}</p>
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
        {isThemeTab && (
          <>
            {/* ♿ folds this heading into step ①'s label — see STEP_OUTFIT_THEME. */}
            {!lowReach && (
              <div className={`${styles.step} ${styles.stepTheme}`}>
                <span className={styles.stepBadge}>2</span>
                <p className={styles.stepTitle}>{pick(STEP_THEME, lang)}</p>
              </div>
            )}
            {/* Plates are the API's 9:16 previews; `object-fit: cover` fits
                  them to the design's 340×680 tile, under the 20% black wash
                  that carries the white name (see `.theme::after` in the CSS).
                  See the note above `.themes` for why the pick does not travel
                  with the capture. A plate whose photo 404s keeps its name and
                  falls back to the bare washed plate on its own — the wash and
                  the label sit over the button, not over the image element. */}
            {!hasBackgrounds ? (
              /* Same band, same 700 height, so nothing below it moves — the
                 capture row is at 2883 whether the tiles are there or not. */
              <p className={styles.emptyThemes}>{pick(NO_BACKGROUNDS, lang)}</p>
            ) : (
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
            )}
          </>
        )}

        {/* On every condition — landing drops it into the banner band. */}
        <div className={`${styles.guide} ${isThemeTab ? styles.guideLanding : ''}`}>
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
        <div className={`${styles.captureRow} ${isThemeTab ? '' : styles.captureRowGuide}`}>
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
          the banner band (6258:48575/48469 draw none).

          ♿ drops it on EVERY condition: none of the three low-reach frames
          carries one, and the band it would sit in (y3267) now holds the
          capture buttons on the 제주 tab. */}
      {banner && !isThemeTab && !lowReach && (
        <div className={styles.banner}>
          <img src={banner} alt="" draggable={false} />
        </div>
      )}

      <div className={styles.leftNav}>
        {jejuIconUrl('nav-left') && (
          <img src={jejuIconUrl('nav-left')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button
          type="button"
          className={`${styles.leftNavZone} ${styles.leftNavHome}`}
          onClick={onHome}
          aria-label="홈"
        />
        <button
          type="button"
          className={`${styles.leftNavZone} ${styles.leftNavBack}`}
          onClick={onHome}
          aria-label="뒤로"
        />
      </div>
      {accessibilityIcon && (
        <button
          type="button"
          className={styles.accessibility}
          onClick={toggleLowReach}
          aria-label="저상 화면"
          aria-pressed={lowReach}
        >
          <img src={accessibilityIcon} alt="" className={styles.accessibilityImg} draggable={false} />
        </button>
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
                data-pad-dismiss
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
