/**
 * Foreign-exchange snapshot, sourced from the Korea Eximbank open API in the
 * main process and cached locally. Never fetched from the renderer (network
 * stays in main). Rates refresh on a schedule; the official rate is the
 * 매매기준율 (deal_bas_r).
 */
export interface ExchangeRate {
  /** Currency unit code from the API, e.g. "USD", "JPY(100)", "CNH". */
  code: string;
  /** Korean currency name, e.g. "미국 달러". */
  name: string;
  /** 매매기준율 as a number (commas stripped), e.g. 1371.5. */
  rate: number;
  /** 매매기준율 as the API's comma-formatted string, e.g. "1,371.5". */
  rateText: string;
}

export interface ExchangeSnapshot {
  /** All currencies returned for the resolved business day. */
  rates: ExchangeRate[];
  /** The YYYYMMDD search date that actually returned data. */
  searchDate: string;
  /** ISO timestamp of when this snapshot was fetched. */
  fetchedAt: string;
}
