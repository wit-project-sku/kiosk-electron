import type { KioskController } from '@renderer/hooks/useKioskController';
import { SERVICE_AREAS } from '@renderer/data/serviceAreas.generated';
import { HwaseongMarketList, type RegionTab } from './HwaseongMarketList';

/**
 * 전국휴게소 — the nationwide sheet's ServiceArea tab (210 rest areas), on the
 * 전국시장 list. Until 2026-10-15 this screen listed the MARKETS: there was no
 * service-area data yet, so it borrowed 전국시장's rows under 도 tabs.
 *
 * Same ten tabs as 전국시장; the metropolitan cities sit under the 도 around
 * them, and the sheet spells 제주 "제주특별자치도".
 */
const REGION_TABS: RegionTab[] = [
  { provinces: ['서울'], ko: '서울시' },
  { provinces: ['경기도', '인천'] },
  { provinces: ['강원도', '강원특별자치도'] },
  { provinces: ['충청북도'] },
  { provinces: ['충청남도', '대전', '세종'] },
  { provinces: ['경상북도', '대구'] },
  { provinces: ['경상남도', '부산', '울산'] },
  { provinces: ['전라북도', '전북특별자치도'] },
  { provinces: ['전라남도', '광주'] },
  { provinces: ['제주도', '제주특별자치도'], ko: '제주도' },
];

export function HwaseongNationwideRestStop({ controller }: { controller: KioskController }): JSX.Element {
  return <HwaseongMarketList controller={controller} title="전국 휴게소" tabs={REGION_TABS} data={SERVICE_AREAS} />;
}
