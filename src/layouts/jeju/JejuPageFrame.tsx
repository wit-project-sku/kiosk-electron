/**
 * Shared frame for every 제주공항 sub-page: background, header, left nav and
 * bottom banner. Screens supply only their own body.
 *
 * Osan and Hwaseong repeat this chrome in each screen file; 제주 has it once so
 * the ~20 sub-pages still to build can't drift apart — and so the sub-page
 * background lives in exactly one place.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { JejuHeader } from './JejuHeader';
import styles from './JejuPageFrame.module.css';

interface Props {
  controller: KioskController;
  /** Header title (Korean id — localized by JejuHeader). */
  title: string;
  /** Optional header subtitle; omitted means "use the sheet, else hide". */
  subtitle?: string;
  /** Override the back button (defaults to going home, like the other layouts). */
  onBack?: () => void;
  /**
   * Show the bottom 한복 banner. Off for pages whose content runs past y3267 —
   * the AI search page ends at y3591, so a banner would sit on top of its CTA.
   */
  showBanner?: boolean;
  /**
   * jejuIconUrl key for the bundled banner shown when the API has no active
   * one. Defaults to the 한복 promo; the search-detail page carries its own
   * (상점 검색 promo), so the artwork is per-page, not per-layout.
   */
  bannerFallback?: string;
  /**
   * jejuIconUrl key for a 2160×1181 hero banner that opens the LOW-REACH layout
   * (see .rootLowReachHero). Set it on pages too tall to shift down 573px: the
   * frame draws the hero at y0 and moves the header to y1206, and the screen
   * itself lays its body out at the coordinates its low-reach frame specifies.
   * Only consulted while ♿ is on; the standard layout never draws it.
   */
  lowReachHero?: string;
  /**
   * Low-reach only: this screen positions its own body at the coordinates its
   * low-reach frame specifies, so the frame must NOT also shift it. The header
   * and banner still move. See .rootBodyUnshifted.
   */
  lowReachSelfLayout?: boolean;
  /**
   * Draw the page banner at the top in LOW-REACH even though the standard
   * layout has none (`showBanner={false}`). 도와줘 '하영' is bannerless normally
   * but its low-reach frame opens with the 573 promo, and the header follows it
   * down exactly as it does for the pages that always carry one.
   */
  lowReachBanner?: boolean;
  /**
   * The 2026-08-26 revised low-reach shape: the promo banner disappears
   * entirely and a 113px mode bar overlays the top of the page instead. How far
   * the header and body drop varies PER PAGE (measured from each revised
   * frame, not derived): 언어선택 113/420, 검색 상세 687/687, 검색 0/0 — so the
   * offsets ride along as props. Opt-in per page while the remaining pages'
   * revised frames are still arriving; supersedes the plain re-stack where set.
   */
  lowReachModeBar?: boolean;
  /** Header offset (px) while ♿ is on with the mode-bar shape. Default 0. */
  lowReachShift?: number;
  /** Body offset (px) while ♿ is on with the mode-bar shape. Default 0. */
  lowReachBodyShift?: number;
  /**
   * Mode-bar shape only: KEEP the promo banner, drawn directly under the bar
   * (y113–686). 검색 상세 is the page that wants this — its ♿ frame's y687
   * header is exactly bar (113) + banner (573) + Figma's 1px round-up, and the
   * user confirmed the banner stays (the frame just doesn't carry the node).
   * Pages whose revised frames genuinely drop the banner (언어선택, AI 결과)
   * leave this off.
   */
  lowReachBarBanner?: boolean;
  /** Subtitle colour override — see JejuHeader. */
  subtitleColor?: string;
  /** Draw the ★ before the subtitle (WIT Store omits it). */
  subtitleStar?: boolean;
  children?: ReactNode;
}

