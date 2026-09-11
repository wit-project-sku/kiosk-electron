/**
 * 제주공항 (W006) home — Figma node 6439:71456 (제주>홈), the 2026-08-24 redesign
 * of 6117:48085.
 *
 * Built from the real node via get_design_context; every position/size in
 * JejuHome.module.css is the exact Figma value. All artwork is exported from its
 * OWN Figma node (see assets/icons/jeju), so no icon is matched by filename —
 * that guesswork is what produced missing icons on the Osan round.
 *
 * Layout, top to bottom: location + clock · 공지 card with live weather ·
 * 운항 정보 board · search row · 3 feature cards · 12-tile grid on a white
 * panel · K-DRAMA / 사진촬영 / 화장실.
 *
 * The redesign moved the bottom action row down into the strip the rotating
 * banner used to own (y3267–3840) and draws NOTHING below it, so the banner is
 * no longer part of this screen — `useRotatingBanner` is gone from here. Other
 * layouts still use it; put it back only with a design that has room for it.
 *
 * The 운항 정보 board was redrawn with six columns and three 현황 conditions
 * (탑승중 / 지연 / 탑승최종) — it lives in JejuFlightBoard.tsx.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { IDLE_TIMEOUT_MS, type KioskController } from '@renderer/hooks/useKioskController';
import { useInactivityReset } from '@renderer/hooks/useInactivityReset';
import type { KioskScreenId } from '@shared/types/kiosk';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useOrderedTiles, type TileKey } from '@renderer/lib/buttonLayout';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { useWeatherVideo } from '@renderer/hooks/useWeatherVideo';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useSearchStore } from '@renderer/store/searchStore';
import { usePhotoStore } from '@renderer/store/photoStore';
import { weatherIconUrl, weatherIconName } from '@renderer/assets/weather';
import type { Lang } from '@renderer/lib/i18n';
import { t, tPlain, sheetText } from '@renderer/lib/loc';
import { DONATION_COMING_SOON, withComingSoon } from '@shared/config/donation';
import { JEJU_OUTFIT_CATEGORY } from './JejuHanbokSelect';
import { JejuFlightBoard } from './JejuFlightBoard';
import { JejuSailingBoard } from './JejuSailingBoard';
import { JejuWeatherPanel } from './JejuWeatherPanel';
import { modeBarVars } from './lowReach';
import { useFitText } from './fitText';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';
import { HangulComposer } from '../insadong/keyboard/hangul';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import styles from './JejuHome.module.css';

interface Props {
  controller: KioskController;
}

/** Search-bar language button → the current language's display code. */
const LANG_CODE: Record<string, string> = {
  ko: 'KR', en: 'EN', ja: 'JP', zh: 'CN', vi: 'VN', th: 'TH', ru: 'RU', id: 'ID',
};

/**
 * Notice + search placeholder now come from Localization_Jeju (`NoticeContent`,
 * `Main_Search`), so an edit in the sheet reaches the kiosk on the next night
 * sync with no rebuild — the same path every other location uses.
 *
 * These objects remain as the LAST-RESORT fallback for the two keys, used only
 * when neither the synced nor the bundled table has a value for the language and
 * `t()` would otherwise render the raw key. `t()` already falls back to the
 * sheet's Korean first, so in practice these fire only if the key disappears
 * from the sheet entirely.
 */
const NOTICE_FALLBACK = {
  ko: '<b>9월 제주</b>는 살이 통통하게 오른 은갈치와 고등어 같은 가을 해산물과 상큼한 황금향이 맛과 향이 가장 뛰어난 제철입니다.',
  en: '<b>September in Jeju</b> is peak season for plump autumn seafood — silver hairtail and mackerel — and for fragrant, tangy golden hallabong.',
  ja: '<b>9月の済州</b>は、身の締まったタチウオやサバなどの秋の海の幸と、爽やかな黄金香が最も美味しい旬の季節です。',
  zh: '<b>九月的济州岛</b>，正是肉质肥美的带鱼、青花鱼等秋季海鲜与清甜黄金香最当季的时节。',
};

const SEARCH_PLACEHOLDER_FALLBACK = {
  ko: '제주에 대해 검색해보세요!',
  en: 'Search about Jeju!',
  ja: '済州について検索してみてください！',
  zh: '搜索关于济州的信息！',
  vi: 'Tìm kiếm về Jeju!',
  th: 'ค้นหาเกี่ยวกับเชจู!',
  ru: 'Поиск о Чеджу!',
  id: 'Cari tentang Jeju!',
};

/** Sheet key → local fallback, resolved by {@link sheetText}. */
const FALLBACKS: Record<string, Partial<Record<Lang, string>>> = {
  NoticeContent: NOTICE_FALLBACK,
  Main_Search: SEARCH_PLACEHOLDER_FALLBACK,
  BarrierFree_Title: {
    ko: '지금은 배리어프리 모드입니다.',
    en: 'Currently in Barrier-Free Mode.',
    ja: '現在はバリアフリーモードです。',
    zh: '现在是无障碍模式。',
    vi: 'Hiện tại là chế độ không rào cản.',
    th: 'ขณะนี้อยู่ในโหมดไร้อุปสรรค',
    ru: 'В настоящее время используется безбарьерный режим.',
    id: 'Saat ini dalam mode bebas hambatan.',
  },
};

/**
 * Localized sheet string, resolved PER LANGUAGE rather than per key.
 *
 * `sheetText` (lib/loc) does the resolving — sheet cell for this language, then
 * the authored fallback for the SAME language, then `t()`'s Korean chain. A
 * plain `t()` would hide a real regression: Localization_Jeju fills
 * `Main_Search` in Korean only, while the copy authored here has all eight, so
 * `t()` would answer Korean to an English visitor and look like it worked.
 * Checked 2026-08-13: of the keys this screen uses, Main_Search is 1/8 languages
 * and MainButton_ToEat / ToBuy / AI are 2/8 — the sheet still has gaps.
 */
const homeText = (key: string, lang: Lang): string => sheetText(key, lang, FALLBACKS[key]);

