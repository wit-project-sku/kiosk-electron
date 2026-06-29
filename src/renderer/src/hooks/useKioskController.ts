import { useCallback, useEffect, useRef } from 'react';
import type { KioskScreenId } from '@shared/types/kiosk';
import { useKioskStore } from '@renderer/store/kioskStore';
import { usePhotoStore } from '@renderer/store/photoStore';
import { localIso, recordMenuTouch, trackEvent } from '@renderer/lib/analytics';
import { resolveButton } from '@renderer/lib/buttonCatalog';
import { useInactivityReset } from './useInactivityReset';

/** An open menu-touch session: the button that left home + when it was touched. */
interface MenuTouch {
  buttonId: number;
  buttonType: string;
  touchedAt: string;
}

/** Return to the home/attract screen after this long with no interaction. */
const IDLE_TIMEOUT_MS = 3 * 60 * 1000;

export interface KioskController {
  screen: KioskScreenId;
  photoActive: boolean;
  kioskId: string;
  /** Navigate to a kiosk screen (resets any active photo flow + logs analytics). */
  navigate: (target: KioskScreenId, label?: string) => void;
  /** Start the AI 한복 photo workflow. */
  startPhoto: () => void;
}

/**
 * Shared kiosk interaction logic — screen state, navigation analytics, the photo
 * workflow entry, page dwell-time tracking, and the idle attract-loop reset.
 * Used by every layout so behaviour stays identical regardless of visual design.
 */
export function useKioskController(): KioskController {
  const screen = useKioskStore((s) => s.screen);
  const setScreen = useKioskStore((s) => s.setScreen);
  const kioskId = useKioskStore((s) => s.config.kioskId);
  const photoActive = usePhotoStore((s) => s.active);
  const startPhotoStore = usePhotoStore((s) => s.start);
  const resetPhoto = usePhotoStore((s) => s.reset);

  const navigate = useCallback(
    (target: KioskScreenId, label?: string) => {
      if (photoActive) {
        void window.api.photo.reset();
        resetPhoto();
      }
      setScreen(target);
      // Tell the customer display which AI-model video to show for this screen.
      void window.api.kiosk.setScreen(target);
      const button = resolveButton(kioskId, target);
      void trackEvent({
        name: 'button_clicked',
        payload: {
          screen: target,
          label: label ?? target,
          buttonId: button?.id ?? null,
          buttonName: button?.buttonName ?? null,
          position: button?.position ?? null,
          kioskId,
        },
      });
    },
    [kioskId, photoActive, resetPhoto, setScreen],
  );

  const startPhoto = useCallback(() => {
    startPhotoStore();
    void window.api.kiosk.setScreen('photo');
    void window.api.photo.startWorkflow();
    const button = resolveButton(kioskId, 'photo');
    void trackEvent({
      name: 'button_clicked',
      payload: {
        screen: 'photo_start',
        buttonId: button?.id ?? null,
        buttonName: button?.buttonName ?? null,
        position: button?.position ?? null,
        kioskId,
      },
    });
  }, [kioskId, startPhotoStore]);

  // Page dwell-time analytics + menu-touch sessions. On every screen change we:
  //  1. log how long the visitor spent on the screen they just left (page_view), and
  //  2. track the "menu touch → back to home" window for the stats API: a session
  //     opens when a menu button leaves home and closes (POSTs) on return to home.
  // Refs (not effect deps) so timing is measured from real entry, not re-renders.
  const enteredAtRef = useRef<number>(Date.now());
  const dwellScreenRef = useRef<KioskScreenId>(screen);
  const menuTouchRef = useRef<MenuTouch | null>(null);
  useEffect(() => {
    if (dwellScreenRef.current === screen) return;
    const leaving = dwellScreenRef.current;

    const leavingBtn = resolveButton(kioskId, leaving);
    void trackEvent({
      name: 'page_view',
      payload: {
        screen: leaving,
        durationMs: Date.now() - enteredAtRef.current,
        buttonId: leavingBtn?.id ?? null,
        buttonName: leavingBtn?.buttonName ?? null,
        position: leavingBtn?.position ?? null,
        kioskId,
      },
    });

    if (screen === 'home') {
      // Returned home → close and report the open menu-touch session.
      if (menuTouchRef.current) {
        recordMenuTouch({
          buttonId: menuTouchRef.current.buttonId,
          buttonType: menuTouchRef.current.buttonType,
          touchedAt: menuTouchRef.current.touchedAt,
          backToHomeAt: localIso(),
        });
        menuTouchRef.current = null;
      }
    } else if (!menuTouchRef.current) {
      // Left home into a menu → open a session keyed by the button just touched.
      // Lateral/deeper navigation keeps the original session (only home closes it).
      const enteredBtn = resolveButton(kioskId, screen);
      if (enteredBtn?.id != null) {
        menuTouchRef.current = {
          buttonId: enteredBtn.id,
          buttonType: enteredBtn.buttonType,
          touchedAt: localIso(),
        };
      }
    }

    dwellScreenRef.current = screen;
    enteredAtRef.current = Date.now();
  }, [screen, kioskId]);

  // The 사진촬영 (camera) flow runs as an overlay without changing `screen`, so it
  // gets its own menu-touch session: opened when the photo flow starts, closed
  // (back-to-home) when it ends.
  const photoTouchRef = useRef<string | null>(null);
  useEffect(() => {
    if (photoActive) {
      if (!photoTouchRef.current) photoTouchRef.current = localIso();
      return;
    }
    if (photoTouchRef.current) {
      const photoBtn = resolveButton(kioskId, 'photo');
      if (photoBtn?.id != null) {
        recordMenuTouch({
          buttonId: photoBtn.id,
          buttonType: photoBtn.buttonType,
          touchedAt: photoTouchRef.current,
          backToHomeAt: localIso(),
        });
      }
      photoTouchRef.current = null;
    }
  }, [photoActive, kioskId]);

  // Idle attract-loop reset: after IDLE_TIMEOUT_MS with no interaction, drop any
  // photo flow and return to home. No-op when already idling on the home screen.
  const handleIdle = useCallback(() => {
    const from = useKioskStore.getState().screen;
    const inPhoto = usePhotoStore.getState().active;
    if (from === 'home' && !inPhoto) return;
    if (inPhoto) {
      void window.api.photo.reset();
      resetPhoto();
    }
    setScreen('home');
    void window.api.kiosk.setScreen('home');
    void trackEvent({ name: 'session_timeout', payload: { from, kioskId } });
  }, [kioskId, resetPhoto, setScreen]);

  useInactivityReset({ timeoutMs: IDLE_TIMEOUT_MS, onIdle: handleIdle });

  // Presence-based reset: when the photo countdown is held because nobody is in
  // front of the camera (Monitor 2 reports this via `countdownPaused`), return
  // to home after the idle timeout so the kiosk never sits on a frozen capture
  // screen. The timer re-arms on every absence, so a brief return resets it; it
  // only fires after a full IDLE_TIMEOUT_MS of continuous no-show.
  const photoPhase = usePhotoStore((s) => s.phase);
  const countdownPaused = usePhotoStore((s) => s.countdownPaused);
  useEffect(() => {
    if (photoPhase !== 'countdown' || !countdownPaused) return;
    const timer = window.setTimeout(() => handleIdle(), IDLE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [photoPhase, countdownPaused, handleIdle]);

  return { screen, photoActive, kioskId, navigate, startPhoto };
}
