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
 * Shared by every layout that runs 기부 (Insadong/Osan/Hwaseong). All of them pass
 * the same WEB_EMBED_URLS.donation: the embed looks identical on every kiosk by
 * design (see that constant).
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

  // 이 화면을 벗어나면(키오스크 홈 버튼·유휴 타임아웃·화면 전환 등) Monitor 2 를
  // 반드시 어트랙트 영상으로 되돌린다.
  //
  // useKioskController.navigate 는 `photoActive`(키오스크 자체 촬영 스토어)일 때만
  // 리셋하는데, 기부 흐름의 촬영은 메인 프로세스(startWorkflow)로 돌아가므로 그 값이
  // false 다 → 홈으로 가도 Monitor 2 에 AI 결과가 그대로 남았다. 웹뷰가 만든 상태는
  // 웹뷰가 치운다. (deps [] — 언마운트 때만 실행되어야 한다)
  useEffect(() => {
    return () => {
      void window.api.photo.reset();
    };
  }, []);

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
    //
    // holdResult: the school flow shoots BEFORE payment, so the AI result must not
    // be legible on Monitor 2 until the guest reaches payment-complete (revealPhoto).
    // While held it shows blurred behind a "기부를 완료해 주세요" notice — the result
    // is visibly ready, which is what nudges the user to pay. revealPhoto unblurs it.
    // The NGO flow pays first, so it shows unblurred as soon as the AI is done.
    const runCapture = async (
      mode: 'solo' | 'together',
      clothingKey: string,
      holdResult: boolean,
    ): Promise<void> => {
      // A missing outfit is a DEAD END, not a soft failure: Monitor 2's capture
      // step bails out when clothingKey is empty, so the countdown would run to
      // zero, nothing would be shot, and no photoResult/photoError would ever
      // come back — the donation app would wait on a promise that never settles.
      // Fail loudly here instead.
      if (!clothingKey) {
        sendToGuest({ type: 'photoError', message: 'no outfit selected' });
        return;
      }
      const styleKey = mode === 'together' ? 'withInsa' : 'solo';
      capturingRef.current = true;
      try {
        await window.api.photo.setHoldResult(holdResult);
        await window.api.photo.startWorkflow();
        await window.api.photo.selectClothing(clothingKey);
        await window.api.photo.selectStyle(styleKey);
        await window.api.photo.beginCountdown();
      } catch (error) {
        capturingRef.current = false;
        void window.api.photo.setHoldResult(false);
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
      holdResult?: boolean;
    }): void => {
      switch (msg?.type) {
        case 'goHome':
          resetPhoto();
          controller.navigate('home', 'Donation Home');
          break;
        case 'takePhoto':
          void runCapture(msg.mode ?? 'solo', (msg.clothingKey ?? '').trim(), Boolean(msg.holdResult));
          break;
        case 'revealPhoto':
          // 결제 완료 — 보류해 둔 AI 결과를 이제 Monitor 2 에 노출한다.
          void window.api.photo.revealResult();
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
