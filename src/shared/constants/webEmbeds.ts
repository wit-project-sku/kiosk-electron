import { getKioskLocation } from '@shared/config/kioskLocations';

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

  /** 기부 — WIT Global donation web app (fullscreen webview). The kiosk=1 marker
   *  tells the donation app it's embedded (enables the console-message host bridge);
   *  the app also auto-detects the Electron webview by user-agent. */
  donation: 'https://witglobaldonation.vercel.app/#/?location=insadong&kiosk=1',

  /** 인사동 이벤트 — event listing */
  events: 'https://withevent.kr/kiosk/events?region=jongno&category=ALL&page=1',
  // events (오색시장): 'https://withevent.kr/kiosk/events?region=Osansi'
  // events (화성휴게소): 'https://withevent.kr/kiosk/events?region=hwaseong&category=ALL&page=1'

  /** TAX FREE — LinkTaxFree automated refund terminal (production).
   *  Prefer taxfreeUrl(kioskId) so the right variant is chosen per kiosk; this
   *  value is the payment-terminal (TL3800) variant. */
  taxfree: 'https://wit.linktaxfree.com/?sign=7730a1b2-a16a-4801-96ea-8cba5f866c73&scanner=true',

  /** TAX FREE for kiosks WITHOUT the TL3800 payment terminal. Independently
   *  editable from `taxfree` — identical today, may diverge later. */
  taxfreeNoPayment: 'https://wit.linktaxfree.com/?sign=7730a1b2-a16a-4801-96ea-8cba5f866c73&scanner=true',
} as const;

/**
 * Resolve the TAX-FREE webview URL for a kiosk. Kiosks WITH the TL3800 payment
 * terminal (hasCardTerminal — W003/W004) use `taxfree`; kiosks WITHOUT it
 * (W001/W002/W005) use `taxfreeNoPayment`.
 */
export function taxfreeUrl(kioskId: string): string {
  return getKioskLocation(kioskId).hasCardTerminal
    ? WEB_EMBED_URLS.taxfree
    : WEB_EMBED_URLS.taxfreeNoPayment;
}

/** Body-only render area for embedded sites, in artboard px (2160×3840). */
export const WEB_EMBED_SIZE = { width: 1820, height: 2250 } as const;