export function JejuPageFrame({
  controller,
  title,
  subtitle,
  onBack,
  showBanner = true,
  bannerFallback = 'banner-page',
  lowReachHero,
  lowReachSelfLayout = false,
  lowReachBanner = false,
  lowReachModeBar = false,
  lowReachShift = 0,
  lowReachBodyShift = 0,
  lowReachBarBanner = false,
  subtitleColor,
  subtitleStar,
  children,
}: Props): JSX.Element {
  // Live API banner when one is active, else this page's bundled promo.
  const banner = useRotatingBanner(jejuIconUrl(bannerFallback));
  const bg = jejuIconUrl('bg-page');
  const goHome = (): void => controller.navigate('home', '홈');

  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const toggleLowReach = useAccessibilityStore((s) => s.toggleLowReach);
  /*
   * The variant re-stacks the page around the banner, so it only applies to
   * pages that HAVE one. `showBanner` is exactly the right test and not a
   * coincidence: it is switched off for the pages whose content runs past
   * y3267, and those are precisely the ones that would overflow the artboard
   * if pushed down another 573. Their low-reach frames are still to come from
   * Figma; until then they keep the standard layout and ♿ is a no-op there.
   */
  const shifted = lowReach && (showBanner || lowReachBanner);
  /* The revised re-stack: mode bar instead of any banner (see lowReachModeBar). */
  const modeBar = lowReach && lowReachModeBar;
  /* Pages that opt in via `lowReachBanner` have no banner at all normally, so
     the element itself has to appear for the low-reach layout to move it. The
     mode-bar revision drops the banner from low-reach — except on pages that
     keep it under the bar via `lowReachBarBanner`. */
  const drawBanner =
    (showBanner || (lowReach && lowReachBanner)) && (!modeBar || lowReachBarBanner);
  /* The other low-reach shape: too tall to re-stack, so the page restarts under
     a hero banner instead. Opt-in per page via `lowReachHero`. */
  const heroSrc = lowReach && lowReachHero ? jejuIconUrl(lowReachHero) : undefined;
  /* The ♿ toggle swaps to its orange active render while low-reach is on
     (Figma image 503); fall back to the idle art until the asset lands. */
  const accessibilityIcon =
    (lowReach ? jejuIconUrl('ico-accessibility-on') : undefined) ?? jejuIconUrl('ico-accessibility');

  return (
    <div
      className={[
        styles.root,
        shifted && !modeBar ? styles.rootLowReach : '',
        heroSrc ? styles.rootLowReachHero : '',
        shifted && lowReachSelfLayout ? styles.rootBodyUnshifted : '',
        lowReach ? styles.lowReachSideControls : '',
      ]
        .filter(Boolean)
        .join(' ')}
      /* Mode-bar shape offsets are per page, so they arrive as props and land
         as inline vars — inline beats every class above, which is intended. */
      style={
        modeBar
          ? ({ '--jeju-shift': `${lowReachShift}px`, '--jeju-body-shift': `${lowReachBodyShift}px` } as CSSProperties)
          : undefined
      }
    >
      <div className={styles.bgBase} />
      {bg && <img src={bg} alt="" className={styles.bgImage} draggable={false} />}

      {modeBar && <div className={styles.modeBar}>지금은 배리어프리 모드입니다.</div>}

      {heroSrc && (
        <div className={styles.hero}>
          <img src={heroSrc} alt="" className={styles.heroImg} draggable={false} />
        </div>
      )}

      <JejuHeader
        controller={controller}
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        subtitleColor={subtitleColor}
        subtitleStar={subtitleStar}
      />

      <div className={styles.body}>{children}</div>

      <div className={styles.leftNav}>
        {jejuIconUrl('nav-left') && (
          <img src={jejuIconUrl('nav-left')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button
          type="button"
          className={`${styles.leftNavZone} ${styles.leftNavHome}`}
          onClick={goHome}
          aria-label="홈"
        />
        <button
          type="button"
          className={`${styles.leftNavZone} ${styles.leftNavBack}`}
          onClick={onBack ?? goHome}
          aria-label="뒤로"
        />
      </div>
      {accessibilityIcon && (
        <button
          type="button"
          className={styles.accessibility}
          onClick={toggleLowReach}
          aria-label="저상 화면"
          aria-pressed={lowReach}
        >
          <img
            src={accessibilityIcon}
            alt=""
            className={styles.accessibilityImg}
            draggable={false}
          />
        </button>
      )}

      {drawBanner && (
        <div className={`${styles.banner} ${modeBar ? styles.bannerBelowBar : ''}`}>
          {banner && <img src={banner} alt="" className={styles.bannerImg} draggable={false} />}
        </div>
      )}
    </div>
  );
}