/**
 * The notice, preferring THIS MONTH's row.
 *
 * ★ The sheet grew twelve month rows — `NoticeContent -1` … `NoticeContent -12`
 * (note the space before the dash: that is the operator's spelling, and the key
 * is matched verbatim). They carry seasonal copy: `-9` is about 은갈치 and
 * 황금향, `-10` about 노지감귐 and 방어. Only those two are written today; the
 * other ten are empty rows waiting to be filled.
 *
 * So the month is a PREFERENCE, not a requirement: an empty month falls straight
 * back to the undated `NoticeContent` the screen has always shown, which is why
 * filling a row is all the operator has to do and clearing one is safe. Uses the
 * kiosk's local month, the same clock the header's date line reads.
 *
 * Bold comes from literal `<b>…</b>` in the sheet cell — `parseNotice` turns
 * those into `<b>` runs; `.noticeText b` carries weight 700.
 */
const noticeText = (lang: Lang): string => {
  const monthly = sheetText(`NoticeContent -${new Date().getMonth() + 1}`, lang);
  return monthly || homeText('NoticeContent', lang);
};

/**
 * Home-tile / card screen id → Localization_Jeju key, mirroring Osan's
 * TILE_LABEL_KEYS. Only the DISPLAY label is localized — `navigate()` keeps
 * receiving the Korean label, because that string is the analytics label and is
 * joined against the `buttons` table (see buttonCatalog).
 *
 * The home's own 운항 정보 board has no MainButton_* row in the sheet, so it keeps
 * its authored label. 탐나오 now HAS one, and the sheet has already caught up with
 * the two-tab redraw: MainButton_Tamnao reads 탐나오·제주큐랑 in all eight
 * languages, so the tile says the pair even though `navigate()` still receives
 * the CMS's 탐나오.
 *
 * MainButton_Cruise / SubButton_Cruise (운항정보 · 입·출항 정보) serve DOUBLE duty
 * and that is correct: on 제주공항 they title the 운항정보 page (see i18n's
 * TITLE_KEYS), and on 여객터미널 they also label the 크루즈 운항 tile that opens
 * the ferry board. The sheet files both under "유산문화센터, 여객선터미널에 적용".
 * Note the tile therefore READS 운항정보 while `navigate()` still receives
 * 크루즈 운항 — the CMS's button_type, and the only string the analytics join
 * matches on.
 *
 * MainButton_Greeting and MainButton_ToHelp used to render "안녕 '유산'" and
 * "도와줘 '유산'" here. That was NOT stale sheet data: Localization_Jeju is one
 * tab shared by 제주공항 and 제주유산문화센터, so both keys carry two rows and a
 * last-wins parser handed W006 the 유산 one. Both parsers now break the tie on
 * the mascot name — see LocalizationSyncParser.VENUE_MASCOTS and
 * sync-sheet.mjs jejuVenueScore. Nothing is overridden on this side.
 */
const TILE_LABEL_KEYS: Partial<Record<string, string>> = {
  eat: 'MainButton_ToEat',
  shop: 'MainButton_ToBuy',
  lodging: 'MainButton_Accommodation',
  taxfree: 'MainButton_TaxFree',
  about: 'MainButton_Here',
  hello: 'MainButton_Greeting',
  help: 'MainButton_ToHelp',
  rentcar: 'MainButton_RentCar',
  cruise: 'MainButton_Cruise',
  exchange: 'MainButton_Exchange',
  donation: 'MainButton_Donation',
  localpay: 'MainButton_LocalCurrency',
  tamnao: 'MainButton_Tamnao',
  ai_search: 'MainButton_AI',
  market: 'MainButton_Goods',
  events: 'MainButton_Event',
};

/**
 * The descriptive second line under each tile/card title. Same resolution as the
 * titles: sheet first, authored `sub` as the fallback.
 *
 * 제주 is the only layout with two-line home tiles — Insadong/Osan/Hwaseong draw
 * a single label — so this map has no counterpart on the other kiosks.
 *
 * ★ The sheet spells these `MainButton_*_Subtext`, NOT `SubButton_*`. This map
 * asked for the latter and so EVERY entry missed: `t()` handed the key back,
 * `fromSheet` read that as "no row" and fell through to the authored Korean, and
 * the second line was hardcoded in all eight languages while looking wired.
 * Localization_Jeju carries 13 `_Subtext` rows, all filled 8/8, and no
 * `SubButton_*` at all (checked against localization-jeju.generated.ts).
 *
 * Both spellings are listed because the sheet has USED both — sync-sheet.mjs's
 * venue tie-break still documents SubButton_Greeting / SubButton_ToHelp /
 * SubButton_Accommodation as duplicated rows, which is what the tab held before
 * the rename. First hit wins, the same way i18n's TITLE_KEYS resolves its own
 * candidate lists, so a rename in either direction keeps working.
 *
 * Note 뭐사지's key really is `_SubText` with a capital T — the one row that
 * breaks the pattern, and that is the sheet's spelling, not a typo here.
 *
 * 탐나오's tile second line is `MainButton_Tamnao_Subtext`. `Tamnao_Subtitle` is
 * the PAGE subheader (prefixed "* "), not this map.
 */
const TILE_SUB_KEYS: Partial<Record<string, string | readonly string[]>> = {
  eat: ['MainButton_ToEat_Subtext', 'SubButton_ToEat'],
  shop: ['MainButton_ToBuy_SubText', 'SubButton_ToBuy'],
  lodging: ['MainButton_Accommodation_Subtext', 'SubButton_Accommodation'],
  taxfree: ['MainButton_TaxFree_Subtext', 'SubButton_TaxFree'],
  about: ['MainButton_Here_Subtext', 'SubButton_Here'],
  hello: ['MainButton_Greeting_Subtext', 'SubButton_Greeting'],
  help: ['MainButton_ToHelp_Subtext', 'SubButton_ToHelp'],
  rentcar: ['MainButton_RentCar_Subtext', 'SubButton_RentCar'],
  cruise: ['MainButton_Cruise_Subtext', 'SubButton_Cruise'],
  exchange: ['MainButton_Exchange_Subtext', 'SubButton_Exchange'],
  donation: ['MainButton_Donation_Subtext', 'SubButton_Donation'],
  localpay: ['MainButton_LocalCurrency_Subtext', 'SubButton_LocalCurrency'],
  tamnao: 'MainButton_Tamnao_Subtext',
  ai_search: ['MainButton_AI_Subtext', 'SubButton_AI'],
  market: ['MainButton_Goods_Subtext', 'SubButton_Goods'],
  events: ['MainButton_Event_Subtext', 'SubButton_Event'],
};

