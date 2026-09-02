/**
 * 제주공항 시설 데이터 — pairing AirportFacilityData_Jeju with the 도와줘 '하영' map.
 *
 * The sheet says WHAT is in the airport (100 rows: name, category, floor, hours,
 * phone, main product, all in eight languages). The floor plans say WHERE the
 * pictograms are (PINS in JejuHelp). Neither knows about the other — the sheet
 * carries no coordinates and the plans carry no names — so this module is the
 * join between them.
 *
 * ── How a pin finds its row ─────────────────────────────────────────────────
 * By POSITION IN SHEET ORDER within a bucket, not by identity. A bucket is one
 * (terminal, floor, pin group); the group's rows are taken in sheet order and
 * handed out to the group's pins in PINS order, one each.
 *
 * That is an assignment, not a lookup, and it is worth being blunt about what it
 * does and does not guarantee. It guarantees the KIND: a 카페・디저트 row only
 * ever lands on a pin the plan drew a 커피잔 on, on the right floor of the right
 * terminal. It does NOT guarantee the identity: where a floor draws four cafés,
 * which of the four a given marker opens follows 한국공항공사's list order, which
 * is not the plan's geometry. The counts agree exactly in several buckets
 * (국내선 2F 식음료 7/7, 국내선 2F 편의점 7/7, 국내선 4F 식음료 7/7, 국제선 1F
 * 은행·환전 3/3), which is what makes the pairing worth doing at all, but it is
 * still an ordering and not a survey.
 *
 * A pin can therefore be nailed down by hand: give it `shop: '엔제리너스 커피'` in
 * PINS and it takes that row by name and drops out of the ordering, leaving the
 * rest to shuffle up. Naming pins is strictly an improvement and needs no change
 * here — see `assignFacilities`.
 *
 * ── Groups ──────────────────────────────────────────────────────────────────
 * The plans' pictograms are coarser than the sheet's categories: one 커피잔 glyph
 * stands for both 카페・디저트 and 식당, one ₩ plate for 금융・보험・환전, and the
 * black glyphs the map calls 기타 cover five sheet categories at once. GROUPS is
 * that many-to-one, written the other way round.
 *
 * Five chips have NO sheet rows at all — 화장실, 흡연실, 유아휴게실, 교통약자
 * 편의시설, 유실물센터 are pictograms the airport draws and the shop list does not
 * carry. They keep working exactly as they did: their pins open the card built
 * from what the map knows. Dropping them would delete ~30 working pins and leave
 * the home screen's 화장실 button with nowhere to land.
 */
import {
  AIRPORT_FACILITIES_JEJU,
  type AirportFacility,
} from '@renderer/data/airportFacilities-jeju.generated';
import { pickText, type LangText } from '@renderer/data/types';
import { facilityLabel, type Lang } from './i18n';

export type { AirportFacility };

/**
 * Pin-group → the sheet categories that group's pictograms stand for, PRIMARY
 * FIRST. The primary is where a pin that outlived its rows ends up (see
 * `assignFacilities`), so it should be the group's most ordinary reading:
 * a café before a restaurant, 기타 before an airline desk.
 *
 * Keys are the `category` values PINS is written in; they stay as they are so
 * the pin coordinates never have to be re-keyed when the sheet's taxonomy moves.
 */
const GROUPS: Record<string, readonly string[]> = {
  식음료: ['카페・디저트', '식당'],
  편의점: ['쇼핑'],
  '은행·환전': ['금융・보험・환전'],
  안내소: ['안내・관광・호텔'],
  기타: ['기타', '교통・렌터카', '항공사', '라운지・휴식', '의료'],
};

/**
 * The chip row, 5 per line over 3 lines.
 *
 * 화장실 leads because the home screen's own 화장실 button opens this page on it,
 * and because a visitor looking for one should not have to read past 라운지 to
 * find it. The other four pictogram chips sit together on the last line with
 * 기타, which is where a catch-all belongs; the sheet's ten run in between,
 * everyday-first.
 */
export const HELP_CHIPS = [
  '화장실',
  '안내・관광・호텔',
  '식당',
  '카페・디저트',
  '쇼핑',
  '금융・보험・환전',
  '항공사',
  '교통・렌터카',
  '라운지・휴식',
  '의료',
  '흡연실',
  '유아휴게실',
  '교통약자\n편의시설',
  '유실물센터',
  '기타',
];

/** Sheet-category label lookup, built once from the first row carrying each. */
const CHIP_LABELS: Record<string, LangText> = {};
for (const f of AIRPORT_FACILITIES_JEJU) {
  CHIP_LABELS[f.category.ko] ??= f.category;
}

