import { useEffect, useRef } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import styles from './DonationWebScreen.module.css';

/** Tag the donation app prefixes onto console messages meant for the kiosk. */
const KIOSK_TAG = '[[KIOSKBRIDGE]]';

/** Minimal typing for the Electron <webview> element + events we use. */
interface WebviewConsoleEvent {
  message: string;
}
interface WebviewExec {
  executeJavaScript(code: string): Promise<unknown>;
}

interface DonationWebScreenProps {
  url: string;
  controller: KioskController;
}

/**
 * Fullscreen embed of the WIT Global donation web app. Covers the entire artboard
 * so it reads as a native kiosk page.
 *
 * Preload-independent bridge (robust against webview preload quirks):
 *   guest -> host : donation app console.log's KIOSK_TAG + json; we catch it on
 *                   the <webview> 'console-message' event.
 *   host  -> guest: we call window.__kioskDeliver(msg) via executeJavaScript.
 *
 * Messages: goHome (in-app home icon -> kiosk home), takePhoto {mode,clothingKey}
 * / cancelPhoto (run the Monitor-2 AI capture; Monitor 1 keeps the donation page),
 * with photoProgress / photoResult / photoError sent back to the guest.
 */
export function DonationWebScreen({ url, controller }: DonationWebScreenProps): JSX.Element {
  const ref = useRef<HTMLElement | null>(null);
  // True only while a donation-initiated Monitor-2 capture is in flight, so we
  // don't forward the kiosk's own hanbok photo events to the donation guest.
  const capturingRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sendToGuest = (msg: Record<string, unknown>): void => {
      const code = `window.__kioskDeliver && window.__kioskDeliver(${JSON.stringify(msg)})`;
      void (el as unknown as WebviewExec).executeJavaScript(code).catch(() => {});
    };

    const resetPhoto = (): void => {
      capturingRef.current = false;
      void window.api.photo.reset();
    };

    // Drive the kiosk's Monitor-2 photo workflow from a donation request. Monitor 1
    // keeps showing the donation webview; only Monitor 2 runs camera/countdown/AI.
    const runCapture = async (mode: 'solo' | 'together', clothingKey: string): Promise<void> => {
      const styleKey = mode === 'together' ? 'withInsa' : 'solo';
      capturingRef.current = true;
      try {
        await window.api.photo.startWorkflow();
        await window.api.photo.selectClothing(clothingKey);
        await window.api.photo.selectStyle(styleKey);
        await window.api.photo.beginCountdown();
      } catch (error) {
        capturingRef.current = false;
        sendToGuest({
          type: 'photoError',
          message: error instanceof Error ? error.message : 'capture failed',
        });
      }
    };

    const handleMessage = (msg: {
      type?: string;
      mode?: 'solo' | 'together';
      clothingKey?: string;
    }): void => {
      switch (msg?.type) {
        case 'goHome':
          resetPhoto();
          controller.navigate('home', 'Donation Home');
          break;
        case 'takePhoto':
          void runCapture(msg.mode ?? 'solo', msg.clothingKey ?? '');
          break;
        case 'cancelPhoto':
          resetPhoto();
          break;
        case 'showVideo':
          // Wall page: return Monitor 2 to its attract/celebration video.
          resetPhoto();
          break;
        default:
          break;
      }
    };

    const onConsole = (event: Event): void => {
      const message = (event as unknown as WebviewConsoleEvent).message;
      if (typeof message !== 'string' || !message.startsWith(KIOSK_TAG)) return;
      try {
        handleMessage(JSON.parse(message.slice(KIOSK_TAG.length)));
      } catch {
        /* ignore malformed bridge messages */
      }
    };

    // Deliver the finished AI photo to the donation guest in two forms:
    //   • url      — raw bytes as a base64 data URL read from local disk. The
    //                donation app turns this into a Blob and posts it to its own
    //                backend/storage (no public URL involved). Falls back to the
    //                public URL if the local read fails, so we never lose the photo.
    //   • shareUrl — the public witteria URL. A phone can't open a data: URL, so
    //                the donation certificate page encodes THIS into the QR code
    //                for phone viewing / download.
    const deliverResult = async (
      fileName: string | null,
      shareUrl: string | null,
    ): Promise<void> => {
      let url = shareUrl;
      if (fileName) {
        const res = await window.api.photo.getResultDataUrl(fileName);
        if (res.ok && res.value) url = res.value;
      }
      if (url) sendToGuest({ type: 'photoResult', url, shareUrl });
      else sendToGuest({ type: 'photoError', message: 'result image unavailable' });
    };

    // Forward Monitor-2 photo-workflow state to the donation guest while a
    // donation capture is active (progress -> result / error).
    const offWorkflow = window.api.events.onPhotoWorkflowChanged((state) => {
      if (!capturingRef.current) return;
      if (state.phase === 'result' && (state.resultFileName || state.resultUrl)) {
        capturingRef.current = false;
        void deliverResult(state.resultFileName, state.resultUrl);
      } else if (state.errorMessage) {
        capturingRef.current = false;
        sendToGuest({ type: 'photoError', message: state.errorMessage });
      } else if (state.phase === 'countdown' || state.phase === 'generating') {
        sendToGuest({
          type: 'photoProgress',
          phase: state.phase,
          countdown: state.countdown ?? null,
        });
      }
    });

    el.addEventListener('console-message', onConsole as EventListener);
    return () => {
      el.removeEventListener('console-message', onConsole as EventListener);
      offWorkflow();
    };
  }, [controller]);

  return (
    <div className={styles.root}>
      {/* eslint-disable react/no-unknown-property */}
      <webview ref={ref as unknown as React.Ref<HTMLElement>} src={url} partition="persist:embeds" className={styles.embed} />
      {/* eslint-enable react/no-unknown-property */}
    </div>
  );
}
