import type { KioskScreenId } from '@shared/types/kiosk';
import type { Rect } from '../components/KioskScreenImage';

export interface ScreenAsset {
  /** Flattened Figma background. */
  image: string;
  /** Tap zones that return to the home screen (overrides the default set). */
  back?: Rect[];
}

/**
 * Default back affordances on Insadong content screens: the header home button
 * (top-left), the header back chevron (top-right), and the left-edge floating
 * nav. Values are % of the 2160×3840 artboard — tune with the `debug` overlay.
 */
export const DEFAULT_BACK_RECTS: Rect[] = [
  { x: 4, y: 6.5, w: 14, h: 7.5 }, // home button (top-left)
  { x: 81, y: 6.5, w: 14, h: 7.5 }, // back chevron (top-right)
  { x: 0, y: 49, w: 7, h: 10 }, // left-edge floating nav
];

/**
 * Flattened-frame backgrounds for any Insadong screen not yet rebuilt as a real
 * component. Every primary screen now has a dedicated component (see
 * `InsadongKiosk`), so this is empty; `InsadongScreen` falls back to a themed
 * "준비 중입니다" placeholder for the remaining stubs (kdrama/restroom/etc).
 */
export const INSADONG_SCREENS: Partial<Record<KioskScreenId, ScreenAsset>> = {};
