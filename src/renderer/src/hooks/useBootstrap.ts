import { useEffect } from 'react';
import { isOk } from '@shared/types/result';
import { applyBootstrap } from '@renderer/bootstrap';
import { useSettingsStore } from '@renderer/store/settingsStore';
import { useSyncStore } from '@renderer/store/syncStore';
import { useKioskStore } from '@renderer/store/kioskStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { toast } from '@renderer/store/toastStore';

/**
 * Application bootstrap. Reads synchronously injected initial state for instant
 * first paint, then wires live cross-window subscriptions for the app lifetime.
 */
export function useBootstrap(): void {
  const applyExternalSettings = useSettingsStore((s) => s.applyExternal);
  const hydrateSync = useSyncStore((s) => s.hydrate);
  const refreshContent = useKioskStore((s) => s.refreshContent);
  const applyLanguage = useLanguageStore((s) => s.applyLanguage);

  useEffect(() => {
    // The synchronously-injected __INITIAL_STATE__ (if any) is intentionally
    // "slim" — it omits the large translations/content/templates so it fits the
    // OS command-line limit. Always fetch the full payload over IPC (no size
    // limit) to fill those in. applyBootstrap is idempotent, so this is safe
    // whether or not __INITIAL_STATE__ was present.
    void window.api.app.bootstrap().then((result) => {
      if (isOk(result)) {
        applyBootstrap(result.value);
      } else {
        toast.error('Failed to start: could not load application data.');
      }
    });

    const offSettings = window.api.events.onSettingsChanged(applyExternalSettings);
    const offSync = window.api.events.onSyncStatsChanged(hydrateSync);
    const offContent = window.api.events.onContentChanged(refreshContent);
    const offLanguage = window.api.events.onLanguageChanged(applyLanguage);

    return () => {
      offSettings();
      offSync();
      offContent();
      offLanguage();
    };
  }, [applyExternalSettings, hydrateSync, refreshContent, applyLanguage]);
}
