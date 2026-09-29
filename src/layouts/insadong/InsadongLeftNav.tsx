import { iconUrl } from '@renderer/assets/icons/insadong';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import styles from './InsadongLeftNav.module.css';

interface InsadongLeftNavProps {
  onHome: () => void;
  /** Back chevron handler; falls back to onHome when omitted. */
  onBack?: () => void;
}

/**
 * ♿ low-reach glyph — the supplied 인사동 artwork, inlined rather than shipped as
 * an asset file.
 *
 * Inline because the button INVERTS: an `<img>` renders a fixed picture, and the
 * source art bakes its own #FF6C52 disc, so neither the on-state swap nor the
 * layout's own `--kiosk-primary` could reach it. (제주's `ico-accessibility` has
 * the same problem for the opposite reason — it is baked at #FF7F0F and embeds
 * the figure as a raster pattern, so next to 인사동's `home-btn` / `back-arrow`
 * it was visibly the wrong orange.) The paths below are the artwork verbatim;
 * only the two fills are lifted out.
 *
 * `on` mirrors the rail's two existing styles: off is a filled disc with a white
 * figure (like home), on is a white disc with a primary ring and figure (like
 * back), which is what marks the toggle as active.
 */
/** The supplied artwork's disc — a soft-cornered blob, not a true circle. */
const DISC_PATH =
  'M39.7548 0H45.3008C45.6161 0.189806 46.1764 0.13434 46.5524 0.166014C51.722 0.601601 56.8441 2.10458 61.5034 4.40641C71.7701 9.53951 79.5353 18.5928 83.0452 29.5214C84.0089 32.4719 84.6381 35.5971 84.8664 38.7091C84.8921 39.0568 84.785 39.4784 85 39.7602V45.5168C84.8597 45.687 84.907 46.1438 84.8821 46.3851C84.6381 48.6979 84.3102 51.042 83.6843 53.2869C82.9304 56.0909 81.9103 58.8164 80.6384 61.4267C74.8314 73.0576 64.0517 81.4177 51.3416 84.1475C50.0497 84.414 47.3059 84.7037 46.3805 85H38.8126C37.7229 84.5891 36.0969 84.5908 34.9134 84.3633C19.1648 81.337 6.50493 70.28 1.79896 54.8757C1.34331 53.3842 0.929206 51.8797 0.656508 50.3423C0.546538 49.7223 0.131151 45.7104 0 45.5169V39.559C0.160354 39.3563 0.0834386 38.538 0.140157 38.1096C0.357782 36.4663 0.607482 34.8453 0.957188 33.2256C4.39666 17.8312 16.0671 5.60079 31.2836 1.44415C33.3445 0.878048 35.4482 0.481082 37.5738 0.257214C38.0099 0.208674 39.5062 0.193509 39.7548 0Z';

/** Arm/leg, wheel arc and head — the white figure, in drawing order. */
const FIGURE_PATHS = [
  'M41.2337 25.5923C41.2672 25.5869 41.3007 25.5822 41.3344 25.5783C43.7011 25.3075 44.9989 26.838 46.4876 28.3325L49.8726 31.7222C50.4874 32.3443 51.4053 33.3448 52.0433 33.8477C55.312 33.9941 58.8219 33.7722 62.1117 33.8828C63.4206 33.9268 64.3589 34.133 65.275 35.1602C66.069 36.0369 66.5141 37.0843 66.4373 38.2832C66.3547 40.0251 64.8991 41.7688 63.1299 42.0102C61.2101 42.2721 59.085 42.1239 57.137 42.143C54.9182 42.1143 52.6958 42.2208 50.4784 42.1261C48.5715 42.0446 47.9559 41.638 46.7327 40.2641L46.7448 48.322C49.0781 48.2481 51.567 48.3514 53.9192 48.3163C55.5088 48.3414 57.099 48.2657 58.6875 48.3269C61.5378 48.4369 62.4251 51.2875 63.3689 53.4089L65.4093 57.9966C66.5055 60.6244 67.817 63.2145 68.8671 65.8324C69.7785 68.2617 68.3661 70.3696 66.092 71.211C64.6715 71.7365 62.5869 71.0254 61.765 69.8025C60.8672 68.4668 60.1207 66.432 59.431 64.9145C58.6408 63.1922 57.8627 61.4643 57.0969 59.7309C56.6441 58.711 56.108 57.5805 55.7466 56.5366L47.5253 56.5701C43.3748 56.577 38.6574 57.1686 37.2164 51.8718C36.7806 50.2699 36.9876 47.6047 36.9886 45.8524L36.9935 38.1919L36.9956 33.3275C36.99 29.4714 36.8615 26.8501 41.2337 25.5923Z',
  'M31.0895 35.0432C31.7796 34.9714 32.2554 35.0257 32.8343 35.4241C33.3471 35.7777 33.6984 36.3206 33.8109 36.9332C34.1897 39.0281 31.9548 39.5325 30.4633 40.1189C18.6868 44.7487 17.0031 60.7993 27.5202 67.9081C33.371 71.8845 41.1566 71.4657 46.5469 66.8844C47.2363 66.2983 47.8793 65.6597 48.4703 64.9744C49.6023 63.6424 50.908 60.693 53.1216 62.3758C54.9668 63.7787 53.8529 65.509 52.808 66.9682C49.8397 70.8105 46.1958 73.4463 41.4897 74.6107C30.1854 77.4912 18.7055 70.466 16.3083 58.9508C15.4422 54.7901 15.842 50.944 17.4237 46.9821C19.6675 41.3622 25.0949 36.3797 31.0895 35.0432Z',
  'M41.4852 9.77592C44.6097 9.46722 47.3942 11.7465 47.7089 14.8704C48.0235 17.9943 45.7495 20.7832 42.6262 21.1038C39.4946 21.4252 36.6965 19.1438 36.381 16.0115C36.0655 12.8792 38.3523 10.0855 41.4852 9.77592Z',
];

