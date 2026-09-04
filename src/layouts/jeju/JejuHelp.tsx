/**
 * 도와줘 '하영' — Figma node 6219:98767 (제주>도와줘 하영-01=공항).
 *
 * The 제주공항 facility finder: pick a terminal, a floor and a category, and the
 * matching airport map is shown. Unlike the other layouts' 도와줘 screens
 * (InsadongHelp/OsanHelp/HwaseongHelp), which list shops from the witteria API,
 * this one is a map browser — 제주's frame draws no list at all.
 *
 * Every chip shares one screen and one floor plan; only the DATA differs. The
 * terminal and floor pick the plan, and the category chip decides which of that
 * plan's pictograms get a marker and become tappable — it does not swap the map.
 *
 * ── The plans (2026-08-31) ──────────────────────────────────────────────────
 * The single placeholder plan this screen shipped with is gone; the six real
 * 한국공항공사 floor plans are in, each in the two scripts they were supplied in:
 *
 *   국내선  1F · 2F · 3F · 4F     국제선  1F · 3F
 *
 * `src` is the Korean plan and `srcEn` the Latin one, and the Latin one serves
 * EVERY non-Korean language — the plans exist in Korean and English only, and
 * English is the closer read for a 日本語/中文/Tiếng Việt visitor than Hangul is.
 * 국내선 4F carries no lettering at all, so it has no `srcEn` and serves both.
 *
 * 국제선 has no 2층 plan — 한국공항공사 supplied no 국외 2F drawing, and the sheet
 * files no facility there either — so that storey is not offered at all: the
 * floor row is 1F ㅣ 3F, with a gap where 2F would be. The 3층 plan keeps its own
 * number rather than sliding down into the gap; see FLOORS for why that matters.
 *
 * If a 국외 2F plan ever arrives, `map-international-2f{,-en}.png` plus one MAPS
 * entry, one PINS block and one FLOORS row puts the storey back.
 *
 * The plans are far wider than they are tall (2.03:1 to 3.08:1; 국내선 4F alone
 * is upright at 1.25:1), and they were supplied on canvases with a great deal of
 * blank paper around the drawing — 국제선 1F, the plan this screen opens on, was
 * using 47% of its own canvas. They are therefore re-cut to their ink before
 * import (the ko and en of a pair share ONE crop box, so their coordinates stay
 * interchangeable), which is what makes them read at size inside the frame's own
 * 1820-wide slot. The slot keeps that width and only moves up the page; see
 * .map.
 *
 * The map is also this screen's only way OUT to 상세 (6219:99127): each map
 * declares the facilities drawn on it, and tapping one opens the shared detail
 * card. That frame is what makes the pins necessary — it is the 도와줘 flow's own
 * detail and nothing else on this page could reach it.
 *
 * ── W007 draws ITS OWN building (2026-09-03) ────────────────────────────────
 * 제주국제여객터미널 runs this same page (one JEJU_AIRPORT layout — see
 * kioskLocations), and until now it showed the AIRPORT's floor plans to visitors
 * standing in the FERRY terminal. It now has its own pair of plans, supplied
 * ko+en like the airport's: the 대합실 (매표소·개찰구·상가) and the 출국장 — the
 * zone the hall plan itself greys out as 통제구역, drawn on the same building
 * outline. They are two ZONES of one storey, not two storeys: the plans carry no
 * floor lettering at all and no 층 is claimed for them, so the terminal venue
 * shows the zone pair on the top pill row and drops the floor row entirely —
 * the same honesty rule as 국제선's missing 2F, applied to a building whose
 * floor numbers we do not know.
 *
 * AirportFacilityData_Jeju has NO 여객터미널 rows, so every terminal pin is a
 * map-only card (chip title + venue line) — exactly what an unpaired airport
 * pictogram already opens. The day the sheet grows terminal rows, the pairing
 * machinery below picks them up; the pins are already swept.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { getKioskLocation } from '@shared/config/kioskLocations';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useDetailStore } from '@renderer/store/detailStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useShopStore } from '@renderer/store/shopStore';
import { pick, type Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { pickText } from '@renderer/data/types';
import {
  assignFacilities,
  chipLabel,
  facilityImageUrl,
  HELP_CHIPS,
  type AirportFacility,
  type AssignedPin,
} from '@renderer/lib/airportFacilities';
import {
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopsForBase,
} from '@renderer/lib/shops';
import { trackEvent } from '@renderer/lib/analytics';
import { jejuMascot } from './jejuMascot';
import { JejuPageFrame } from './JejuPageFrame';
import { JejuSubTabRow } from './JejuSubTabRow';
import styles from './JejuHelp.module.css';

import mapDomestic1f from '@renderer/assets/photos/jeju/help/map-domestic-1f.png';
import mapDomestic1fEn from '@renderer/assets/photos/jeju/help/map-domestic-1f-en.png';
import mapDomestic2f from '@renderer/assets/photos/jeju/help/map-domestic-2f.png';
import mapDomestic2fEn from '@renderer/assets/photos/jeju/help/map-domestic-2f-en.png';
import mapDomestic3f from '@renderer/assets/photos/jeju/help/map-domestic-3f.png';
import mapDomestic3fEn from '@renderer/assets/photos/jeju/help/map-domestic-3f-en.png';
import mapDomestic4f from '@renderer/assets/photos/jeju/help/map-domestic-4f.png';
import mapInternational1f from '@renderer/assets/photos/jeju/help/map-international-1f.png';
import mapInternational1fEn from '@renderer/assets/photos/jeju/help/map-international-1f-en.png';
import mapInternational3f from '@renderer/assets/photos/jeju/help/map-international-3f.png';
import mapInternational3fEn from '@renderer/assets/photos/jeju/help/map-international-3f-en.png';
import mapTerminalHall from '@renderer/assets/photos/jeju/help/map-terminal-hall.png';
import mapTerminalHallEn from '@renderer/assets/photos/jeju/help/map-terminal-hall-en.png';
import mapTerminalDeparture from '@renderer/assets/photos/jeju/help/map-terminal-departure.png';
import mapTerminalDepartureEn from '@renderer/assets/photos/jeju/help/map-terminal-departure-en.png';

type TerminalId = 'international' | 'domestic';
type FloorId = '1F' | '2F' | '3F' | '4F';

/** Terminal pills in frame order (6219:98779 / 98783). Sheet: Help_International / Help_Domestic. */
const TERMINALS = [
  {
    id: 'international',
    sheetKey: 'Help_International',
    label: {
      ko: '국제선',
      en: 'International',
      ja: '国際線',
      zh: '国际线',
      vi: 'Chuyến bay quốc tế',
      th: 'เที่ยวบินระหว่างประเทศ',
      ru: 'Международные рейсы',
      id: 'Penerbangan Internasional',
    },
  },
  {
    id: 'domestic',
    sheetKey: 'Help_Domestic',
    label: {
      ko: '국내선',
      en: 'Domestic',
      ja: '国内線',
      zh: '国内线',
      vi: 'Chuyến bay nội địa',
      th: 'เที่ยวบินในประเทศ',
      ru: 'Внутренние рейсы',
      id: 'Penerbangan Domestik',
    },
  },
] as const satisfies ReadonlyArray<{
  id: TerminalId;
  sheetKey: string;
  label: Record<string, string>;
}>;

