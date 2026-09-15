/**
 * 베리어프리 (♿ low-reach) chrome for the Insadong kiosk, following the 제주
 * low-reach shape (JejuPageFrame / JejuHome): the brand-colour mode bar at y0,
 * the 573px promo banner flush under it, and the page itself moved down so its
 * header lands under the banner — every touch target sits lower for a seated
 * visitor.
 *
 * Toggled by the ♿ button on the left rail (InsadongLeftNav); the idle reset in
 * useKioskController turns it off for the next visitor.
 */
import type { CSSProperties } from 'react';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import type { Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { useLanguageStore } from '@renderer/store/languageStore';
import { LOW_REACH_BANNER_HEIGHT, MODE_BAR_HEIGHT, modeBarVars } from '../jeju/lowReach';
import styles from './InsadongLowReach.module.css';

/** Fallback — sheet `BarrierFree_Title` (Localization_Insa has no row yet). */
const BARRIER_FREE: Partial<Record<Lang, string>> = {
  ko: '지금은 배리어프리 모드입니다.',
  en: 'Currently in Barrier-Free Mode.',
  ja: '現在はバリアフリーモードです。',
  zh: '现在是无障碍模式。',
  vi: 'Hiện tại là chế độ không rào cản.',
  th: 'ขณะนี้อยู่ในโหมดไร้อุปสรรค',
  ru: 'В настоящее время используется безбарьерный режим.',
  id: 'Saat ini dalam mode bebas hambatan.',
};

/** Artboard height — KioskArtboard is 2160×3840. */
const ARTBOARD_HEIGHT = 3840;

/**
 * Where a shifted sub-page's own y0 lands: the whole 700px header sits flush
 * under the banner (bar + 573), exactly as JejuPageFrame's `.rootLowReach`
 * places 제주's — so the INSADONG / date row keeps the header's own 125px of
 * air below the banner instead of touching it.
 */
export const LOW_REACH_PAGE_TOP = MODE_BAR_HEIGHT + LOW_REACH_BANNER_HEIGHT;

/**
 * The box a sub-page renders into while ♿ is on.
 *
 * Moved with `top`, not `transform`, so `position: fixed` children (the image
 * lightbox) still resolve against the artboard. The height decides where the
 * page's `bottom:` rules land: a page with a bottom promo gets 573 extra, which
 * pushes that promo off the artboard (the banner now sits at the top) while its
 * scroll area still ends at the artboard foot; a page that runs to `bottom: 0`
 * gets exactly the room left, so its last card stays reachable.
 */
export function lowReachPageBox(hasBottomBanner: boolean): CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    top: LOW_REACH_PAGE_TOP,
    width: 2160,
    height: ARTBOARD_HEIGHT - LOW_REACH_PAGE_TOP + (hasBottomBanner ? LOW_REACH_BANNER_HEIGHT : 0),
  };
}

interface Props {
  /** Tap on the promo banner — the same AR 한복 entry the bottom banners open. */
  onBanner: () => void;
}

/** Mode bar + promo banner pinned to the top of the artboard. */
export function InsadongLowReachTop({ onBanner }: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage) as Lang;
  const banner = useRotatingBanner();

  return (
    <div className={styles.top} style={modeBarVars}>
      <div className={styles.modeBar}>{sheetText('BarrierFree_Title', lang, BARRIER_FREE)}</div>
      <button type="button" className={styles.hero} onClick={onBanner} aria-label="가상 한복 체험">
        {banner && <img src={banner} alt="" className={styles.heroImg} draggable={false} />}
      </button>
    </div>
  );
}
