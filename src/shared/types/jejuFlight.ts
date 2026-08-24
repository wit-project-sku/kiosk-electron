/**
 * 제주공항 운항 보드 rows, as the main-process KAC feed hands them over.
 * The renderer maps `status` / `kind` through `normalizeDeparture` /
 * `normalizeArrival` — keep those strings raw here so the mapping is the
 * single source of truth.
 */
export interface RawJejuFlightBase {
  /** Stable list key (fid + 편명 + 시각). Flight number alone is not unique. */
  id: string;
  flightNo: string;
  /** Published time, `HH:mm`. */
  scheduledTime: string;
  /** Revised time, `HH:mm`, only when the airport has re-timed the flight. */
  estimatedTime?: string;
  airline: string;
  /** Feed string: `국내`/`국제`/`D`/`I`/`국내선`/`국제선`. */
  kind?: string;
  /** Feed 현황 (`rmkKor`). Empty → blank cell. */
  status?: string;
}

export interface RawJejuDeparture extends RawJejuFlightBase {
  destination: string;
  gate: string;
}

export interface RawJejuArrival extends RawJejuFlightBase {
  origin: string;
  belt: string;
}

/** Cached board snapshot from 한국공항공사 실시간 항공기 운항정보. */
export interface JejuFlightSnapshot {
  fetchedAt: string;
  departures: RawJejuDeparture[];
  arrivals: RawJejuArrival[];
}