const terminalLabel = (t: (typeof TERMINALS)[number], lang: Lang): string =>
  sheetText(t.sheetKey, lang, t.label);

/**
 * The floors each terminal offers. 국내선 runs 1–4F and 국제선 is 1F and 3F, so
 * the two rows differ and the frame's fixed 1F ㅣ 2F ㅣ 3F stands for neither.
 *
 * ── 국제선 skips 2F; it does not rename 3F (2026-09-03) ─────────────────────
 * The terminal's passenger levels are the building's 1층 and 3층 — arrivals
 * below, departures above. There is nothing on 2층 a visitor is sent to,
 * 한국공항공사 supplied no 국외 2F drawing, and the sheet files no facility on that
 * storey, so the chip for it is simply gone. The row reads 1F ㅣ 3F.
 *
 * It briefly read 1F ㅣ 2F, with the 3층 plan relabelled as the terminal's second
 * floor. That was WRONG and is reverted: the number on the chip has to be the
 * number on the building. The plan's own lettering says 3층/3F, the sheet's zone
 * column says "3F 면세", and every sign a visitor looks up at in 제주공항 says 3층
 * — a chip reading 2F contradicted all three and would have sent someone up one
 * flight short. A gap in the row is honest about a floor that has nothing on it;
 * a renumbered floor is not.
 *
 * So `label` matches `id` everywhere again, and the split between them is unused
 * — kept only because JejuSubTabRow's shape has it.
 */
const FLOORS: Record<TerminalId, ReadonlyArray<{ id: FloorId; label: string }>> = {
  domestic: [
    { id: '1F', label: '1F' },
    { id: '2F', label: '2F' },
    { id: '3F', label: '3F' },
    { id: '4F', label: '4F' },
  ],
  // No 2F: the storey exists in the building but holds nothing this screen can
  // show — no plan, no facility rows. See above.
  international: [
    { id: '1F', label: '1F' },
    { id: '3F', label: '3F' },
  ],
};

/**
 * Category chips, five per row.
 *
 * ★ ENTIRELY THE SHEET'S, since 2026-09-02: every chip is a BaseCategory value
 * of AirportFacilityData_Jeju, so the sheet decides what a chip is, what it is
 * called in eight languages, and what order they come in. Nothing is listed in
 * code. The five pictogram-only chips this row used to carry (화장실, 흡연실,
 * 유아휴게실, 교통약자 편의시설, 유실물센터) are gone with the hard-coded list —
 * see lib/airportFacilities for what that costs the pins below.
 *
 * Ten chips is two rows, which is what Figma drew (6219:98787); the third row
 * the fifteen needed is gone again, so the map goes back up 205 to its 1620.
 * That number follows CATEGORIES.length and is NOT fixed — an eleventh category
 * in the sheet makes three rows again and .map has to move back down. See the
 * note on .cats in the CSS.
 */
const CATEGORIES = HELP_CHIPS;
const PER_ROW = 5;
const CATEGORY_ROWS = Math.ceil(CATEGORIES.length / PER_ROW);

/**
 * Chip caption for the 340×170 plates (Figma 6393:59030 / I6771:66722).
 *
 * Sheet categories use the wide ideographic `・`; Figma draws the thin `·`.
 * Soft-break after each separator so a long label (금융·보험·환전, or any
 * translation) wraps at a natural cut inside the plate instead of stretching
 * the pill past 340px.
 */
function chipLine(chip: string, lang: Lang): string {
  return chipLabel(chip, lang)
    .replace(/\s*\n\s*/g, '·')
    .replace(/[・･]/g, '·')
    .replace(/·/g, '·\u200b');
}

/**
 * One tappable facility on a map.
 *
 * The pictogram itself is PAINTED INTO the plan — this is only the marker that
 * points at it and the hotspot that opens it. `x`/`y` are the pictogram's centre
 * as a FRACTION of the plan (0–1), not pixels: the six plans run from 1.32:1 to
 * 3.08:1 and are fitted into one slot, so each is drawn at its own scale and a
 * pixel coordinate would mean a different place on every one of them. Read a
 * fraction straight off the artwork — `x = px / imageWidth`.
 *
 * `label` overrides what the 상세 card is titled; it defaults to whatever named
 * the pin — the sheet row it was paired with, or failing that its own chip.
 *
 * `shop` is the ONE hand-identification this file supports: give it a row's
 * `ShopName_Kr` and the pin binds to THAT row by name instead of taking its turn
 * in the sheet-order pairing (see lib/airportFacilities). Nothing sets it today
 * — the pins were swept off the artwork as pictograms and the plans do not name
 * them — but every pin someone can identify against a plan is one fewer left to
 * the ordering, and adding one needs no other change.
 */
interface FacilityPin {
  x: number;
  y: number;
  /** Which category chip drops a marker on this pictogram. */
  category: string;
  /**
   * Where this pictogram sits on the LATIN plan, when the two scripts disagree.
   *
   * The pair is one drawing set twice, and almost every icon lands identically —
   * but re-setting a label occasionally nudged a neighbour. Every pin is checked
   * against BOTH plans; this is the only one that moved, the 커피잔 by 출발장 입구
   * on 국제선 3F, which sits 55px higher once that label becomes `Departure`.
   */
  en?: { x: number; y: number };
  label?: string;
  shop?: string;
}

/**
 * The plan each terminal/floor is drawn with, keyed `<terminal>-<floor>`.
 *
 * ★ NOT keyed by category. One floor plan serves every chip: the plan draws all
 * of its facilities at once, and picking a chip only decides which of its
 * pictograms get a marker (see PINS). Keying the map by category would mean a
 * separate PNG per chip.
 *
 * `here` is where the kiosk itself stands ON THAT MAP, in the same 0–1 fractions
 * PINS uses. It travels with the map rather than living in the CSS because it is
 * a property of the drawing: a different floor plan puts it somewhere else.
 *
 * NO map carries `here` today. The 현위치 marker the old placeholder plan had was
 * positioned against THAT artwork, and the real plans are different drawings of
 * a different building — the marker's coordinate did not survive them, and where
 * in 제주공항 the kiosk physically stands is not something the plans say. A pin
 * at a guessed position is worse than no pin, so it is left off until someone
 * who can see the machine supplies the floor and the fraction; the marker
 * renders again the moment one entry gets a `here`.
 */
