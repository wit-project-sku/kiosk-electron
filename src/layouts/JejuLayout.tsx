import { memo } from 'react';
import { JejuKiosk } from './jeju/JejuKiosk';

/**
 * Layout for W006 — 제주공항.
 * Screens are wired in JejuKiosk as each Figma frame is built.
 */
export const JejuLayout = memo(function JejuLayout(): JSX.Element {
  return <JejuKiosk />;
});
