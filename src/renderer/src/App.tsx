import { useEffect, useMemo } from 'react';
import { resolveLayout } from '@layouts/index';
import { useBootstrap } from '@renderer/hooks/useBootstrap';
import { useKioskTheme } from '@renderer/hooks/useKioskTheme';
import { useKioskStore } from '@renderer/store/kioskStore';
import { preloadAllImages } from '@renderer/lib/preloadAssets';
import { useShopStore } from '@renderer/store/shopStore';
import { useButtonStore } from '@renderer/store/buttonStore';
import { useBannerStore } from '@renderer/store/bannerStore';
import { useBackgroundStore } from '@renderer/store/backgroundStore';
import { KioskSwitcher } from '@renderer/components/kiosk/KioskSwitcher';

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

  const KioskLayout = useMemo(() => resolveLayout(layout), [layout]);

  return (
    <>
      <KioskLayout />
      {/* DEV_MODE only (see .env): in-app W001–W005 location switcher. Renders
          null on every normal deployment, so no layout is affected. */}
      <KioskSwitcher />
    </>
  );
}
