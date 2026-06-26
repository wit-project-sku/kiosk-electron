import { useEffect, useMemo } from 'react';
import { resolveLayout } from '@layouts/index';
import { useBootstrap } from '@renderer/hooks/useBootstrap';
import { useKioskTheme } from '@renderer/hooks/useKioskTheme';
import { useKioskStore } from '@renderer/store/kioskStore';
import { preloadAllImages } from '@renderer/lib/preloadAssets';
import { useShopStore } from '@renderer/store/shopStore';

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

  const KioskLayout = useMemo(() => resolveLayout(layout), [layout]);

  return <KioskLayout />;
}