function AccessibilityIcon({ on }: { on: boolean }): JSX.Element {
  const disc = on ? '#ffffff' : 'var(--kiosk-primary)';
  const ink = on ? 'var(--kiosk-primary)' : '#ffffff';
  /* The ON ring is the disc's OWN outline drawn again, shrunk about the centre
     so the whole stroke lands inside the 85 box. A stroke on the full-size path
     would be half-clipped by the viewBox everywhere the blob meets its edge. */
  const k = 0.93;
  const inset = (85 * (1 - k)) / 2;
  return (
    <svg viewBox="0 0 85 85" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d={DISC_PATH} fill={disc} />
      {on && (
        <path
          d={DISC_PATH}
          fill="none"
          stroke="var(--kiosk-primary)"
          strokeWidth={4.5 / k}
          transform={`translate(${inset} ${inset}) scale(${k})`}
        />
      )}
      {FIGURE_PATHS.map((d) => (
        <path key={d.slice(0, 24)} d={d} fill={ink} />
      ))}
    </svg>
  );
}

/**
 * Sub-page left nav shared across every Insadong screen — home, back and the
 * ♿ low-reach toggle, 85×85 with a 35px gap (120px pitch), at left 48 / top 2043
 * — see InsadongLeftNav.module.css for why those two numbers moved.
 *
 * The ♿ button is NOT in the 인사동 리뉴얼 Figma frames; it is here for parity with
 * 제주, whose rail carries the same three (JejuPageFrame: home y2043, back y2163,
 * ♿ y2283). It drives the SAME {@link useAccessibilityStore} state 제주 uses, so
 * the mode follows a visitor across layouts and the idle reset clears it in one
 * place. 언어선택 is the first frame that restacks (7574:70736): the mode bar,
 * the promo under it, then the header and the list. Other pages still keep
 * their ordinary layout until their own frames arrive.
 */
export function InsadongLeftNav({ onHome, onBack }: InsadongLeftNavProps): JSX.Element {
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const toggleLowReach = useAccessibilityStore((s) => s.toggleLowReach);

  return (
    <div className={styles.leftNav}>
      <button type="button" className={styles.leftNavBtn} onClick={onHome} aria-label="홈으로">
        {iconUrl('home-btn') && <img src={iconUrl('home-btn')} alt="" draggable={false} />}
      </button>
      <button type="button" className={styles.leftNavBtn} onClick={onBack ?? onHome} aria-label="뒤로">
        {iconUrl('back-arrow') && <img src={iconUrl('back-arrow')} alt="" draggable={false} />}
      </button>
      <button
        type="button"
        className={styles.leftNavBtn}
        onClick={toggleLowReach}
        aria-label="저상 화면"
        aria-pressed={lowReach}
      >
        <AccessibilityIcon on={lowReach} />
      </button>
    </div>
  );
}
