import { memo } from 'react';
import { InsadongKiosk } from './insadong/InsadongKiosk';

/**
 * Layout A — 북인사마당 (W001) · 인사동센터 (W002).
 *
 * Image-backed kiosk experience built from the canonical `인사>…` Figma frames.
 * Navigation, analytics, theming, and the AI 한복 photo flow follow the shared
 * kiosk patterns (see {@link InsadongKiosk}).
 */
export const InsadongLayout = memo(function InsadongLayout(): JSX.Element {
  return <InsadongKiosk />;
});