interface AirportMap {
  /** The Korean plan. */
  src: string;
  /** The Latin-script plan, used for every non-Korean language. Omitted when
   *  the plan carries no lettering and so reads the same in any language. */
  srcEn?: string;
  here?: { x: number; y: number };
  /**
   * How large this plan draws its pictograms, relative to the ~38px the domestic
   * 1F/2F/3F plans put on screen.
   *
   * The plans are not drawn to one scale. Measured on screen at 1820 wide:
   * 국내선 1F 38px · 2F 36px · 3F 38px · 국제선 3F 35px — but 국제선 1F 60px,
   * 국내선 4F 103px and the 여객터미널 pair ~93px, because those cover much less
   * floor and so are drawn far larger.
   *
   * What it scales is only what the symbol's size genuinely dictates: the
   * marker's LIFT (a taller symbol needs the tip higher up to clear it) and the
   * tap target (which has to cover the symbol). The marker's own 37×56 box is
   * deliberately CONSTANT — it used to scale too, and on the large-pictogram
   * plans that drew a 54–94px pin that covered the map instead of pointing at
   * it. See .pinMarker in the CSS.
   */
  pinScale?: number;
}

const MAPS: Record<string, AirportMap> = {
  'domestic-1F': { src: mapDomestic1f, srcEn: mapDomestic1fEn },
  'domestic-2F': { src: mapDomestic2f, srcEn: mapDomestic2fEn },
  'domestic-3F': { src: mapDomestic3f, srcEn: mapDomestic3fEn },
  // No `srcEn`: 국내선 4F is the one plan with no lettering on it.
  'domestic-4F': { src: mapDomestic4f, pinScale: 2.75 },
  'international-1F': {
    src: mapInternational1f,
    srcEn: mapInternational1fEn,
    pinScale: 1.6,
  },
  'international-3F': { src: mapInternational3f, srcEn: mapInternational3fEn },
};

/**
 * Where each plan draws its facilities, keyed like MAPS.
 *
 * Read off the artwork by sweeping each plan for its pictograms — the coloured
 * plates by colour, the black glyphs as ink blobs — and then naming every one of
 * them against the chip list by hand. `x`/`y` are FRACTIONS of the plan (0-1),
 * not pixels, because the six plans have six different aspects; see FacilityPin.
 *
 * Only things a chip can ASK for are listed. The plans' wayfinding furniture —
 * 탑승구/GATE lettering, the aeroplanes, escalators, stairs, 보안검색대 and the
 * airline logos along the check-in rows — carries no category and stays as
 * drawn, because no chip selects it and a marker on it would only be clutter.
 *
 * 교통약자 편의시설 is the wheelchair-marked LIFTS only. Escalators and stairs are
 * on these plans too and are deliberately not included: they are exactly what a
 * visitor who needs this chip cannot use.
 *
 * 기타 is the chip's own catch-all and holds the real facilities with no chip of
 * their own — AED, 공중전화, 우체국, 경찰대, 의무실, 물품보관함, 렌터카 데스크,
 * 무인민원발급기, 수하물 수취대, 휴게의자.
 */
