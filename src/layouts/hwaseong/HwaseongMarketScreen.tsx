import type { KioskController } from '@renderer/hooks/useKioskController';
import { HwaseongMarketList } from './HwaseongMarketList';

/** 전국시장 — metro cities (시/광역시) + 경기도·제주도, from the sheet. */
const CITY_TABS = ['서울', '인천', '대전', '대구', '부산', '세종', '광주', '울산', '경기도', '제주도'];

export function HwaseongMarketScreen({ controller }: { controller: KioskController }): JSX.Element {
  return <HwaseongMarketList controller={controller} title="전국시장" provinces={CITY_TABS} />;
}
