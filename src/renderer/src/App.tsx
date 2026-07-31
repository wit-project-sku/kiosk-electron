import { useEffect, useMemo } from 'react';
import { resolveLayout } from '@layouts/index';
import { useBootstrap } from '@renderer/hooks/useBootstrap';
import { useKioskTheme } from '@renderer/hooks/useKioskTheme';
import { useKioskStore } from '@renderer/store/kioskStore';
import { preloadAllImages } from '@renderer/lib/preloadAssets';
import { useShopStore } from '@renderer/store/shopStore';
import { useButtonStore } from '@renderer/store/buttonStore';
import { useBannerStore } from '@renderer/store/bannerStore';
import { KioskSwitcher } from '@renderer/components/kiosk/KioskSwitcher';
import { UpdateStatusIndicator } from '@renderer/components/update/UpdateStatusIndicator';

/**
 * Root application shell. Reads kiosk config from synchronously-hydrated store
 * and renders the correct layout instantly — no spinners, no network waits.
 */
export function App(): JSX.Element {
  const layout = useKioskStore((s) => s.config.layout);

  useBootstrap();
  useKioskTheme();

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

  const KioskLayout = useMemo(() => resolveLayout(layout), [layout]);

  return (
    <>
      <KioskLayout />
      {/* DEV_MODE only (see .env): in-app W001–W005 location switcher. Renders
          null on every normal deployment, so no layout is affected. */}
      <KioskSwitcher />
      {/* Non-blocking auto-update indicator. Renders null unless an update is
          actively checking/downloading/installing (nothing on an idle kiosk). */}
      <UpdateStatusIndicator />
    </>
  );
}