const PINS: Record<string, FacilityPin[]> = {
  // 화장실 3  ·  안내소 3  ·  식음료 6  ·  편의점 2  ·  은행·환전 4  ·  흡연실 1  ·  유아휴게실 1  ·  교통약자 편의시설 3  ·  기타 12
  'domestic-1F': [
    // 화장실
    { x: 0.1114, y: 0.3866, category: '화장실' },
    { x: 0.3232, y: 0.0828, category: '화장실' },
    { x: 0.8286, y: 0.2113, category: '화장실' },
    // 안내소
    { x: 0.0411, y: 0.6737, category: '안내소' },
    { x: 0.3657, y: 0.1698, category: '안내소' },
    { x: 0.8618, y: 0.2154, category: '안내소' },
    // 식음료
    { x: 0.1961, y: 0.2113, category: '식음료' },
    { x: 0.222, y: 0.1819, category: '식음료' },
    { x: 0.2405, y: 0.143, category: '식음료' },
    { x: 0.3019, y: 0.3827, category: '식음료' },
    { x: 0.7301, y: 0.3833, category: '식음료' },
    { x: 0.766, y: 0.2167, category: '식음료' },
    // 편의점
    { x: 0.2071, y: 0.6523, category: '편의점' },
    { x: 0.8186, y: 0.384, category: '편의점' },
    // 은행·환전
    { x: 0.0736, y: 0.5211, category: '은행·환전' },
    { x: 0.1564, y: 0.3257, category: '은행·환전' },
    { x: 0.1603, y: 0.8377, category: '은행·환전' },
    { x: 0.29, y: 0.0808, category: '은행·환전' },
    // 흡연실
    { x: 0.9806, y: 0.3137, category: '흡연실' },
    // 유아휴게실
    { x: 0.1721, y: 0.2501, category: '유아휴게실' },
    // 교통약자 편의시설
    { x: 0.0895, y: 0.4683, category: '교통약자\n편의시설' },
    { x: 0.3657, y: 0.0828, category: '교통약자\n편의시설' },
    { x: 0.7922, y: 0.2113, category: '교통약자\n편의시설' },
    // 기타
    { x: 0.1357, y: 0.2956, category: '기타' },
    { x: 0.1758, y: 0.7841, category: '기타' },
    { x: 0.2144, y: 0.4489, category: '기타' },
    { x: 0.3429, y: 0.3846, category: '기타' },
    { x: 0.3655, y: 0.3846, category: '기타' },
    { x: 0.3974, y: 0.3846, category: '기타' },
    { x: 0.4767, y: 0.1056, category: '기타' },
    { x: 0.529, y: 0.0441, category: '기타' },
    { x: 0.576, y: 0.3324, category: '기타' },
    { x: 0.5998, y: 0.3887, category: '기타' },
    { x: 0.7019, y: 0.1062, category: '기타' },
    { x: 0.7743, y: 0.4622, category: '기타' },
  ],
  // 화장실 5  ·  식음료 7  ·  편의점 7  ·  은행·환전 1  ·  유아휴게실 2  ·  교통약자 편의시설 2  ·  기타 5
  'domestic-2F': [
    // 화장실
    { x: 0.0662, y: 0.9103, category: '화장실' },
    { x: 0.2959, y: 0.3761, category: '화장실' },
    { x: 0.7448, y: 0.392, category: '화장실' },
    { x: 0.7448, y: 0.5898, category: '화장실' },
    { x: 0.9387, y: 0.601, category: '화장실' },
    // 식음료
    { x: 0.1302, y: 0.7517, category: '식음료' },
    { x: 0.2604, y: 0.5268, category: '식음료' },
    { x: 0.3005, y: 0.4782, category: '식음료' },
    { x: 0.6753, y: 0.392, category: '식음료' },
    { x: 0.8363, y: 0.7238, category: '식음료' },
    { x: 0.8849, y: 0.7229, category: '식음료' },
    { x: 0.8995, y: 0.4359, category: '식음료' },
    // 편의점
    { x: 0.2162, y: 0.5842, category: '편의점' },
    { x: 0.219, y: 0.2133, category: '편의점' },
    { x: 0.2374, y: 0.5547, category: '편의점' },
    { x: 0.2805, y: 0.5021, category: '편의점' },
    { x: 0.5176, y: 0.4901, category: '편의점' },
    { x: 0.7107, y: 0.3913, category: '편의점' },
    { x: 0.8148, y: 0.5587, category: '편의점' },
    // 은행·환전
    { x: 0.3923, y: 0.156, category: '은행·환전' },
    // 유아휴게실
    { x: 0.2223, y: 0.3218, category: '유아휴게실' },
    { x: 0.7857, y: 0.7238, category: '유아휴게실' },
    // 교통약자 편의시설
    { x: 0.192, y: 0.3218, category: '교통약자\n편의시설' },
    { x: 0.3923, y: 0.2246, category: '교통약자\n편의시설' },
    // 기타
    { x: 0.1448, y: 0.5132, category: '기타' },
    { x: 0.1538, y: 0.392, category: '기타' },
    { x: 0.367, y: 0.2221, category: '기타' },
    { x: 0.7206, y: 0.2333, category: '기타' },
    { x: 0.8464, y: 0.2324, category: '기타' },
  ],
  // 화장실 4  ·  안내소 1  ·  식음료 5  ·  편의점 2  ·  은행·환전 2  ·  유아휴게실 1  ·  교통약자 편의시설 3  ·  기타 9
  'domestic-3F': [
    // 화장실
    { x: 0.0709, y: 0.6881, category: '화장실' },
    { x: 0.3209, y: 0.1559, category: '화장실' },
    { x: 0.6635, y: 0.4932, category: '화장실' },
    { x: 0.8195, y: 0.3849, category: '화장실' },
    // 안내소
    { x: 0.3766, y: 0.4069, category: '안내소' },
    // 식음료
    { x: 0.0648, y: 0.2022, category: '식음료' },
    { x: 0.592, y: 0.5922, category: '식음료' },
    { x: 0.9124, y: 0.3156, category: '식음료' },
    { x: 0.9407, y: 0.1125, category: '식음료' },
    { x: 0.9739, y: 0.258, category: '식음료' },
    // 편의점
    { x: 0.8805, y: 0.203, category: '편의점' },
    { x: 0.8805, y: 0.3147, category: '편의점' },
    // 은행·환전
    { x: 0.2775, y: 0.1548, category: '은행·환전' },
    { x: 0.4255, y: 0.2834, category: '은행·환전' },
    // 유아휴게실
    { x: 0.0882, y: 0.5964, category: '유아휴게실' },
    // 교통약자 편의시설
    { x: 0.0538, y: 0.7797, category: '교통약자\n편의시설' },
    { x: 0.2604, y: 0.1559, category: '교통약자\n편의시설' },
    { x: 0.5618, y: 0.5931, category: '교통약자\n편의시설' },
    // 기타
    { x: 0.1613, y: 0.2885, category: '기타' },
    { x: 0.181, y: 0.434, category: '기타' },
    { x: 0.3299, y: 0.2513, category: '기타' },
    { x: 0.4343, y: 0.4306, category: '기타' },
    { x: 0.5918, y: 0.5161, category: '기타' },
    { x: 0.6635, y: 0.2927, category: '기타' },
    { x: 0.7717, y: 0.3173, category: '기타' },
    { x: 0.8154, y: 0.1582, category: '기타' },
    { x: 0.9761, y: 0.5677, category: '기타' },
  ],
  // 화장실 2  ·  식음료 7  ·  교통약자 편의시설 2  ·  기타 2
  'domestic-4F': [
    // 화장실
    { x: 0.3818, y: 0.3754, category: '화장실' },
    { x: 0.8306, y: 0.0715, category: '화장실' },
    // 식음료
    { x: 0.21, y: 0.6416, category: '식음료' },
    { x: 0.4114, y: 0.7937, category: '식음료' },
    { x: 0.5415, y: 0.5587, category: '식음료' },
    { x: 0.5543, y: 0.1779, category: '식음료' },
    { x: 0.676, y: 0.3762, category: '식음료' },
    { x: 0.7098, y: 0.0816, category: '식음료' },
    { x: 0.8688, y: 0.3217, category: '식음료' },
    // 교통약자 편의시설
    { x: 0.3189, y: 0.5064, category: '교통약자\n편의시설' },
    { x: 0.9401, y: 0.0715, category: '교통약자\n편의시설' },
    // 기타
    { x: 0.5015, y: 0.3462, category: '기타' },
    { x: 0.7308, y: 0.1779, category: '기타' },
  ],
  // 안내소 5  ·  식음료 2  ·  편의점 1  ·  은행·환전 3  ·  교통약자 편의시설 2  ·  유실물센터 1  ·  기타 4
  'international-1F': [
    // 안내소
    { x: 0.14, y: 0.7699, category: '안내소' },
    { x: 0.1793, y: 0.7699, category: '안내소' },
    { x: 0.2184, y: 0.7699, category: '안내소' },
    { x: 0.4104, y: 0.2454, category: '안내소' },
    { x: 0.5169, y: 0.7665, category: '안내소' },
    // 식음료
    { x: 0.7683, y: 0.7612, category: '식음료' },
    { x: 0.8979, y: 0.7699, category: '식음료' },
    // 편의점
    { x: 0.9338, y: 0.2014, category: '편의점' },
    // 은행·환전
    { x: 0.5106, y: 0.4364, category: '은행·환전' },
    { x: 0.709, y: 0.7648, category: '은행·환전' },
    { x: 0.8962, y: 0.2014, category: '은행·환전' },
    // 교통약자 편의시설
    { x: 0.3094, y: 0.6394, category: '교통약자\n편의시설' },
    { x: 0.6824, y: 0.3475, category: '교통약자\n편의시설' },
    // 유실물센터
    { x: 0.1971, y: 0.5556, category: '유실물센터' },
    // 기타
    { x: 0.0563, y: 0.4813, category: '기타' },
    { x: 0.1322, y: 0.484, category: '기타' },
    { x: 0.4696, y: 0.2447, category: '기타' },
    { x: 0.6821, y: 0.5384, category: '기타' },
  ],
  // 화장실 3  ·  안내소 3  ·  식음료 5  ·  편의점 7  ·  은행·환전 2  ·  유아휴게실 1  ·  기타 5
  'international-3F': [
    // 화장실
    { x: 0.2034, y: 0.2932, category: '화장실' },
    { x: 0.4896, y: 0.2915, category: '화장실' },
    { x: 0.6766, y: 0.7707, category: '화장실' },
    // 안내소
    { x: 0.6654, y: 0.413, category: '안내소' },
    { x: 0.7816, y: 0.7658, category: '안내소' },
    { x: 0.8031, y: 0.7658, category: '안내소' },
    // 식음료
    { x: 0.2318, y: 0.2907, category: '식음료' },
    { x: 0.3636, y: 0.2915, category: '식음료' },
    { x: 0.4425, y: 0.2907, category: '식음료' },
    { x: 0.6208, y: 0.6837, category: '식음료', en: { x: 0.6261, y: 0.6288 } },
    { x: 0.9031, y: 0.6032, category: '식음료' },
    // 편의점
    { x: 0.0398, y: 0.2739, category: '편의점' },
    { x: 0.2009, y: 0.1885, category: '편의점' },
    { x: 0.3121, y: 0.2907, category: '편의점' },
    { x: 0.3377, y: 0.2907, category: '편의점' },
    { x: 0.3896, y: 0.2907, category: '편의점' },
    { x: 0.4152, y: 0.2907, category: '편의점' },
    { x: 0.5832, y: 0.1097, category: '편의점' },
    // 은행·환전
    { x: 0.2594, y: 0.2907, category: '은행·환전' },
    { x: 0.2859, y: 0.2907, category: '은행·환전' },
    // 유아휴게실
    { x: 0.4642, y: 0.2915, category: '유아휴게실' },
    // 기타
    { x: 0.098, y: 0.1885, category: '기타' },
    { x: 0.433, y: 0.1885, category: '기타' },
    { x: 0.5584, y: 0.2932, category: '기타' },
    { x: 0.6439, y: 0.6669, category: '기타' },
    { x: 0.798, y: 0.6443, category: '기타' },
  ],
};

