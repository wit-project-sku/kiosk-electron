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
 * files no facility there either — so that storey is no longer offered at all.
 * The terminal's two passenger levels are the building's 1층 and 3층, and they
 * are the two chips: 1F, and the 3층 plan drawn as 2F. See FLOORS.
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
 */
import { useMemo, useState, type CSSProperties } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useDetailStore } from '@renderer/store/detailStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useShopStore } from '@renderer/store/shopStore';
import { pick, type Lang } from '@renderer/lib/i18n';
import { pickText } from '@renderer/data/types';
import {
  assignFacilities,
  chipLabel,
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

type TerminalId = 'international' | 'domestic';
type FloorId = '1F' | '2F' | '3F' | '4F';

/** Terminal pills in frame order (6219:98779 / 98783). */
const TERMINALS = [
  {
    id: 'international',
    label: {
      ko: '국제선',
      en: 'International',
      ja: '国際線',
      zh: '国际航线',
      vi: 'Quốc tế',
      th: 'ระหว่างประเทศ',
      ru: 'Международные',
      id: 'Internasional',
    },
  },
  {
    id: 'domestic',
    label: {
      ko: '국내선',
      en: 'Domestic',
      ja: '国内線',
      zh: '国内航线',
      vi: 'Nội địa',
      th: 'ในประเทศ',
      ru: 'Внутренние',
      id: 'Domestik',
    },
  },
] as const satisfies ReadonlyArray<{ id: TerminalId; label: Record<string, string> }>;

/**
 * The floors each terminal offers, as a chip LABEL over the id everything else
 * keys off. 국내선 runs 1–4F, so the frame's fixed 1F ㅣ 2F ㅣ 3F no longer stands
 * for both rows.
 *
 * ── 국제선 is two chips, and the second one says 2F (2026-09-02) ─────────────
 * The terminal has passenger levels on the building's 1층 and 3층 — arrivals
 * below, departures above — and nothing on 2층 that a visitor is sent to. So the
 * row that used to read 1F ㅣ 2F ㅣ 3F offered one floor with no plan (준비중,
 * because 한국공항공사 supplied no 국외 2F drawing) and one floor the visitor had
 * to skip past to reach. It now reads 1F ㅣ 2F: two chips, both with a map.
 *
 * The second chip is LABELLED '2F' but its id stays '3F', and that split is the
 * whole point — `id` is what MAPS, PINS and the sheet's own `floor` column are
 * keyed by, so the plan, its pins and its 100 rows all keep working untouched
 * and no data has to be restated to match a renamed chip.
 *
 * Be aware of what the label cannot reach, because it does not lie about it: the
 * plan carries 3층/3F in its own lettering, and a 상세 card opened from this chip
 * prints the sheet's own zone ("3F 면세"). Both are the building's storey number,
 * which is what the airport's signage says once a visitor looks up from the
 * kiosk — so they agree with 제주공항 and only disagree with the chip.
 */
const FLOORS: Record<TerminalId, ReadonlyArray<{ id: FloorId; label: string }>> = {
  domestic: [
    { id: '1F', label: '1F' },
    { id: '2F', label: '2F' },
    { id: '3F', label: '3F' },
    { id: '4F', label: '4F' },
  ],
  international: [
    { id: '1F', label: '1F' },
    // The 3층 plan, drawn as this terminal's second floor. See above.
    { id: '3F', label: '2F' },
  ],
};

/**
 * Category chips, five per row.
 *
 * ★ These are no longer the frame's own ten (6219:98787). Ten of the fifteen are
 * the BaseCategory values of AirportFacilityData_Jeju, so the SHEET decides both
 * what a chip is and what it is called in eight languages; the other five are
 * the pictograms the shop list does not carry (화장실, 흡연실, 유아휴게실,
 * 교통약자 편의시설, 유실물센터), which keep the frame's own labels. The list, and
 * the reasoning behind its order, live in lib/airportFacilities.
 *
 * Fifteen chips is three rows where Figma drew two, so the map below moves down
 * by one row in both layouts — see .cats / .map in the CSS.
 */
const CATEGORIES = HELP_CHIPS;
const PER_ROW = 5;

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
   * 1F/2F/3F plans put on screen — the marker is multiplied by it so that it
   * keeps the same relationship to the symbol it points at on every plan.
   *
   * The plans are not drawn to one scale. Measured on screen at 1820 wide:
   * 국내선 1F 38px · 2F 36px · 3F 38px · 국제선 3F 35px — but 국제선 1F 60px and
   * 국내선 4F 103px, because those two cover much less floor and so are drawn
   * nearly three times larger. A single marker size that suits the first four
   * vanishes under a 4F pictogram; one that suits 4F swamps the others.
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
  return `${pick(AIRPORT, lang)} ${pick(t.label, lang)} ${floor}`;
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
  return `${pick(AIRPORT, lang)} ${pick(t.label, lang)} ${pickText(facility.location, lang)}`;
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

interface Props {
  controller: KioskController;
  /**
   * Chip lit on arrival. The home screen's 화장실 button opens this same page —
   * there is no separate toilet screen — and passes '화장실' so the visitor lands
   * on the toilets rather than having to find the chip. Stated explicitly rather
   * than leaning on 화장실 happening to be `CATEGORIES[0]`, which is a frame
   * ordering that can change. An unknown id falls back to the first chip.
   */
  initialCategory?: string;
}

export function JejuHelp({ controller, initialCategory }: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const [terminal, setTerminal] = useState<TerminalId>('international');
  const [floor, setFloor] = useState<FloorId>('1F');
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
  const map = MAPS[`${terminal}-${floor}`];
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
  const assigned = useMemo(
    () => assignFacilities(terminal, floor, PINS[`${terminal}-${floor}`] ?? []),
    [terminal, floor],
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
   *      category, zone, hours, phone and products, all eight languages;
   *   2. the witteria row of the same Korean name, for the three things the
   *      sheet has no column for: photos, the 네이버 rating and its link (the
   *      card's QR). Absent today; see BASE_CATEGORY;
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

    track({ facility: wanted, terminal, floor, category });

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
      photos: shop ? shopImages(shop) : [],
      address: facility
        ? zoneLine(terminal, facility, lang)
        : shop
          ? shopAddress(shop, lang)
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
        {TERMINALS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`${styles.pill} ${id === terminal ? styles.pillActive : ''}`}
            onClick={() => pickTerminal(id)}
          >
            {pick(label, lang)}
          </button>
        ))}
      </div>

      {/* This page's floor band is on y940, not the shared row's y920. */}
      <JejuSubTabRow
        className={`${styles.floors} ${lowReach ? styles.floorsLow : ''}`}
        items={floors}
        value={floor}
        onChange={(id) => {
          track({ floor: id });
          setFloor(id);
        }}
      />

      <div className={`${styles.cats} ${lowReach ? styles.catsLow : ''}`}>
        {[0, PER_ROW].map((start) => (
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
                {chipLabel(id, lang)}
              </button>
            ))}
          </div>
        ))}
      </div>

      {map && planSrc ? (
        <div className={`${styles.map} ${lowReach ? styles.mapLow : ''}`}>
          {/* `key` on the plan so a terminal/floor/language change remounts the
              <img>: the plans have different aspects, and a reused element
              keeps the old one's box until the new file decodes. */}
          <div
            className={styles.plan}
            key={planSrc}
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
        </div>
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
