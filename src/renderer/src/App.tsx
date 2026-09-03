import { useEffect, useMemo } from 'react';
import { resolveLayout } from '@layouts/index';
import { useBootstrap } from '@renderer/hooks/useBootstrap';
import { useKioskTheme } from '@renderer/hooks/useKioskTheme';
import { useKioskStore } from '@renderer/store/kioskStore';
import { preloadAllImages } from '@renderer/lib/preloadAssets';
import { useShopStore } from '@renderer/store/shopStore';
import { useAttractionStore } from '@renderer/store/attractionStore';
import { useButtonStore } from '@renderer/store/buttonStore';
import { useBannerStore } from '@renderer/store/bannerStore';
import { useBackgroundStore } from '@renderer/store/backgroundStore';
import { useOutfitStore } from '@renderer/store/outfitStore';
import { KioskSwitcher } from '@renderer/components/kiosk/KioskSwitcher';
import { KeypadProbe } from '@renderer/components/kiosk/KeypadProbe';
import { FootfallCounter } from '@renderer/features/footfall/FootfallCounter';

/**
 * Root application shell. Reads kiosk config from synchronously-hydrated store
 * and renders the correct layout instantly — no spinners, no network waits.
 */
export function App(): JSX.Element {
  const layout = useKioskStore((s) => s.config.layout);

  useBootstrap();
  useKioskTheme();
   //just test comment
  // Warm the image cache after first paint so every page is instant thereafter.
  useEffect(() => preloadAllImages(), []);
  // Load the shop catalogue from the SQLite-cached API data, and reload when main
  // signals it refreshed (so first-launch data appears without an app restart).
  useEffect(() => {
    void useShopStore.getState().load();
    const off = window.api.events.onShopsChanged(() => {
      void useShopStore.getState().reload();
    });
    return off;
  }, []);
  // 제주 관광명소, the same way. Loaded for every location rather than gated on
  // the layout: the IPC returns an empty array where the cache was never filled,
  // which costs one round-trip and keeps this block identical to its four
  // neighbours instead of being the one that needs a condition.
  useEffect(() => {
    void useAttractionStore.getState().load();
    const off = window.api.events.onAttractionsChanged(() => {
      void useAttractionStore.getState().reload();
    });
    return off;
  }, []);
  // Load the home button layout from the SQLite-cached API data, and reload when
  // main signals it refreshed (first-launch data appears without an app restart).
  useEffect(() => {
    void useButtonStore.getState().load();
    const off = window.api.events.onButtonsChanged(() => {
      void useButtonStore.getState().reload();
    });
    return off;
  }, []);
  // Load the bottom promo banners from the SQLite-cached API data, and reload
  // when main signals a refresh (first-launch/nightly data without a restart).
  useEffect(() => {
    void useBannerStore.getState().load();
    const off = window.api.events.onBannersChanged(() => {
      void useBannerStore.getState().reload();
    });
    return off;
  }, []);

  // Load the AR 배경 테마 set the same way — the 제주 outfit screen reads it, and
  // loading it here means the plates are already in memory when that step opens.
  useEffect(() => {
    void useBackgroundStore.getState().load();
    const off = window.api.events.onBackgroundsChanged(() => {
      void useBackgroundStore.getState().reload();
    });
    return off;
  }, []);

  // Load the AR 한복 outfit catalogue from SQLite at boot (main refreshes the API
  // on launch + nightly). Pre-warming here means the picker opens instantly
  // instead of waiting for the first IPC round-trip when someone taps AR 한복체험.
  useEffect(() => {
    void useOutfitStore.getState().load();
    const off = window.api.events.onOutfitsChanged(() => {
      void useOutfitStore.getState().reload();
    });
    return off;
  }, []);

  console.log('App.tsx: layout - 1');

  const KioskLayout = useMemo(() => resolveLayout(layout), [layout]);

  return (
    <>
      <KioskLayout />
      {/* DEV_MODE only (see .env): in-app W001–W005 location switcher. Renders
          null on every normal deployment, so no layout is affected. */}
      <KioskSwitcher />
      {/* DEV_MODE only: temporary diagnostic that prints what each key on the
          제주 barrier-free keypad (JD-KP100) actually emits. Delete once the
          real key map exists — see KeypadProbe's header. */}
      <KeypadProbe />
      {/* 유동인구 — counts people walking past, invisibly. Renders a single
          transparent pixel and nothing else; it yields the camera whenever the
          photo flow needs it (see FootfallService). */}
      <FootfallCounter />
    </>
  );
}