/**
 * Dwell time on each half of a paired tile title, in ms. Long enough to read
 * and re-read the name at kiosk distance; short enough that a visitor walking
 * past the grid still sees both within one pass.
 */
const TILE_TITLE_CYCLE_MS = 4_500;

/**
 * The middle dot the sheet pairs two names with — U+00B7 in ko/en/zh/vi/th/ru/id
 * and U+30FB in ja, with or without spaces around it. Surrounding whitespace is
 * eaten with the dot so the halves need no trimming.
 */
const TITLE_PAIR_SEPARATOR = /\s*[·・]\s*/;

/** The halves of a paired title, or a single-element list for an ordinary one. */
const titleParts = (label: string): string[] => {
  const parts = label.split(TITLE_PAIR_SEPARATOR).filter(Boolean);
  return parts.length > 1 ? parts : [label];
};

/**
 * A tile title that names TWO things — MainButton_Tamnao reads 탐나오·제주큐랑
 * in all eight languages, and it is the only such row today — shown one name at
 * a time instead of wrapped onto a second line.
 *
 * Low-reach narrows every tile from 300px to 230px (`.tileLow`), and the pair
 * does not fit that column on one line in ANY language: it wrapped, and since
 * `.tileTextLow` is a fixed box that starts 260px down a 303px tile, the second
 * row ran off the bottom of the tile. Alternating the halves keeps the single
 * row the frame draws.
 *
 * Only the DISPLAY splits. `navigate()` still receives the CMS's 탐나오 (see
 * TILE_LABEL_KEYS), so the analytics label and the buttons-table join are
 * untouched by this.
 *
 * The timer is per-tile and starts on mount, so the halves of different tiles
 * would not be in step if the sheet ever pairs a second one — that is fine, and
 * cheaper than a shared clock the whole grid would re-render on.
 */
function CyclingTileTitle({ label }: { label: string }): ReactElement {
  const parts = useMemo(() => titleParts(label), [label]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    if (parts.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % parts.length), TILE_TITLE_CYCLE_MS);
    return () => clearInterval(id);
  }, [parts]);

  const shown = parts[index] ?? parts[0] ?? label;
  /* `key` restarts the fade on every swap — without it React reuses the node,
     the animation never re-runs and the name changes in one hard cut. */
  return (
    <span key={`${shown}-${index}`} className={parts.length > 1 ? styles.tileTitleCycle : undefined}>
      {shown}
    </span>
  );
}

/** A `<b>`-and-newline run, as the sheet's NoticeContent stores it. */
interface Run {
  text: string;
  bold?: boolean;
}

/**
 * The bold and break markers the sheet's own authors type.
 *
 * Deliberately FORGIVING about how the tag is written, because these are typed
 * into a spreadsheet cell by hand and not by anything that validates them: case
 * is ignored (`<B>` reads the same as `<b>`), inner padding is allowed
 * (`< / b >`), and `<strong>` is accepted as a synonym. Every form that misses
 * this pattern renders as literal angle brackets on the home screen, which is
 * the failure this is guarding against.
 */
const BOLD_TAG = /<\s*\/?\s*(?:b|strong)\s*>/i;
const CLOSING_TAG = /<\s*\//;
const BREAK_TAG = /^<\s*br\s*\/?\s*>$/i;
const NOTICE_TOKENS = /(<\s*\/?\s*(?:b|strong)\s*>|<\s*br\s*\/?\s*>|\n)/gi;

/**
 * Split the notice into bold/plain runs. The sheet authors it with literal
 * `<b>…</b>` markers, which would otherwise render as visible tag text.
 * `.noticeText b` already carries the 700 weight, so the markup maps straight
 * onto the design.
 *
 * ── An opening tag TOGGLES, it does not just switch on ──────────────────────
 * `<b>제주<b> 여행` — a second opening tag where a closing one was meant — is a
 * normal thing to find in a hand-typed cell, and taking it literally would set
 * bold once and never clear it, running the weight to the end of the notice.
 * So `<b>` flips the state rather than setting it, which reads the mistyped form
 * the way it was obviously meant AND leaves every well-formed one unchanged:
 * `<b>A</b> B <b>C</b>` toggles on/off/on/off exactly as before.
 *
 * ── What is NOT markup stays text ───────────────────────────────────────────
 * Only these tags are consumed. Anything else between angle brackets is left
 * alone as ordinary text, which is load-bearing rather than lazy: the sheets
 * carry `<AR 한복체험>` and `<Примерка ханбока AR>` as literal copy, and a
 * generic tag-stripper (or `dangerouslySetInnerHTML`) would silently eat them.
 * `<color=#FE6C50>` appears in other keys too and would likewise pass through as
 * text if it ever landed here — see the summary if that needs supporting.
 *
 * The sheet's `\n` / `<br/>` breaks become plain spaces rather than <br>: the
 * Korean cell hard-wraps at FOUR lines, but this card's slot is THREE — the
 * orange rule is 242px tall (3 × 70px line-height). The fourth authored row
 * hung below the rule.
 *
 * Re-flowing is safe because the copy is far narrower than four lines: measured
 * in Noto Sans KR at 51px the whole Korean notice is 2438px of text — 2.4 lines
 * against the 1033px box — so the browser wraps it to the three the design
 * draws (ko 3, ja 3, zh 2). English is the one outlier at 3035px and still
 * takes four rows; the line count now follows the copy and the box instead of
 * whatever breaks the sheet happens to carry.
 */
