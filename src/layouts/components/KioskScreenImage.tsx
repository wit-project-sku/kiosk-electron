import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import styles from './KioskScreenImage.module.css';

/** Native kiosk artboard size (portrait 4K) — every Figma screen is 2160×3840. */
export const ARTBOARD_WIDTH = 2160;
export const ARTBOARD_HEIGHT = 3840;

/**
 * The ONE kiosk artboard wrapper. The artboard is a literal {@link ARTBOARD_WIDTH}×
 * {@link ARTBOARD_HEIGHT} (2160×3840) canvas, uniformly scaled to fit the window.
 * So **1 CSS px = 1 Figma px** everywhere inside — paste exact Figma values
 * directly (px), and cqw/cqh also resolve to 21.6px / 38.4px. Used once at the
 * router level; screens are just content that fills it (position:absolute;inset:0).
 */
export function KioskArtboard({ children }: { children?: ReactNode }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (): void => {
      const scale = Math.min(window.innerWidth / ARTBOARD_WIDTH, window.innerHeight / ARTBOARD_HEIGHT);
      el.style.setProperty('--kiosk-scale', String(scale));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div className={styles.viewport}>
      {/* `data-kiosk-artboard` marks the kiosk's own design space. 제주's keypad
          navigation scopes its search for landing spots to it, so the pad can
          never walk into the app-level chrome mounted beside the layout in
          App.tsx (KioskSwitcher's dev drawer). Purely a marker — no styling
          hangs off it. */}
      <div ref={ref} className={styles.artboard} data-kiosk-artboard>
        {children}
      </div>
    </div>
  );
}

interface KioskScreenImageProps {
  /** Full-bleed background exported from the Figma frame. */
  image: string;
  alt?: string;
  /** Absolutely-positioned overlay nodes (hotspots, live text, masks). */
  children?: ReactNode;
}

/**
 * Content for a flattened-image screen: a full-bleed background plus an overlay
 * coordinate space (percentages of the artboard) for {@link Hotspot}/{@link Region}.
 * Renders inside the shared {@link KioskArtboard}, so no wrapper of its own.
 */
export function KioskScreenImage({ image, alt = '', children }: KioskScreenImageProps): JSX.Element {
  return (
    <>
      <img className={styles.bg} src={image} alt={alt} draggable={false} />
      <div className={styles.overlay}>{children}</div>
    </>
  );
}

/** Position/size of an overlay element as a percentage of the artboard. */
export interface Rect {
  /** Left edge, % of artboard width (0–100). */
  x: number;
  /** Top edge, % of artboard height (0–100). */
  y: number;
  /** Width, % of artboard width. */
  w: number;
  /** Height, % of artboard height. */
  h: number;
}

function rectStyle(rect: Rect): CSSProperties {
  return {
    position: 'absolute',
    left: `${rect.x}%`,
    top: `${rect.y}%`,
    width: `${rect.w}%`,
    height: `${rect.h}%`,
  };
}

interface HotspotProps {
  rect: Rect;
  label: string;
  onClick: () => void;
  /** Set true while tuning to see the tap zone outlined. */
  debug?: boolean;
}

/** Transparent, accessible touch target placed over a baked icon/region. */
export function Hotspot({ rect, label, onClick, debug = false }: HotspotProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={debug ? `${styles.hotspot} ${styles.hotspotDebug}` : styles.hotspot}
      style={rectStyle(rect)}
    />
  );
}

interface RegionProps {
  rect: Rect;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** When provided, the region becomes tappable (e.g. an input field). */
  onClick?: () => void;
}

/** Overlay container (live text, masks, or a tappable field) at a fixed rect. */
export function Region({ rect, children, className, style, onClick }: RegionProps): JSX.Element {
  return (
    <div
      className={className}
      style={{ ...rectStyle(rect), ...style }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {children}
    </div>
  );
}
