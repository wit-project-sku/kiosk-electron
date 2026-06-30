import { memo } from 'react';
import { HwaseongKiosk } from './hwaseong/HwaseongKiosk';

/**
 * Layout for W005 — 화성휴게소.
 * Screens are wired in HwaseongKiosk once the Figma design is finalised.
 */
export const HwaseongLayout = memo(function HwaseongLayout(): JSX.Element {
  return <HwaseongKiosk />;
});
