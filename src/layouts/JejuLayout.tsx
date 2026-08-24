import { memo } from 'react';
import { JejuKiosk } from './jeju/JejuKiosk';

/**
 * Layout for the two 제주 venues — W006 제주국제공항 and W007 제주국제여객터미널.
 * They run one design, so both resolve here; see KioskLayoutId.
 * Screens are wired in JejuKiosk as each Figma frame is built.
 */
export const JejuLayout = memo(function JejuLayout(): JSX.Element {
  return <JejuKiosk />;
});
