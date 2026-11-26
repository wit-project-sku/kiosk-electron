import { memo } from 'react';
import { LotteKiosk } from './lotte/LotteKiosk';

/** Layout for the three 롯데 venues (W012~W014). They run one design. */
export const LotteLayout = memo(function LotteLayout(): JSX.Element {
  return <LotteKiosk />;
});
