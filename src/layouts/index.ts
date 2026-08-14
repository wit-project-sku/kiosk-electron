import type { KioskLayoutId } from '@shared/types/kiosk';
import type { ComponentType } from 'react';
import { InsadongLayout } from './InsadongLayout';
import { NamInsadongLayout } from './NamInsadongLayout';
import { OsanLayout } from './OsanLayout';
import { HwaseongLayout } from './HwaseongLayout';
import { JejuLayout } from './JejuLayout';

const LAYOUTS: Record<KioskLayoutId, ComponentType> = {
  INSADONG: InsadongLayout,
  NAM_INSADONG: NamInsadongLayout,
  OSAN: OsanLayout,
  HWASEONG: HwaseongLayout,
  JEJU_AIRPORT: JejuLayout,
};

export function resolveLayout(layout: KioskLayoutId): ComponentType {
  return LAYOUTS[layout];
}

export { InsadongLayout, NamInsadongLayout, OsanLayout, HwaseongLayout, JejuLayout };