type PortZoneId = 'hall' | 'departure';

/**
 * 제주국제여객터미널 (W007)'s two maps, on the pill row where the airport puts its
 * terminals. Zones of one storey, not floors — see the header note. 대합실 first:
 * it is where the kiosk's visitors physically are, and the 출국장 plan itself
 * draws that hall as faded context.
 */
const PORT_ZONES = [
  {
    id: 'hall',
    label: {
      ko: '대합실',
      en: 'Waiting Hall',
      ja: '待合室',
      zh: '候船大厅',
      vi: 'Sảnh chờ',
      th: 'ห้องโถงพักคอย',
      ru: 'Зал ожидания',
      id: 'Ruang Tunggu',
    },
  },
  {
    id: 'departure',
    label: {
      ko: '출국장',
      en: 'Departure Hall',
      ja: '出国ロビー',
      zh: '出境大厅',
      vi: 'Sảnh xuất cảnh',
      th: 'โถงขาออก',
      ru: 'Зал отправления',
      id: 'Aula Keberangkatan',
    },
  },
] as const satisfies ReadonlyArray<{ id: PortZoneId; label: Record<string, string> }>;

/**
 * The terminal plans, same shape as MAPS. Both were supplied edge-to-edge (no
 * re-cut needed — the ink runs the full canvas, unlike the airport set), and the
 * ko/en of each pair share one canvas so PINS coordinates serve both.
 *
 * pinScale: these plans set their plates far larger than the airport baseline —
 * 대합실 draws them 170px on a 3307-wide canvas (≈94px at the slot's 1820, vs the
 * ~38px the domestic plans put on screen) and 출국장 168px on 3309 (≈92px).
 */
const PORT_MAPS: Record<PortZoneId, AirportMap> = {
  hall: { src: mapTerminalHall, srcEn: mapTerminalHallEn, pinScale: 2.45 },
  departure: { src: mapTerminalDeparture, srcEn: mapTerminalDepartureEn, pinScale: 2.4 },
};

/**
 * Where the terminal plans draw their facilities — swept off the artwork the
 * same way as PINS (plates by colour, glyphs as ink blobs; centres are the
 * measured cluster centres, as fractions of the canvas).
 *
 * The 기타 sweep here is mostly the port's OFFICES — 한국해운조합, 국립수산물품질
 * 관리원, KOMERI, the 여객선 desks, 출입국심사 — because that is what this
 * building draws where the airport draws AEDs and lockers. No sheet row names
 * any of them (see the header note), so they open under the 기타 chip as-is.
 */
const PORT_PINS: Record<PortZoneId, FacilityPin[]> = {
  // 화장실 3 · 유아휴게실 1 · 안내소 1 · 편의점 4 · 식음료 2 · 기타 9
  hall: [
    // 화장실
    { x: 0.6656, y: 0.2682, category: '화장실' },
    { x: 0.319, y: 0.4672, category: '화장실' },
    { x: 0.9577, y: 0.8018, category: '화장실' },
    // 유아휴게실
    { x: 0.3184, y: 0.2491, category: '유아휴게실' },
    // 안내소 — the green ⓘ plate by the 개찰구
    { x: 0.5721, y: 0.2679, category: '안내소' },
    // 편의점 — the four 쇼핑백 glyphs (매점/상가)
    { x: 0.0983, y: 0.2693, category: '편의점' },
    { x: 0.1923, y: 0.4245, category: '편의점' },
    { x: 0.4073, y: 0.5203, category: '편의점' },
    { x: 0.5727, y: 0.6057, category: '편의점' },
    // 식음료
    { x: 0.3695, y: 0.4974, category: '식음료' },
    { x: 0.4974, y: 0.5674, category: '식음료' },
    // 기타 — 휴게의자, 한국해운조합, 여객선사 3, 접수데스크, 의무실(+),
    // 국립수산물품질관리원, KOMERI
    { x: 0.3668, y: 0.2557, category: '기타' },
    { x: 0.4276, y: 0.2476, category: '기타' },
    { x: 0.4917, y: 0.2738, category: '기타' },
    { x: 0.8564, y: 0.2745, category: '기타' },
    { x: 0.5355, y: 0.5873, category: '기타' },
    { x: 0.9465, y: 0.4374, category: '기타' },
    { x: 0.9471, y: 0.5125, category: '기타' },
    { x: 0.9459, y: 0.5718, category: '기타' },
    { x: 0.9459, y: 0.7277, category: '기타' },
  ],
  // 화장실 1 · 기타 6
  departure: [
    // 화장실
    { x: 0.8099, y: 0.168, category: '화장실' },
    // 기타 — 데스크 3, 문화재청, 출입국심사 2
    { x: 0.7461, y: 0.0593, category: '기타' },
    { x: 0.7999, y: 0.0435, category: '기타' },
    { x: 0.8525, y: 0.0538, category: '기타' },
    { x: 0.8852, y: 0.168, category: '기타' },
    { x: 0.9519, y: 0.1721, category: '기타' },
    { x: 0.9568, y: 0.2797, category: '기타' },
  ],
};

const COMING_SOON = {
  ko: '준비중입니다',
  en: 'Coming soon',
  ja: '準備中です',
  zh: '正在准备中',
  vi: 'Đang chuẩn bị',
  th: 'กำลังเตรียมการ',
  ru: 'В подготовке',
  id: 'Sedang disiapkan',
};

/**
 * Base category (witteria `baseCategoryKr`) the facility rows come from.
 *
 * TODO(제주 W006): the catalogue has NO 도와줘 rows yet. Checked 2026-08-12
 * against `/api/shops?kioskId=7` (prod and stage): the only four base categories
 * are 제주 뭐하지 / 제주 뭐먹지 / 제주 뭐사지 / 숙박안내. The mascot form this used
 * to guess ('하영 도와줘') is ruled out by those four — 제주 keys on the LOCATION
 * prefix — so this now follows the same prefix, but it is still a guess about a
 * category that does not exist yet.
 *
 * It is no longer the screen's only hope of content: AirportFacilityData_Jeju
 * now carries the names, hours, phone numbers and products (see openPin). What
 * the witteria row would still add is what the SHEET has no column for — photos,
 * the 네이버 rating and the link the card turns into a QR — so it is kept as an
 * enrichment, matched by Korean name against whichever row the pin resolved to.
 * The day the rows land, the cards gain their pictures with nothing to change
 * here; until then `facilities` is empty and the sheet answers on its own.
 */