/**
 * A BaseCategory the sheet uses that no chip offers, and no group routes.
 *
 * This is the one way the sheet can grow that the screen cannot absorb on its
 * own: a new category typed into AirportFacilityData_Jeju arrives with its own
 * eight translations and needs nothing here to be LABELLED, but it still needs a
 * chip in HELP_CHIPS to be reachable and an entry in GROUPS to say which
 * pictogram stands for it. Without both, its rows are simply invisible on the
 * map — silently, which is why this says so out loud at startup.
 */
const routed = new Set(Object.values(GROUPS).flat());
const unreachable = Object.keys(CHIP_LABELS).filter(
  (ko) => !HELP_CHIPS.includes(ko) || !routed.has(ko),
);
if (unreachable.length > 0) {
  console.warn(
    '[airportFacilities] AirportFacilityData_Jeju categories no chip can reach:',
    unreachable.join(', '),
    '— add them to HELP_CHIPS and to a GROUPS entry.',
  );
}

/**
 * What a chip is called on screen.
 *
 * A sheet category is localized BY THE SHEET, which is the point of keying the
 * chips off it — a new category appears translated the day it is typed in, with
 * nothing to add here. The five pictogram chips fall through to the bundled
 * FACILITY_LABELS table, as they always did.
 */
export function chipLabel(chip: string, lang: Lang): string {
  const fromSheet = CHIP_LABELS[chip];
  return fromSheet ? pickText(fromSheet, lang) : facilityLabel(chip, lang);
}

/** Which sheet categories a pin group covers — '' for the pictogram-only chips. */
function groupOf(pinCategory: string): readonly string[] {
  return GROUPS[pinCategory] ?? [];
}

/** The chip a pin lights under when nothing in the sheet claimed it. */
function fallbackChip(pinCategory: string): string {
  return groupOf(pinCategory)[0] ?? pinCategory;
}

/** A pin as this module needs to see it: its category, and an optional name that
 *  pins it to one specific row. Everything else about a pin is JejuHelp's. */
interface PinLike {
  category: string;
  /** Exact `ShopName_Kr` to bind to, when someone has identified the pictogram. */
  shop?: string;
}

/** A pin, the chip it belongs under, and the row behind it (when it has one). */
export interface AssignedPin<T> {
  pin: T;
  /** The chip that draws this pin — a sheet category, or the pin's own for the
   *  five pictogram chips. */
  chip: string;
  facility?: AirportFacility;
}

/** The rows on one floor of one terminal, in sheet order. */
export function facilitiesOn(terminal: string, floor: string): AirportFacility[] {
  return AIRPORT_FACILITIES_JEJU.filter((f) => f.terminal === terminal && f.floor === floor);
}

/**
 * Pair a floor's pins with that floor's rows, and say which chip draws each pin.
 *
 * Runs per pin group. Named pins (`shop`) are bound first and take their row out
 * of circulation; the rest of the group's rows are then dealt to the rest of the
 * group's pins in order. Whichever side runs out first:
 *
 *   · more pins than rows — the extra pins keep their pictogram and open the
 *     map-only card, under the group's primary chip. They are drawn on the plan
 *     either way, so hiding them would only make the map lie.
 *   · more rows than pins — the extra rows are simply unreachable from the map
 *     (국내선 3F alone lists 16 airline counters against 9 기타 pictograms).
 *     Nothing is invented to carry them.
 */
export function assignFacilities<T extends PinLike>(
  terminal: string,
  floor: string,
  pins: readonly T[],
): Array<AssignedPin<T>> {
  const rows = facilitiesOn(terminal, floor);
  const taken = new Set<AirportFacility>();
  const out: Array<AssignedPin<T>> = [];

  // Pass 1 — pins that name their row. Done first so a named pin always wins its
  // row, whatever position the ordering would otherwise have given it away to.
  const named = new Map<T, AirportFacility>();
  for (const pin of pins) {
    if (!pin.shop) continue;
    const row = rows.find((f) => f.name.ko === pin.shop && !taken.has(f));
    if (row) {
      taken.add(row);
      named.set(pin, row);
    }
  }

  // Pass 2 — deal each group's remaining rows to its remaining pins, in order.
  for (const [pinCategory, categories] of Object.entries(GROUPS)) {
    const queue = rows.filter((f) => !taken.has(f) && categories.includes(f.category.ko));
    let next = 0;
    for (const pin of pins) {
      if (pin.category !== pinCategory || named.has(pin)) continue;
      const row = queue[next];
      if (row) {
        next += 1;
        taken.add(row);
        out.push({ pin, chip: row.category.ko, facility: row });
      } else {
        out.push({ pin, chip: fallbackChip(pinCategory) });
      }
    }
  }

  // Pass 3 — the named pins, and the pictogram-only pins the sheet says nothing
  // about (화장실 and friends), which stay on their own chip.
  for (const pin of pins) {
    const row = named.get(pin);
    if (row) out.push({ pin, chip: row.category.ko, facility: row });
    else if (!GROUPS[pin.category]) out.push({ pin, chip: pin.category });
  }

  return out;
}
