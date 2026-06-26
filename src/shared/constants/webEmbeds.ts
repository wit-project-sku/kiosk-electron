/**
 * URLs for screens that embed an existing website inside the kiosk via a
 * <webview>. The sites render into the body region (below InsadongHeader,
 * above the bottom banner — 1820×2250 artboard px).
 *
 * Two location variants exist:
 *   payment있는 곳 — kiosks with payment terminals (witteria / scanner=true)
 *   payment없는 곳 — kiosks without payment (insarang.kr / scanner=false)
 *
 * Switch by swapping the commented line below each key.
 */
export const WEB_EMBED_URLS = {
  /** 위드마켓 (WITStore / Goods) */
  market: 'https://witteria.com/#/kiosk/store',
  // market: 'https://insarang.kr/',               // payment없는 곳

  /** 인사동 이벤트 — event listing */
  events: 'https://withevent.kr/kiosk/events?region=jongno&category=ALL&page=1',
  // events (오색시장): 'https://withevent.kr/kiosk/events?region=Osansi'
  // events (화성휴게소): 'https://withevent.kr/kiosk/events?region=hwaseong&category=ALL&page=1'

  /** TAX FREE — LinkTaxFree automated refund terminal */
  taxfree: 'https://wit-test.linktaxfree.com/?sign=8e9a8752-3190-4637-87b7-972ccca93c65&scanner=true',
  // taxfree: 'https://wit-test.linktaxfree.com/?sign=8e9a8752-3190-4637-87b7-972ccca93c65&scanner=false', // payment없는 곳
} as const;

/** Body-only render area for embedded sites, in artboard px (2160×3840). */
export const WEB_EMBED_SIZE = { width: 1820, height: 2250 } as const;