const BASE_CATEGORY = '제주 도와줘';

/** Where in the airport a pin is, for the 상세 card's address line when nothing
 *  named it — an unpaired pictogram knows only its terminal and its floor. */
function placeLine(terminal: TerminalId, floor: FloorId, lang: Lang): string {
  const t = TERMINALS.find((x) => x.id === terminal)!;
  return `${pick(AIRPORT, lang)} ${terminalLabel(t, lang)} ${floor}`;
}

/**
 * The same line for a pin the sheet DID name, which knows one thing more: the
 * zone. Location_Kr is "1F 일반" / "2F 면세" — landside or airside — and inside
 * an airport that is the difference between a shop a visitor can walk to and one
 * they can only reach after 보안검색. It replaces the bare floor rather than
 * being added to it, since it already contains it.
 */
function zoneLine(terminal: TerminalId, facility: AirportFacility, lang: Lang): string {
  const t = TERMINALS.find((x) => x.id === terminal)!;
  return `${pick(AIRPORT, lang)} ${terminalLabel(t, lang)} ${pickText(facility.location, lang)}`;
}

/** The sheet writes "-" where a facility has no telephone (every ATM, most desks);
 *  the card must draw nothing there, not a dash. */
function telOf(facility: AirportFacility): string {
  const tel = facility.tel.trim();
  return tel === '-' ? '' : tel;
}

const AIRPORT = {
  ko: '제주국제공항',
  en: 'Jeju International Airport',
  ja: '済州国際空港',
  zh: '济州国际机场',
  vi: 'Sân bay quốc tế Jeju',
  th: 'ท่าอากาศยานนานาชาติเชจู',
  ru: 'Международный аэропорт Чеджу',
  id: 'Bandara Internasional Jeju',
};

/** W007's venue name — kioskLocations' 제주국제여객터미널, localized. */
const PORT_TERMINAL = {
  ko: '제주국제여객터미널',
  en: 'Jeju International Passenger Terminal',
  ja: '済州国際旅客ターミナル',
  zh: '济州国际客运码头',
  vi: 'Bến tàu khách quốc tế Jeju',
  th: 'ท่าเรือโดยสารนานาชาติเชจู',
  ru: 'Международный пассажирский терминал Чеджу',
  id: 'Terminal Penumpang Internasional Jeju',
};

/** placeLine's terminal-venue twin: venue + zone, since no floor is claimed. */
function portPlaceLine(zone: PortZoneId, lang: Lang): string {
  const z = PORT_ZONES.find((x) => x.id === zone)!;
  return `${pick(PORT_TERMINAL, lang)} ${pick(z.label, lang)}`;
}

/** 6219:98773 — the label under the 현위치 pin. */
const YOU_ARE_HERE = {
  ko: '현위치',
  en: 'You are here',
  ja: '現在地',
  zh: '当前位置',
  vi: 'Vị trí hiện tại',
  th: 'ตำแหน่งปัจจุบัน',
  ru: 'Вы здесь',
  id: 'Lokasi Anda',
};

/** Zoom bounds. 1 is the fitted plan; 4 reads the smallest lettering on the
 *  densest plan (국내선 3F) without turning into pixel soup. */
const MIN_SCALE = 1;
const MAX_SCALE = 4;
/** Below this much finger travel a gesture is a TAP and the pins keep it. */
const TAP_SLOP = 12;
/** Double-tap window/radius, and the scale the first double-tap jumps to. */
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_RADIUS = 60;
const DOUBLE_TAP_SCALE = 2.2;

interface ViewState {
  s: number;
  tx: number;
  ty: number;
}

/**
 * Pinch-zoom + drag-pan viewport for the floor plan (2026-09-03, by request).
 *
 * Hand-rolled on pointer events rather than a library: the kiosk is a touch
 * panel, the content is one absolutely-positioned box with live BUTTONS in it
 * (the pins), and the whole requirement is pinch, pan-while-zoomed, double-tap
 * and a wheel fallback for the dev machine — less code than configuring a
 * generic pan-zoom dependency around the pins' tap targets.
 *
 * What it guarantees:
 *   · The pins stay tappable. No pointer capture is taken (capture would
 *     re-target the up/click at this element and the buttons would never
 *     fire), and a gesture only swallows the click behind it when the finger
 *     actually travelled (> TAP_SLOP) or a double-tap just zoomed — see
 *     onClickCapture.
 *   · The plan can never be dragged out of its slot: translate is clamped to
 *     [slot·(1−scale), 0] on both axes, which at scale 1 pins it to (0,0) —
 *     so the unzoomed page is exactly the page as it was.
 *   · Double-tap toggles: zoom in about the tapped point, or all the way back
 *     out. (On a PIN the first tap already opens 상세, so the toggle is in
 *     practice a gesture for the map's empty paper — that is fine.)
 *
 * Transformed WHOLE: the pins and the 현위치 marker ride the same transform as
 * the artwork, so a marker keeps pointing at its pictogram at every scale.
 * The `key` its caller passes doubles as the reset: a new plan (floor, zone,
 * or language switch) remounts this and starts back at fitted.
 */
