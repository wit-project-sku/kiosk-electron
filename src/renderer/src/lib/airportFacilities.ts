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
 * ── The chip row is the sheet's, and ONLY the sheet's (2026-09-02) ──────────
 * HELP_CHIPS used to be a hand-written list of fifteen: the sheet's ten
 * categories plus five pictogram-only chips (화장실, 흡연실, 유아휴게실, 교통약자
 * 편의시설, 유실물센터) the shop list has never carried. It is now derived from
 * AirportFacilityData_Jeju outright, so the sheet alone decides what chips
 * exist, what they are called in eight languages, and in what order.
 *
 * The five are GONE, deliberately, and at a cost worth stating: 36 of the 148
 * pins on the floor plans carry one of those categories, and with no chip to
 * light them they no longer draw. Their coordinates are LEFT IN PINS rather than
 * deleted — they are the plans' own geometry, they cost nothing while inert, and
 * they light again the day the sheet grows a matching category and GROUPS gains
 * a row for it. The home screen's 화장실 button no longer names a chip either; it
 * opens this page on whatever the sheet leads with (see JejuKiosk).
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

/** Sheet-category label lookup, built once from the first row carrying each. */
const CHIP_LABELS: Record<string, LangText> = {};
for (const f of AIRPORT_FACILITIES_JEJU) {
  CHIP_LABELS[f.category.ko] ??= f.category;
}

/**
 * The chip row — every BaseCategory AirportFacilityData_Jeju uses, and nothing
 * else. Ten today, 5 per line over 2 lines.
 *
 * ORDER IS THE SHEET'S: first appearance going down its rows, which is the order
 * of its own NO column. That makes chip order something an operator can change
 * by moving a row, with no release — the same bargain as the labels — and it is
 * why no ordering is imposed here. A category typed into the sheet becomes a
 * chip, translated, at the next sync; one deleted from every row stops being one.
 *
 * The one thing a new category still needs from code is a GROUPS entry saying
 * which pictogram stands for it. Without that its rows sit on no pin — which is
 * what the startup warning below is for.
 */
export const HELP_CHIPS: readonly string[] = Object.keys(CHIP_LABELS);

/**
 * A BaseCategory the sheet uses that no pin group routes.
 *
 * This is the one way the sheet can now grow that the screen cannot absorb on
 * its own. A new category arrives with its eight translations AND its chip for
 * free — HELP_CHIPS is built from the sheet — but until GROUPS says which
 * pictogram stands for it, that chip lights nothing at all. The failure is
 * silent on the panel, so it is said out loud at startup instead.
 */
const routed = new Set(Object.values(GROUPS).flat());
const unreachable = HELP_CHIPS.filter((ko) => !routed.has(ko));
if (unreachable.length > 0) {
  console.warn(
    '[airportFacilities] AirportFacilityData_Jeju categories no pictogram stands for:',
    unreachable.join(', '),
    '— add each to a GROUPS entry.',
  );
}

/**
 * What a chip is called on screen.
 *
 * A sheet category is localized BY THE SHEET, which is the point of keying the
 * chips off it — a new category appears translated the day it is typed in, with
 * nothing to add here. Every chip is a sheet category now, so the FACILITY_LABELS
 * fallback is only reached by a caller passing something that is not a chip (a
 * stale `initialCategory`, say); it is kept for exactly that.
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
