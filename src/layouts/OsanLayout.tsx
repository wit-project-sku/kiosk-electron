import { memo } from 'react';
import { OsanKiosk } from './osan/OsanKiosk';

/**
 * Layout for W004 — 오산시 오색시장.
 * Screens are wired in OsanKiosk once the Figma design is finalised.
 */
export const OsanLayout = memo(function OsanLayout(): JSX.Element {
  return <OsanKiosk />;
});
