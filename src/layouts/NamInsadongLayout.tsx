import { memo } from 'react';
import { InsadongKiosk } from './insadong/InsadongKiosk';

/**
 * Layout B — 남인사마당 (W003). Figma `인사>홈-02` (5827:164990), which differs from
 * W001/W002's `인사>홈-01` in exactly one cell: grid slot 3 is 위드마켓, not 인사랑.
 *
 * W003 is its own layout family so it can diverge into a fully separate design
 * later WITHOUT touching kiosk routing (resolveLayout maps NAM_INSADONG here).
 * For now it renders the approved Insadong kiosk — W003's per-location
 * differences (위드마켓 tile, card terminal, 8 languages) are already driven by
 * kioskId via getKioskLocation, so this preserves the current approved UI.
 *
 * To build W003's separate design later, replace the body below with the new
 * W003 components; nothing else needs to change.
 */
export const NamInsadongLayout = memo(function NamInsadongLayout(): JSX.Element {
  return <InsadongKiosk />;
});
