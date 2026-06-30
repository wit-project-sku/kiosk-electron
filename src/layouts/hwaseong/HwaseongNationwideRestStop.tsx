import type { KioskController } from '@renderer/hooks/useKioskController';
import { HwaseongMarketList } from './HwaseongMarketList';

/** 전국휴게소 — nationwide markets in the provinces (도), from the sheet. */
const DO_TABS = ['경기도', '강원도', '충청북도', '충청남도', '경상북도', '경상남도', '전라북도', '전라남도', '제주도'];

export function HwaseongNationwideRestStop({ controller }: { controller: KioskController }): JSX.Element {
  return <HwaseongMarketList controller={controller} title="전국 휴게소" provinces={DO_TABS} />;
}
