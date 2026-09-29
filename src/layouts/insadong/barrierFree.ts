import type { CSSProperties } from 'react';
import type { Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';

/**
 * ♿ bar copy — Figma 7574:67299 / 7574:71491. Sheet `BarrierFree_Title` wins
 * per language once Localization_Insa carries the row.
 */
const BARRIER_FREE: Partial<Record<Lang, string>> = {
  ko: '지금은 베리어프리 모드입니다.',
  en: 'Currently in Barrier-Free Mode.',
  ja: '現在はバリアフリーモードです。',
  zh: '现在是无障碍模式。',
  vi: 'Hiện tại là chế độ không rào cản.',
  th: 'ขณะนี้อยู่ในโหมดไร้อุปสรรค',
  ru: 'В настоящее время используется безбарьерный режим.',
  id: 'Saat ini dalam mode bebas hambatan.',
};

/** Height of the coral bar (7574:67298). Full-bleed, pinned to y0. */
export const MODE_BAR_HEIGHT = '145.759px';

export function barrierFreeTitle(lang: Lang): string {
  return sheetText('BarrierFree_Title', lang, BARRIER_FREE);
}

/**
 * ♿ stack for 상세 — the bar, the promo flush under it, then the header.
 *
 * The SAME shape as `.shiftBanner` in barrierFree.module.css, which is what
 * 이벤트 and 위드마켓 already use, so every ♿ page that carries a promo now
 * carries it in the same place. 상세 used to be the exception: 7574:71342 draws
 * its promo at the foot (y3267) and this used to match the frame, which left a
 * visitor in ♿ with the promo out of reach at the bottom of one screen and
 * under their hand at the top of the next.
 *
 * Costs the card nothing. `.content` trades its 573px bottom reserve for the
 * 573 the header gains, so the detail card keeps exactly the 2421.24px it had.
 */
export const DETAIL_LOW_REACH_STYLE = {
  '--insa-mode-bar': MODE_BAR_HEIGHT,
  '--insa-header-shift': `calc(${MODE_BAR_HEIGHT} + 573px)`,
  '--insa-banner-top': MODE_BAR_HEIGHT,
  '--insa-banner-reserve': '0px',
} as CSSProperties;
