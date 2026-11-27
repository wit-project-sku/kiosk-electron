/**
 * What a 롯데 home button chose, carried across `controller.navigate()` (which only takes a screen
 * id). The home's 건물 단추 pick a building for 건물 안내 (C-04 · A-07).
 */
import { create } from 'zustand';

export type BuildingTab = 'events' | 'hotspots';

interface LotteNavState {
  /** Index into lotteSite(kioskId).buildings. */
  building: number;
  buildingTab: BuildingTab;
  openBuilding: (building: number, tab?: BuildingTab) => void;
  setBuilding: (building: number) => void;
  setBuildingTab: (tab: BuildingTab) => void;
}

export const useLotteNav = create<LotteNavState>((set) => ({
  building: 0,
  buildingTab: 'events',
  openBuilding: (building, tab = 'events') => set({ building, buildingTab: tab }),
  setBuilding: (building) => set({ building }),
  setBuildingTab: (buildingTab) => set({ buildingTab }),
}));