function MapZoomPan({ className, children }: { className: string; children: ReactNode }): JSX.Element {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<ViewState>({ s: 1, tx: 0, ty: 0 });
  /** Mirror of `view` for handlers that must read it without a stale closure. */
  const viewRef = useRef(view);
  viewRef.current = view;
  /** Live fingers on the glass, by pointerId, in viewport coordinates. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  /** The pinch as it stood when the second finger landed. */
  const pinch = useRef<{ dist: number; s: number } | null>(null);
  const moved = useRef(0);
  const suppressClick = useRef(false);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });

  const clamp = (v: ViewState): ViewState => {
    const el = viewportRef.current;
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.s));
    if (!el) return { s, tx: 0, ty: 0 };
    return {
      s,
      tx: Math.min(0, Math.max(el.clientWidth * (1 - s), v.tx)),
      ty: Math.min(0, Math.max(el.clientHeight * (1 - s), v.ty)),
    };
  };

  /** Rescale about a viewport point, so what is under the finger stays put. */
  const zoomAt = (x: number, y: number, nextS: number): void => {
    setView((v) => {
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextS));
      return clamp({ s, tx: x - ((x - v.tx) / v.s) * s, ty: y - ((y - v.ty) / v.s) * s });
    });
  };

  const local = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const r = viewportRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // A finger lifted OUTSIDE the viewport never sends it a pointerup (no
  // capture, see above), and a pointer left in the map would turn the next
  // one-finger drag into a phantom pinch. The window sees every up.
  useEffect(() => {
    const drop = (e: PointerEvent): void => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      if (pointers.current.size === 0) moved.current = 0;
    };
    window.addEventListener('pointerup', drop);
    window.addEventListener('pointercancel', drop);
    return () => {
      window.removeEventListener('pointerup', drop);
      window.removeEventListener('pointercancel', drop);
    };
  }, []);

  const onPointerDown = (e: ReactPointerEvent): void => {
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), s: viewRef.current.s };
    }
  };

  const onPointerMove = (e: ReactPointerEvent): void => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = local(e);
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      moved.current += Math.abs(dist - pinch.current.dist * (viewRef.current.s / pinch.current.s));
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.current.s * (dist / pinch.current.dist));
    } else if (pointers.current.size === 1) {
      const dx = now.x - prev.x;
      const dy = now.y - prev.y;
      moved.current += Math.hypot(dx, dy);
      // Nothing to pan at scale 1 — the clamp would zero it anyway, this just
      // skips the render.
      if (viewRef.current.s > 1) setView((v) => clamp({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
    }
  };

  const onPointerUp = (e: ReactPointerEvent): void => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size < 2) pinch.current = null;
    if (moved.current > TAP_SLOP) {
      suppressClick.current = true;
    } else if (pointers.current.size === 0) {
      const now = local(e);
      const t = Date.now();
      const tap = lastTap.current;
      if (t - tap.t < DOUBLE_TAP_MS && Math.hypot(now.x - tap.x, now.y - tap.y) < DOUBLE_TAP_RADIUS) {
        if (viewRef.current.s > 1.05) setView({ s: 1, tx: 0, ty: 0 });
        else zoomAt(now.x, now.y, DOUBLE_TAP_SCALE);
        suppressClick.current = true;
        lastTap.current = { t: 0, x: 0, y: 0 };
      } else {
        lastTap.current = { t, x: now.x, y: now.y };
      }
    }
    if (pointers.current.size === 0) moved.current = 0;
  };

  const onPointerCancel = (e: ReactPointerEvent): void => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) moved.current = 0;
  };

  /** The kiosk has no wheel; this is for the dev machine, where a mouse cannot
   *  pinch. Anchored at the cursor like the pinch is at its midpoint. */
  const onWheel = (e: ReactWheelEvent): void => {
    const p = local(e);
    zoomAt(p.x, p.y, viewRef.current.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  };

  return (
    <div
      ref={viewportRef}
      className={`${className} ${styles.zoomable}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onWheel={onWheel}
      onClickCapture={(e) => {
        // A drag or a zoom is not a tap: the click the browser synthesises
        // behind it must not open whatever pin the finger happened to end on.
        if (suppressClick.current) {
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div
        className={styles.zoomLayer}
        style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})` }}
      >
        {children}
      </div>
    </div>
  );
}

interface Props {
  controller: KioskController;
  /**
   * Chip lit on arrival; an unknown id falls back to the first chip.
   *
   * NOTHING PASSES THIS TODAY. It carried '화장실' from the home screen's 화장실
   * button, which opened this page straight on the toilets — but 화장실 is not a
   * BaseCategory the sheet uses, so it stopped being a chip when CATEGORIES
   * became the sheet's (see lib/airportFacilities) and the button now opens the
   * page plain. Kept, not deleted: it is the one way to deep-link into a chip,
   * the guard below already answers a stale value, and 화장실 becomes passable
   * again the moment the sheet carries rows for it.
   */
  initialCategory?: string;
}

