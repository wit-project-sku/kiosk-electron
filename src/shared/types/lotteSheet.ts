/** Eight-language cell group, as the 롯데 sheet writes it (`_Kr` … `_Id`). Missing → ''. */
export interface LotteText {
  ko: string;
  en: string;
  ja: string;
  zh: string;
  vi: string;
  th: string;
  ru: string;
  id: string;
}

/**
 * One FacilityData_* row (시설안내 · 화장실). Produced by the build-time generator
 * (scripts/sync-sheet.mjs → lotteFacilities.generated.ts) and by the launch parser
 * (LotteSheetDataParser) — the same shape from both.
 */
export interface LotteFacility {
  /** ShopID column. */
  id: number;
  /** NO column, e.g. '롯데월드몰=1-화장실=01'. */
  no: string;
  /** The NO column's middle part, e.g. '1-화장실' — the list's category tab. */
  group: string;
  name: LotteText;
  category: LotteText;
  /** Ends with the floor ('롯데월드몰 B1F'). */
  location: LotteText;
  hours: string;
  tel: string;
  description: LotteText;
}
