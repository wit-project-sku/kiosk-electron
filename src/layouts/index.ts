import type { KioskLayoutId } from '@shared/types/kiosk';
import type { ComponentType } from 'react';
import { InsadongLayout } from './InsadongLayout';
import { NamInsadongLayout } from './NamInsadongLayout';
import { OsanLayout } from './OsanLayout';
import { HwaseongLayout } from './HwaseongLayout';
import { JejuLayout } from './JejuLayout';
import { KadaLayout } from './KadaLayout';
import { LotteLayout } from './LotteLayout';

const LAYOUTS: Record<KioskLayoutId, ComponentType> = {
  INSADONG: InsadongLayout,
  NAM_INSADONG: NamInsadongLayout,
  OSAN: OsanLayout,
  HWASEONG: HwaseongLayout,
  JEJU_AIRPORT: JejuLayout,
  // Same screens, different mascot rows — see KioskLayoutId on the split.
  JEJU_HERITAGE: JejuLayout,
  KADA: KadaLayout,
  LOTTE: LotteLayout,
};

export function resolveLayout(layout: KioskLayoutId): ComponentType {
  return LAYOUTS[layout];
}

export { InsadongLayout, NamInsadongLayout, OsanLayout, HwaseongLayout, JejuLayout, KadaLayout, LotteLayout };