function parseNotice(text: string): Run[] {
  const runs: Run[] = [];
  let bold = false;
  for (const tok of text.split(NOTICE_TOKENS)) {
    if (!tok) continue;
    if (BOLD_TAG.test(tok)) {
      // A close always clears; an open flips. See the note above.
      bold = CLOSING_TAG.test(tok) ? false : !bold;
      continue;
    }
    // A break is a word boundary, not a nbsp — HTML collapses the run of
    // whitespace this leaves next to the sheet's own trailing spaces.
    if (tok === '\n' || BREAK_TAG.test(tok)) { runs.push({ text: ' ' }); continue; }
    runs.push(bold ? { text: tok, bold: true } : { text: tok });
  }
  return runs;
}

// ── Date / time ────────────────────────────────────────────────────────
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** `2025-09-13(Mon)  ㅣ  06:00` — the exact format in the Figma top bar. */
function formatDateTime(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}(${DAY_NAMES[d.getDay()]})  ㅣ  ${hh}:${mm}`;
}

// ── Tiles ──────────────────────────────────────────────────────────────
interface Tile {
  screen: KioskScreenId;
  /** Korean label — also the analytics label handed to navigate(). */
  label: string;
  /** Second line under the label. */
  sub: string;
  /** jejuIconUrl key — the exported 200×200 Figma plate. */
  icon: string;
  /**
   * Plate colour painted BEHIND the art, at the grid's own 45px radius.
   *
   * Only 탐나오 needs it: its art is the 탐나오 app icon, a squircle drawn at
   * radius ~86, which among eleven 45px plates reads as a different kind of
   * control — a round button dropped into the grid. A plate in the icon's own
   * red fills the corners the squircle leaves transparent, so the tile is the
   * same 45px plate as its neighbours and the icon's roundness disappears into
   * it. Match this to the ART, not to a palette token.
   */
  plate?: string;
}

/**
 * The one grid slot that differs between the two 제주 venues — row 2, column 4.
 *
 * 제주공항 W006 draws 렌트카; 제주국제여객터미널 W007 draws 크루즈 운항, which opens
 * the ferry sailing board (JejuCruise). Everything else on the two homes is
 * identical, so this is the whole of the per-venue difference.
 *
 * Verified against the live CMS on 2026-08-24: `/api/kiosks/7/buttons` is
 * byte-for-byte W006's 21 rows with exactly this one changed (id 163, line 6
 * position 4), and the terminal's Figma home 6457:116495 draws a ship in the
 * same cell.
 *
 * `label` is the ANALYTICS label — `navigate()` hands it straight to the buttons
 * join, so it must stay byte-identical to the CMS's `button_type` (see
 * buttonCatalog's SLOT_OVERRIDES). The label the visitor READS comes from
 * TILE_LABEL_KEYS via the sheet, and the two are allowed to differ.
 */
const RENTCAR_TILE: Tile = { screen: 'rentcar', label: '렌트카', sub: '간편 예약', icon: 'tile-rentcar' };
const CRUISE_TILE: Tile = { screen: 'cruise', label: '크루즈 운항', sub: '입·출항 정보', icon: 'tile-cruise' };

/**
 * The 안녕/도와줘 tiles carry the venue's MASCOT in their analytics labels, so
 * they too are per-venue: W006/W007's CMS rows read 하영, W008's read 유산
 * (`/api/kiosks/8/buttons` ids 182/183, verified 2026-08-24). Like the venue
 * tile's label, these must stay byte-identical to the CMS `button_type`
 * (ASCII apostrophes); the label the visitor READS still comes from
 * TILE_LABEL_KEYS via the sheet, whose mascot tie-break already answers
 * per-layout.
 */
interface TileMascot {
  hello: string;
  helloSub: string;
  help: string;
}
const HAYOUNG_LABELS: TileMascot = { hello: "안녕 '하영'", helloSub: '하영 소개', help: "도와줘 '하영'" };
const YUSAN_LABELS: TileMascot = { hello: "안녕 '유산'", helloSub: '유산 소개', help: "도와줘 '유산'" };

/** Shared by every venue's grid — see the plate note on {@link Tile}. */
const TAMNAO_TILE: Tile = { screen: 'tamnao', label: '탐나오', sub: '제주공공플랫폼', icon: 'tile-tamnao', plate: '#e8534c' };

/** The 12 grid tiles, in Figma reading order (4 columns × 3 rows). */
const tilesWith = (venue: Tile, m: TileMascot = HAYOUNG_LABELS): Tile[] => [
  { screen: 'eat',      label: "'제주'뭐먹지", sub: '맛집 추천',      icon: 'tile-eat'      },
  { screen: 'shop',     label: "'제주'뭐사지", sub: '쇼핑 추천',      icon: 'tile-shop'     },
  { screen: 'lodging',  label: '숙박안내',     sub: '제주 숙소 모음', icon: 'tile-lodging'  },
  { screen: 'taxfree',  label: 'TAX-FREE',    sub: '면세혜택',       icon: 'tile-taxfree'  },
  { screen: 'about',    label: '여기는 제주도', sub: '관광지 추천',    icon: 'tile-about'    },
  { screen: 'hello',    label: m.hello,        sub: m.helloSub,       icon: 'tile-hello'    },
  { screen: 'help',     label: m.help,          sub: '편의시설 안내',  icon: 'tile-help'     },
  venue,
  { screen: 'exchange', label: '환율',         sub: '환율계산기',     icon: 'tile-exchange' },
  { screen: 'donation', label: '기부',         sub: '교복 기부',      icon: 'tile-donation' },
  TAMNAO_TILE,
  { screen: 'localpay', label: '지역화폐',     sub: '탐나는전',       icon: 'tile-localpay' },
];

/**
 * Both grids, built once at module scope.
 *
 * Their identities have to be STABLE across renders: `useOrderedTiles` memoises
 * on the array it is handed, so building one per render would re-run the CMS
 * join — and re-log its diagnostics — on every tick of the home clock.
 */
const TILES_AIRPORT = tilesWith(RENTCAR_TILE);
const TILES_TERMINAL = tilesWith(CRUISE_TILE);

/**
 * W008 세계자연유산본부 — no longer W007's grid. The 2026-09 redesign (Figma
 * 6792:126444) dropped 숙박안내 / 크루즈 운항 / 지역화폐 and put three venue-own
 * tiles in their cells: 제주세계유산 (row 1), 거문오름 예약 (row 2 — the slot the
 * per-venue tile used to fill), 제주세계유산센터 (row 3, sliding 탐나오 to the
 * last cell). Written out in full because the venue now differs in FOUR slots,
 * which is past what tilesWith's single venue parameter can say.
 *
 * The frame's own tile subtitles are stale placeholders (면세혜택 under eleven of
 * twelve tiles), so the three new subs here are authored, not transcribed. All
 * three icons are the designer's exports with the plate baked in (same pattern as
 * every other tile-*.png). None of the three has a CMS `buttons` row or a
 * MainButton_* sheet key yet — until those land, clicks log label-only (see
 * buttonCatalog's W008 note) and the grid keeps this authored order.
 *
 * heritage opens JejuHeritage (제주 유네스코 유산, 6908:51916) and geomun opens
 * JejuGeomun (6935:69555); heritage_center still falls through to the
 * JejuScreen scaffold in JejuKiosk until its frame lands.
 */
const TILES_HERITAGE: Tile[] = [
  { screen: 'eat',      label: "'제주'뭐먹지",   sub: '맛집 추천',        icon: 'tile-eat'      },
  { screen: 'shop',     label: "'제주'뭐사지",   sub: '쇼핑 추천',        icon: 'tile-shop'     },
  { screen: 'heritage', label: '제주세계유산',    sub: '유네스코 세계유산', icon: 'tile-heritage' },
  { screen: 'taxfree',  label: 'TAX-FREE',      sub: '면세혜택',         icon: 'tile-taxfree'  },
  { screen: 'about',    label: '여기는 제주도',   sub: '관광지 추천',      icon: 'tile-about'    },
  { screen: 'hello',    label: YUSAN_LABELS.hello, sub: YUSAN_LABELS.helloSub, icon: 'tile-hello' },
  { screen: 'help',     label: YUSAN_LABELS.help, sub: '편의시설 안내',    icon: 'tile-help'     },
  { screen: 'geomun',   label: '거문오름 예약',   sub: '탐방 예약',        icon: 'tile-geomun'   },
  { screen: 'exchange', label: '환율',           sub: '환율계산기',       icon: 'tile-exchange' },
  { screen: 'donation', label: '기부',           sub: '교복 기부',        icon: 'tile-donation' },
  { screen: 'heritage_center', label: '제주세계유산센터', sub: '센터 안내', icon: 'tile-heritage-center' },
  TAMNAO_TILE,
];

/**
 * Which grid a 제주 kiosk draws, by kiosk id.
 *
 * Keyed by KIOSK, not by layout: W006 and W007 deliberately share the
 * JEJU_AIRPORT layout (one 제주 design, two venues — see KioskLayoutId), so the
 * layout cannot tell them apart and this is the level the difference lives at.
 * A kiosk with no entry gets the airport grid.
 */
const TILES_BY_KIOSK: Partial<Record<string, Tile[]>> = { W007: TILES_TERMINAL, W008: TILES_HERITAGE };

/** Join a home tile to its CMS button row by screen key (see useOrderedTiles). */
const jejuTileKey = (tile: Tile): TileKey => ({ screen: tile.screen });

/** 300-wide tile + 180 gap across, 412-tall tile + 80 gap down. */
const COL_STEP = 480;
const ROW_STEP = 492;
/* Low-reach reflows the grid to 6 columns × 2 rows of 230px tiles: columns step
   by 312.4 ((1792 − 230) / 5), rows by 374 (Figma 6442:105429, 2026-08 rev). */
const COL_STEP_LOW = 312.4;
const ROW_STEP_LOW = 374;
const COLS = 4;
const COLS_LOW = 6;

/** Search row geometry (mirrors .searchRow/.searchRowLow in the CSS) — the
 *  inline keyboard tray is positioned from it, so the two can't drift apart. */
const SEARCH_ROW_TOP = 1136;
const SEARCH_ROW_TOP_LOW = 2024;
const SEARCH_ROW_HEIGHT = 182;

interface CardDef {
  screen: KioskScreenId;
  label: string;
  sub: string;
  icon: string;
  /** Key into the per-card position/colour rules in JejuHome.module.css. */
  variant: 'cardAi' | 'cardMarket' | 'cardEvents';
}

const CARDS: CardDef[] = [
  { screen: 'ai_search', label: "'제주' 뭐하지", sub: 'AI 검색하기', icon: 'card-ai',     variant: 'cardAi'     },
  { screen: 'market',    label: '위드마켓',      sub: '굿즈 만들기', icon: 'card-market', variant: 'cardMarket' },
  { screen: 'events',    label: '제주도 이벤트',  sub: '제주행사',    icon: 'card-events', variant: 'cardEvents' },
];

export function JejuHome({ controller }: Props): JSX.Element {
  const weather = useWeatherStore((s) => s.weather);
  const forecast = useWeatherStore((s) => s.forecast);
  const [weatherOpen, setWeatherOpen] = useState(false);
  /* The controller's own idle reset early-returns while the kiosk is already on
     home, so it would never take this overlay down — it would still be open for
     the next visitor. Armed only while the panel is up, on the same clock. */
  useInactivityReset({
    enabled: weatherOpen,
    timeoutMs: IDLE_TIMEOUT_MS,
    onIdle: () => setWeatherOpen(false),
  });
  const playWeatherVideo = useWeatherVideo();
  const lang = useLanguageStore((s) => s.currentLanguage);
  const setStoreQuery = useSearchStore((s) => s.setQuery);
  /** Hands the 제주 tab to the outfit picker — see `openJejuOutfits`. */
  const setInitialCategory = usePhotoStore((s) => s.setInitialCategory);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const clock = useMemo(() => formatDateTime(now), [now]);

  // Inline search keyboard — the field never navigates on tap, only on Enter.
  const composer = useRef(new HangulComposer());
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  function applyKey(action: KeyAction): void {
    const c = composer.current;
    switch (action.type) {
      case 'jamo':      c.inputJamo(action.value);    break;
      case 'literal':   c.inputLiteral(action.value); break;
      case 'space':     c.inputLiteral(' ');          break;
      case 'backspace': c.backspace();                break;
      case 'enter':
        setStoreQuery(c.value.trim());
        setSearching(false);
        controller.navigate('search', '검색');
        return;
    }
    setQuery(c.value);
  }

  /** Always navigate through the controller — that is what resolves the DB
   *  button id and fires the click/menu-touch analytics. Never trackEvent here. */
  function go(screen: KioskScreenId, label: string): void {
    controller.navigate(screen, label);
  }

  /**
   * JEJU ISLAND → the AR 한복체험 outfit picker, opened on the 제주 tab.
   *
   * NOT `go()`: the picker is a step INSIDE the photo workflow (PhotoWorkflow →
   * JejuHanbokSelect), not a screen `navigate()` can address, so it opens the
   * same way 사진촬영 does. `startPhoto` files its own analytics.
   *
   * The tab is handed over through photoStore, which the picker reads once its
   * row has arrived from the API and then clears — the same relay 이벤트 참여
   * uses to land on 프로모션 (InsadongKdrama). It is the registered CODE, not
   * the 제주 label: the label is the operator's Korean display name, editable
   * in the admin web and absent in the other seven languages.
   *
   * Without it the picker opens on whatever tab leads the row, which is 제주
   * only while 제주 has outfits — an empty catalogue sorts it LAST and the
   * button would quietly land on 한복.
   */
  const openJejuOutfits = (): void => {
    setInitialCategory(JEJU_OUTFIT_CATEGORY);
    controller.startPhoto();
  };

  const weatherIcon = weather
    ? weatherIconUrl(weatherIconName(weather.icon, weather.main))
    : jejuIconUrl('weather-sun');

  const donationPending = DONATION_COMING_SOON;
  /**
   * Resolve one of the two tile lines: the sheet's value, else the authored one.
   *
   * A map entry may list SEVERAL keys — the sheet has spelled the subtitle rows
   * two different ways (see TILE_SUB_KEYS) — and the first that resolves wins.
   * Only ONE is ever present in a given table, so the order is a spelling
   * fallback rather than a precedence rule, the same shape i18n's TITLE_KEYS uses
   * for the same reason.
   */
  const fromSheet = (
    map: Partial<Record<string, string | readonly string[]>>,
    screen: string,
    authored: string,
    resolve: (key: string, lang: Lang) => string = t,
  ): string => {
    const spec = map[screen];
    if (!spec) return authored;
    for (const key of typeof spec === 'string' ? [spec] : spec) {
      // `t()` answers the sheet's Korean for a language it has no cell for, and
      // the key itself when the row is gone entirely — the latter is what the
      // fallback is for. Some rows are authored blank, so guard '' too.
      const value = resolve(key, lang);
      if (value && value !== key) return value;
    }
    return authored;
  };
  /** Display label: the sheet's when the tile has a key, else the authored one. */
  const labelFor = (screen: string, authored: string): string =>
    fromSheet(TILE_LABEL_KEYS, screen, authored);
  /* `tPlain` for the second line: several Localization rows are authored as
     bullet lines ("* …") and that marker is spreadsheet formatting, not copy —
     rendering it under a tile title shows a stray glyph whose shape changes with
     the language. Titles keep `t()`; none of them carry a marker. */
  const subFor = (screen: string, authored: string): string =>
    fromSheet(TILE_SUB_KEYS, screen, authored, tPlain);
  const tileLabel = (tile: Tile): string => {
    const base = labelFor(tile.screen, tile.label);
    return tile.screen === 'donation' && donationPending ? withComingSoon(base, lang) : base;
  };
  const noticeRuns = parseNotice(noticeText(lang));
  const noticeBody = noticeRuns.map((run, i) =>
    run.bold ? <b key={i}>{run.text}</b> : <span key={i}>{run.text}</span>,
  );

  /**
   * Grid order from the buttons CMS (`/api/kiosks/{6,7}/buttons`), falling back to
   * the authored order when the layout is not cached or any tile fails to match.
   *
   * Both venues' 12 seeded rows agree with their Figma today — lines 5/6/7 are
   * 뭐먹지·뭐사지·숙박·TAX-FREE / 여기는·안녕·도와줘·(렌트카|크루즈 운항) /
   * 환율·기부·탐나오·지역화폐 — so this changes nothing on screen right now. It is
   * wired so a CMS reorder moves the grid without a release, which is how the
   * other kiosks behave.
   */
  const tiles = TILES_BY_KIOSK[controller.kioskId] ?? TILES_AIRPORT;
  const orderedTiles = useOrderedTiles(controller.kioskId, tiles, jejuTileKey);

  /* Low-reach: the shared mode bar (lowReach.ts) + a 573px 한복 promo flush
     under it, then the frame's own coordinates — see the block at the foot of
     JejuHome.module.css. */
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const toggleLowReach = useAccessibilityStore((s) => s.toggleLowReach);
  /* Params are optional because CSS Module lookups are typed `string | undefined`. */
  const low = (base?: string, alt?: string): string => `${base ?? ''} ${lowReach ? alt ?? '' : ''}`;
  const cols = lowReach ? COLS_LOW : COLS;
  const colStep = lowReach ? COL_STEP_LOW : COL_STEP;
  const rowStep = lowReach ? ROW_STEP_LOW : ROW_STEP;
  /* The ♿ toggle swaps to its orange active render while low-reach is on
     (Figma image 503); fall back to the idle art until the asset lands. */
  const accessibilityIcon =
    (lowReach ? jejuIconUrl('ico-accessibility-on') : undefined) ?? jejuIconUrl('ico-accessibility');

  /**
   * ── Other languages ─────────────────────────────────────────────────────
   * Korean is laid out exactly as the frame draws it. Every other language runs
   * longer — this month's notice is 118 characters in Korean and 213 in Russian —
   * and three blocks here have nowhere to grow: the notice sits in a fixed band
   * above the 운항 정보 board, the feature cards are 310 tall, and a tile's text
   * has only the gap above the next row's plate. So in `wide` mode each block's
   * text WRAPS through the whole band it has (see the "Other languages" notes at
   * the foot of the CSS), and only copy that still outgrows it is scaled down —
   * by one factor per block, so the twelve tiles (and the three cards) keep one
   * text size as a set. Nothing is clamped. See fitText.ts.
   */
  const wide = lang !== 'ko';
  const noticeRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  /* Everything the three fits depend on — re-fit when any of it changes. */
  const fitKey = [
    lang,
    lowReach,
    noticeRuns.map((r) => r.text).join(''),
    CARDS.map((c) => labelFor(c.screen, c.label) + subFor(c.screen, c.sub)).join('|'),
    orderedTiles.map((tile) => tileLabel(tile) + subFor(tile.screen, tile.sub)).join('|'),
  ].join('§');
  useFitText(noticeRef, styles.noticeLead, wide, 0.7, fitKey);
  useFitText(cardsRef, styles.cardText, wide, 0.75, fitKey);
  useFitText(gridRef, styles.tileText, wide, 0.7, fitKey);

  return (
    /* --jeju-mode-bar sizes the ♿ bar and places the 한복 hero flush under it;
       one value shared with every sub-page frame (see lowReach.ts). */
    <div className={styles.root} style={modeBarVars}>
      {jejuIconUrl('bg') && (
        <img src={jejuIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      {lowReach && (
        <div className={styles.modeBar}>{homeText('BarrierFree_Title', lang)}</div>
      )}
      {lowReach && jejuIconUrl('banner-page') && (
        <div className={styles.hero}>
          <img src={jejuIconUrl('banner-page')} alt="" className={styles.heroImg} draggable={false} />
        </div>
      )}

      {/* ── Top bar ── */}
      <div className={low(styles.topBar, styles.topBarLow)}>
        <div className={styles.topLeft}>
          {jejuIconUrl('ico-location') && (
            <img src={jejuIconUrl('ico-location')} alt="" className={styles.locationIcon} draggable={false} />
          )}
          <span className={styles.siteName}>JEJUDO ISLAND</span>
        </div>
        <span className={styles.dateTime}>{clock}</span>
      </div>

      {/* ── 공지 card + weather ── */}
      <div className={low(styles.notice, styles.noticeLow)}>
        {wide ? (
          /* Non-Korean: the frame's 1060 width (Figma 7058:22669) in the taller
             band the panel really has, ending 60 above the board; the rule
             follows the text's own height; type scales down only for copy that
             still outgrows the band. Never clamped — see .noticeLeadWide. */
          <div className={`${styles.noticeLead} ${styles.noticeLeadWide}`} ref={noticeRef}>
            <div className={styles.noticeRow}>
              <div className={styles.noticeRule} />
              <p className={`${styles.noticeText} ${styles.noticeTextWide}`}>{noticeBody}</p>
            </div>
          </div>
        ) : (
          <div className={styles.noticeLead}>
            <div className={styles.noticeRule} />
            <p className={styles.noticeText}>{noticeBody}</p>
          </div>
        )}

        {/* Tapping the weather opens the 날씨 panel (Figma 6516:74521) on this
            screen AND plays today's condition clip on the customer display
            (Weather_Rain/Cold/Sunny) — the clip is the behaviour the other
            kiosks have always had, and it runs on the second monitor, so the
            panel does not displace it. */}
        <div
          className={styles.weather}
          role="button"
          aria-label="제주 날씨"
          aria-expanded={weatherOpen}
          onClick={() => {
            playWeatherVideo();
            setWeatherOpen((open) => !open);
          }}
        >
          <span className={styles.weatherTemp}>
            {weather ? `${Math.round(weather.tempC)}˚` : '--˚'}
          </span>
          {weatherIcon && (
            <img src={weatherIcon} alt="" className={styles.weatherIcon} draggable={false} />
          )}
        </div>
      </div>

      {/* ── 운항 정보 board — W006 flights, W007 ferry sailings ── */}
      {controller.kioskId === 'W007' ? (
        <JejuSailingBoard controller={controller} lang={lang} />
      ) : (
        <JejuFlightBoard controller={controller} lang={lang} />
      )}

      {/* ── Search row ── */}
      <div className={low(styles.searchRow, styles.searchRowLow)}>
        <button
          type="button"
          className={styles.searchHome}
          onClick={() => go('home', '홈')}
          aria-label="홈"
        >
          {jejuIconUrl('ico-home-search') && (
            <img src={jejuIconUrl('ico-home-search')} alt="" className={styles.searchHomeImg} draggable={false} />
          )}
        </button>

        <div className={low(styles.searchField, styles.searchFieldLow)} onClick={() => setSearching(true)} role="button">
          <span className={`${styles.searchText} ${query ? styles.searchValue : styles.searchPlaceholder}`}>
            {query || homeText('Main_Search', lang)}
            {searching && <span className={styles.searchCaret} />}
          </span>
          {jejuIconUrl('ico-search') && (
            <img src={jejuIconUrl('ico-search')} alt="" className={styles.searchIcon} draggable={false} />
          )}
        </div>

        <button
          type="button"
          className={low(styles.langBtn, styles.langBtnLow)}
          onClick={() => go('language', '언어선택')}
          aria-label="언어선택"
        >
          {LANG_CODE[lang] ?? 'KR'}
        </button>
      </div>

      {/* ── Three feature cards ── */}
      <div className={low(styles.cards, styles.cardsLow)} ref={cardsRef}>
        {CARDS.map((card) => {
          const title = <span className={styles.cardTitle}>{labelFor(card.screen, card.label)}</span>;
          const sub = <span className={styles.cardSub}>{subFor(card.screen, card.sub)}</span>;
          return (
            <button
              key={card.screen}
              type="button"
              className={`${styles.card} ${styles[card.variant]}`}
              onClick={() => go(card.screen, card.label)}
            >
              {/* Non-Korean: title and subtitle as ONE column centred in the
                  card (7058:22669, "크기 넘으면 단 내리기"), so a title that
                  wraps pushes its subtitle down instead of running past the art
                  or out of the card — see .cardText. Korean keeps the frame's
                  two pinned lines. */}
              {wide ? (
                <span className={styles.cardText}>
                  {title}
                  {sub}
                </span>
              ) : (
                <>
                  {title}
                  {sub}
                </>
              )}
              {jejuIconUrl(card.icon) && (
                <img src={jejuIconUrl(card.icon)} alt="" className={styles.cardArt} draggable={false} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Menu grid ── */}
      <div className={low(styles.panel, styles.panelLow)} />
      <div className={low(styles.grid, styles.gridLow)} ref={gridRef}>
        {orderedTiles.map((tile, i) => {
          const art = jejuIconUrl(tile.icon);
          const disabled = tile.screen === 'donation' && donationPending;
          return (
            <button
              key={tile.screen}
              type="button"
              className={[styles.tile, lowReach ? styles.tileLow : '', disabled ? styles.tileDisabled : '']
                .filter(Boolean)
                .join(' ')}
              style={{ left: (i % cols) * colStep, top: Math.floor(i / cols) * rowStep }}
              onClick={disabled ? undefined : () => go(tile.screen, tile.label)}
              disabled={disabled}
            >
              {art ? (
                <>
                  {tile.plate && (
                    <span className={low(styles.tilePlate, styles.tilePlateLow)} style={{ background: tile.plate }} />
                  )}
                  <img src={art} alt="" className={low(styles.tileArt, styles.tileArtLow)} draggable={false} />
                </>
              ) : (
                <span className={styles.tileArtMissing}>{tile.label[0]}</span>
              )}
              {/* Non-Korean: the text box spans the whole gap above the next
                  row, and the grid's type is fitted to it — see .tileTextFit. */}
              <span className={`${low(styles.tileText, styles.tileTextLow)} ${wide ? styles.tileTextFit : ''}`}>
                <span className={styles.tileTitle}>
                  {/* Low-reach only: at 300px the pair still fits one line, so the
                     full label stays on the standard grid. */}
                  {lowReach ? <CyclingTileTitle label={tileLabel(tile)} /> : tileLabel(tile)}
                </span>
                <span className={styles.tileSub}>{subFor(tile.screen, tile.sub)}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Bottom actions — low-reach shifts +79 (Figma 6442:105429) ── */}
      {/* JEJU ISLAND — replaces the K-DRAMA button, which sat here permanently
          disabled because the screen behind it was never built. Opens the AR
          한복체험 picker on the 제주 tab (see `openJejuOutfits`). */}
      <button
        type="button"
        className={low(styles.arJeju, styles.arJejuLow)}
        onClick={openJejuOutfits}
        aria-label="JEJU ISLAND"
      >
        {jejuIconUrl('btn-jeju-island') && (
          <img
            src={jejuIconUrl('btn-jeju-island')}
            alt=""
            className={styles.actionImg}
            draggable={false}
          />
        )}
      </button>
      {/* Not localized, and not a sheet key: JEJU ISLAND is a Latin wordmark
          that reads the same in all eight languages — the same treatment the
          header's own JEJUDO ISLAND lockup gets, and what K-DRAMA had here.
          화장실 next door DOES come from the sheet, because it is a word. */}
      <span className={low(`${styles.actionLabel} ${styles.labelArJeju}`, styles.actionLabelLow)}>
        JEJU ISLAND
      </span>

      <button
        type="button"
        className={low(styles.camera, styles.cameraLow)}
        onClick={() => controller.startPhoto()}
        aria-label="사진촬영"
      >
        {jejuIconUrl('btn-camera') && (
          <img src={jejuIconUrl('btn-camera')} alt="" className={styles.actionImg} draggable={false} />
        )}
      </button>

      <button
        type="button"
        className={low(styles.restroom, styles.restroomLow)}
        onClick={() => go('restroom', '화장실')}
        aria-label="화장실"
      >
        {jejuIconUrl('ico-restroom') && (
          <img src={jejuIconUrl('ico-restroom')} alt="" className={styles.actionImg} draggable={false} />
        )}
      </button>
      {/* MainButton_WC is fully translated in Localization_Jeju (8/8 langs);
          this label was the one home-screen string still hardcoded Korean.
          `navigate()` above keeps receiving the Korean '화장실' — that string is
          the analytics label and the buttons-table join, like every tile. */}
      <span className={low(`${styles.actionLabel} ${styles.labelRestroom}`, styles.actionLabelLow)}>
        {t('MainButton_WC', lang)}
      </span>

      {/* ── Left nav (home + back + ♿) — Figma 6442:105429 at y2163 / y2403 ── */}
      <div className={low(styles.leftNav, styles.leftNavLow)}>
        {jejuIconUrl('nav-left') && (
          <img src={jejuIconUrl('nav-left')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button
          type="button"
          className={`${styles.leftNavZone} ${styles.leftNavHome}`}
          onClick={() => go('home', '홈')}
          aria-label="홈"
        />
        <button
          type="button"
          className={`${styles.leftNavZone} ${styles.leftNavBack}`}
          onClick={() => go('home', '뒤로')}
          aria-label="뒤로"
        />
      </div>
      {accessibilityIcon && (
        <button
          type="button"
          className={low(styles.accessibility, styles.accessibilityLow)}
          onClick={toggleLowReach}
          aria-label="저상 화면"
          aria-pressed={lowReach}
        >
          <img
            src={accessibilityIcon}
            alt=""
            className={styles.accessibilityImg}
            draggable={false}
          />
        </button>
      )}

      {/* 날씨 panel — the weather card's overlay. Its layer is z-index 20, over
          the whole (unlayered) home screen; the keyboard below is 2000, so it
          still opens on top. */}
      {weatherOpen && (
        <JejuWeatherPanel
          forecast={forecast}
          lang={lang}
          onClose={() => setWeatherOpen(false)}
        />
      )}

      {/* Inline search keyboard — shows in place, no navigation until Enter.
          `top` must track the search row (1136 + 182 = 1318, or 2024 + 182 in
          low-reach) so the tray opens flush UNDER it; the shared default of 900
          is Insadong's position and would put it above Jeju's search bar. */}
      <FloatingKeyboard
        open={searching}
        onKey={applyKey}
        onClose={() => setSearching(false)}
        lang={lang}
        top={(lowReach ? SEARCH_ROW_TOP_LOW : SEARCH_ROW_TOP) + SEARCH_ROW_HEIGHT}
      />
    </div>
  );
}
