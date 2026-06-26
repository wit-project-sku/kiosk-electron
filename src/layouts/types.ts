import type { KioskScreenId } from '@shared/types/kiosk';

export interface KioskNavItem {
  screen: KioskScreenId;
  label: string;
}

export interface KioskLayoutProps {
  navItems: KioskNavItem[];
}
