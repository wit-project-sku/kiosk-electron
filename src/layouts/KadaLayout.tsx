import { memo } from 'react';
import { KadaKiosk } from './kada/KadaKiosk';

/**
 * Layout for W202 — Korea-ASEAN Digital Academy (Vietnam Chapter, PTIT Hà Nội).
 *
 * The fleet's first non-Korean deployment and by far its smallest: five screens,
 * two languages (EN/VN), and none of the CMS-driven content the domestic kiosks
 * run on. Screens are wired in KadaKiosk.
 */
export const KadaLayout = memo(function KadaLayout(): JSX.Element {
  return <KadaKiosk />;
});
