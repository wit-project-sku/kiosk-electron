/**
 * 제주국제여객터미널 (W007) 선박 운항 보드 rows — KOMSA MTIS 연안여객선 feed.
 * The renderer maps `status` / `port` through `normalizeSailing` in jejuSailing.ts.
 */
export interface RawJejuSailing {
  id: string;
  scheduledTime: string;
  estimatedTime?: string;
  duration: string;
  shipName: string;
  route: string;
  place: string;
  /** `국제항` / `연안항` — which of 제주항's two passenger terminals. */
  port?: string;
  status?: string;
  note?: string;
}

/** Cached board snapshot from KOMSA oprt-schd-info. */
export interface JejuSailingSnapshot {
  fetchedAt: string;
  departures: RawJejuSailing[];
  arrivals: RawJejuSailing[];
}
