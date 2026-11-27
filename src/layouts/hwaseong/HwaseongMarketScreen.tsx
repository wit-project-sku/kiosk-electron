import type { KioskController } from '@renderer/hooks/useKioskController';
import { HwaseongMarketList, type RegionTab } from './HwaseongMarketList';

/**
 * 전국시장 — Figma 7956:62204's ten region tabs (서울시 … 제주도, two rows of
 * five). The sheet also lists markets in the metropolitan cities, which the
 * frame has no tab for; each sits under the 도 around it so none drop out.
 */
const REGION_TABS: RegionTab[] = [
  { provinces: ['서울'], ko: '서울시' },
  { provinces: ['경기도', '인천'] },
  { provinces: ['강원도'] },
  { provinces: ['충청북도'] },
  { provinces: ['충청남도', '대전', '세종'] },
  { provinces: ['경상북도', '대구'] },
  { provinces: ['경상남도', '부산', '울산'] },
  { provinces: ['전라북도'] },
  { provinces: ['전라남도', '광주'] },
  { provinces: ['제주도'] },
];

export function HwaseongMarketScreen({ controller }: { controller: KioskController }): JSX.Element {
  return <HwaseongMarketList controller={controller} title="전국시장" tabs={REGION_TABS} />;
}
