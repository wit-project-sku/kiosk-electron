/**
 * 제주국제여객터미널 (W007) 선박 운항 보드 rows — jeju.ferry.or.kr terminal board feed.
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

/** Cached board snapshot from the jeju.ferry.or.kr terminal board. */
export interface JejuSailingSnapshot {
  fetchedAt: string;
  departures: RawJejuSailing[];
  arrivals: RawJejuSailing[];
}
