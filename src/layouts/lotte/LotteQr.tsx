/**
 * The red-ringed QR box the new 롯데 screens share. A live QR once its link exists (lotteLinks.ts);
 * until then, the Figma artwork — so a visitor is never sent to a page that is not there.
 */
import { QRCodeSVG } from 'qrcode.react';
import { lotteIconUrl } from '@renderer/assets/icons/lotte';
import ui from './lotteUi.module.css';

export function LotteQr({ value, className }: { value: string | null; className?: string }): JSX.Element {
  return (
    <div className={`${ui.qrBox} ${className ?? ''}`}>
      {value ? (
        <QRCodeSVG value={value} level="M" />
      ) : (
        <img src={lotteIconUrl('qr-placeholder')} alt="" draggable={false} />
      )}
    </div>
  );
}