export function JejuHelp({ controller, initialCategory }: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  // W007 shows its own building; every other 제주 kiosk keeps the airport plans.
  // Non-reactive on purpose, like jejuMascot: the id is provisioned per machine.
  const atPort = getKioskLocation(controller.kioskId).code === 'W007';
  const [terminal, setTerminal] = useState<TerminalId>('international');
  const [floor, setFloor] = useState<FloorId>('1F');
  const [zone, setZone] = useState<PortZoneId>('hall');
  const [category, setCategory] = useState(
    initialCategory && CATEGORIES.includes(initialCategory) ? initialCategory : CATEGORIES[0]!,
  );

  const track = (payload: Record<string, string>): void => {
    trackEvent({
      name: 'button_clicked',
      payload: { screen: 'help', ...payload, kioskId: controller.kioskId },
    });
  };

  const floors = FLOORS[terminal];
  const map = atPort ? PORT_MAPS[zone] : MAPS[`${terminal}-${floor}`];
  const here = jejuIconUrl('ico-here');
  const marker = jejuIconUrl('ico-map-pin');

  /** The Korean plan for Korean, the Latin one for everything else — and the
   *  Korean one again when a plan has no Latin twin because it has no text. */
  const planSrc = map && (lang === 'ko' ? map.src : (map.srcEn ?? map.src));

  /**
   * This floor's pins, each paired with the sheet row behind it and told which
   * chip draws it. Recomputed only when the floor changes — the pairing is a
   * property of the floor, not of the chip in hand or the language on screen.
   */
  // 'port' matches no sheet terminal, so every terminal pin comes back with its
  // group's fallback chip and no row — the map-only card. See the header note.
  const assigned = useMemo(
    () =>
      atPort
        ? assignFacilities('port', zone, PORT_PINS[zone])
        : assignFacilities(terminal, floor, PINS[`${terminal}-${floor}`] ?? []),
    [atPort, terminal, floor, zone],
  );

  /** The pictograms the selected chip marks — every other one stays as drawn. */
  const activePins = assigned.filter((a) => a.chip === category);

  const facilities = useMemo(() => shopsForBase(shops, BASE_CATEGORY), [shops]);

  /**
   * Switch terminal, keeping the floor when the other terminal has it.
   *
   * 국내선 has a 4F that 국제선 does not, so the floor in hand is not always a
   * floor of the terminal being switched to; without the clamp the page would
   * hold '4F' on 국제선 and draw 준비중 for a storey that does not exist.
   */
  const pickTerminal = (id: TerminalId): void => {
    track({ terminal: id });
    setTerminal(id);
    if (!FLOORS[id].some((f) => f.id === floor)) setFloor(FLOORS[id][0]!.id);
  };

  /**
   * Open 도와줘 '하영' > 상세 (6219:99127) for a pin.
   *
   * Three sources, in descending order of what they know:
   *
   *   1. the AirportFacilityData_Jeju row the pin was paired with — the name,
   *      category, zone, hours, phone and products, all eight languages — plus
   *      the bundled resources/help photo shot for exactly that row;
   *   2. the witteria row of the same Korean name, for what neither has: the
   *      네이버 rating and its link (the card's QR), and any further photos.
   *      Absent today; see BASE_CATEGORY;
   *   3. the map itself, for a pictogram neither named — its chip and its floor,
   *      which is exactly as much as the plan says about it.
   *
   * Nothing is invented at any level: an absent field renders as nothing (see
   * JejuSpotDetailCard), so a card shows what is actually known about the place
   * and no more.
   */
  const openPin = ({ pin, chip, facility }: AssignedPin<FacilityPin>): void => {
    const wanted = facility?.name.ko ?? pin.shop ?? pin.label ?? chip;
    const shop = facilities.find((s) => s.shopNameKr === wanted);

    // The bundled resources/help photo of the sheet row, named by its terminal
    // and per-terminal number (see facilityImageUrl). It leads: it is OUR shot
    // of exactly this facility, where the witteria photos are a name-matched
    // guess that does not exist yet (see BASE_CATEGORY).
    const facilityPhoto = facility && facilityImageUrl(facility);

    track(
      atPort
        ? { facility: wanted, zone, category }
        : { facility: wanted, terminal, floor, category },
    );

    setDetail({
      from: 'help',
      // Named in the visitor's own language; the Korean form is only what the
      // witteria row above was looked up by.
      name: facility
        ? pickText(facility.name, lang)
        : shop
          ? shopName(shop, lang)
          : pinLabel(pin, chip, lang),
      title: '여기는 제주도',
      // The row's OWN category, not the chip — they are the same string whenever
      // the sheet named the pin, and where it did not the chip is all there is.
      category: chipLabel(facility?.category.ko ?? chip, lang).replace('\n', ' '),
      photos: [...(facilityPhoto ? [facilityPhoto] : []), ...(shop ? shopImages(shop) : [])],
      address: facility
        ? zoneLine(terminal, facility, lang)
        : shop
          ? shopAddress(shop, lang)
          : atPort
            ? portPlaceLine(zone, lang)
            : placeLine(terminal, floor, lang),
      hours: facility?.openTime ?? shop?.openTime ?? '',
      phone: facility ? telOf(facility) : (shop?.tel ?? ''),
      description: facility
        ? pickText(facility.mainProduct, lang)
        : shop
          ? shopDescription(shop, lang)
          : '',
      tags: shop ? shopHashtag(shop, lang) : '',
      rating: shop?.naverRating != null ? String(shop.naverRating) : '',
      instagram: '',
      // Carries the Naver LINK, not a review count — see JejuDetail.
      blogReviews: shop?.naverLink ?? '',
    });
    controller.navigate('detail', `도와줘 ${jejuMascot().ko} 상세`);
  };

  return (
    // No banner in the standard layout: the frame runs the background
    // illustration to the bottom. The low-reach frame DOES open with one, so
    // the page asks for it — see .mapLow and friends.
    <JejuPageFrame
      controller={controller}
      title={jejuMascot().helpTitle}
      showBanner={false}
      lowReachBanner
      lowReachSelfLayout
      bannerFallback="banner-detail"
      onBack={() => controller.navigate('home', '뒤로')}
    >
      <div className={`${styles.terminals} ${lowReach ? styles.terminalsLow : ''}`}>
        {atPort
          ? PORT_ZONES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`${styles.pill} ${id === zone ? styles.pillActive : ''}`}
                onClick={() => {
                  track({ zone: id });
                  setZone(id);
                }}
              >
                {pick(label, lang)}
              </button>
            ))
          : TERMINALS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`${styles.pill} ${t.id === terminal ? styles.pillActive : ''}`}
                onClick={() => pickTerminal(t.id)}
              >
                {terminalLabel(t, lang)}
              </button>
            ))}
      </div>

      {/* This page's floor band is on y940, not the shared row's y920. The
          terminal venue draws NO floor row — its two maps are zones of one
          storey whose 층 the plans never state, so no number is invented; the
          band stays empty rather than carrying a guess. */}
      {!atPort && (
        <JejuSubTabRow
          className={`${styles.floors} ${lowReach ? styles.floorsLow : ''}`}
          items={floors}
          value={floor}
          onChange={(id) => {
            track({ floor: id });
            setFloor(id);
          }}
        />
      )}

      <div className={`${styles.cats} ${lowReach ? styles.catsLow : ''}`}>
        {Array.from({ length: CATEGORY_ROWS }, (_, row) => row * PER_ROW).map((start) => (
          <div key={start} className={styles.catRow}>
            {CATEGORIES.slice(start, start + PER_ROW).map((id) => (
              <button
                key={id}
                type="button"
                className={`${styles.pill} ${id === category ? styles.pillActive : ''}`}
                onClick={() => {
                  track({ category: id });
                  setCategory(id);
                }}
              >
                <span className={styles.pillLabel}>{chipLine(id, lang)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {map && planSrc ? (
        /* `key` on the VIEWPORT so a terminal/floor/zone/language change
           remounts everything inside: the plans have different aspects (a
           reused <img> keeps the old one's box until the new file decodes),
           and a zoom held from one plan means nothing on the next. */
        <MapZoomPan key={planSrc} className={`${styles.map} ${lowReach ? styles.mapLow : ''}`}>
          <div
            className={styles.plan}
            style={{ '--pin-scale': map.pinScale ?? 1 } as CSSProperties}
          >
            <img src={planSrc} alt="" draggable={false} />

            {/* The pictograms for the selected chip. The plan paints each one
                already, so the marker points DOWN AT it from above rather than
                covering it — the symbol is how a visitor tells a toilet from a
                nursery, and hiding it would leave only a colour. The button is
                the tap target and the route to 상세. */}
            {activePins.map((a) => (
              <button
                key={`${a.pin.x},${a.pin.y}`}
                type="button"
                className={styles.pin}
                style={at(a.pin, lang)}
                onClick={() => openPin(a)}
                aria-label={
                  a.facility ? pickText(a.facility.name, lang) : pinLabel(a.pin, a.chip, lang)
                }
              >
                {marker && (
                  <img src={marker} alt="" className={styles.pinMarker} draggable={false} />
                )}
              </button>
            ))}

            {/* 현위치 (6219:98771). Drawn only when the map says where the kiosk
                is — a pin at a guessed position is worse than no pin. */}
            {map.here && here && (
              <div
                className={styles.here}
                style={{ left: `${map.here.x * 100}%`, top: `${map.here.y * 100}%` }}
              >
                <img src={here} alt="" className={styles.hereIcon} draggable={false} />
                <p className={styles.hereLabel}>{pick(YOU_ARE_HERE, lang)}</p>
              </div>
            )}
          </div>
        </MapZoomPan>
      ) : (
        <p className={`${styles.empty} ${lowReach ? styles.emptyLow : ''}`}>
          {pick(COMING_SOON, lang)}
        </p>
      )}
    </JejuPageFrame>
  );
}

/** Where to draw a pin, on whichever plan is on screen — see FacilityPin.en. */
function at(pin: FacilityPin, lang: Lang): CSSProperties {
  const p = lang === 'ko' ? pin : (pin.en ?? pin);
  return { left: `${p.x * 100}%`, top: `${p.y * 100}%` };
}

/** What an UNNAMED pin is called on screen — one the sheet had no row for. Its
 *  own label if it was given one, otherwise the chip that drew it; localized
 *  either way, because `chipLabel` resolves both the sheet's ids and the
 *  pictogram ones. */
function pinLabel(pin: FacilityPin, chip: string, lang: Lang): string {
  return chipLabel(pin.label ?? chip, lang).replace('\n', ' ');
}
