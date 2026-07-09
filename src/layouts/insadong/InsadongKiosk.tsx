import { useEffect } from 'react';
import { useKioskController } from '@renderer/hooks/useKioskController';
import { useWeatherSync } from '@renderer/hooks/useWeatherSync';
import { useExchangeSync } from '@renderer/hooks/useExchangeSync';
import { WEB_EMBED_URLS } from '@shared/constants/webEmbeds';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { kdramaAssetUrls } from '@renderer/assets/icons/insadong/kdrama';
import { KioskArtboard } from '../components/KioskScreenImage';
import { PhotoWorkflow } from '../photo/PhotoWorkflow';
import { InsadongHome } from './InsadongHome';
import { InsadongLanguage } from './InsadongLanguage';
import { InsadongAbout } from './InsadongAbout';
import { InsadongMuseum } from './InsadongMuseum';
import { InsadongListScreen } from './InsadongListScreen';
import { InsadongExchange } from './InsadongExchange';
import { InsadongPalace } from './InsadongPalace';
import { InsadongTransport } from './InsadongTransport';
import { InsadongAiSearch } from './InsadongAiSearch';
import { InsadongAiResult } from './InsadongAiResult';
import { InsadongAiDetail } from './InsadongAiDetail';
import { InsadongSearch } from './InsadongSearch';
import { InsadongHello } from './InsadongHello';
import { InsadongHelp } from './InsadongHelp';
import { InsadongDetail } from './InsadongDetail';
import { InsadongWebScreen } from './InsadongWebScreen';
import { InsadongEvents } from './InsadongEvents';
import { InsadongTaxfree } from './InsadongTaxfree';
import { InsadongKdrama } from './InsadongKdrama';
import { InsadongScreen } from './InsadongScreen';
import { INSADONG_SCREENS } from './screenAssets';

function readDebugFlag(): boolean {
  try {
    return localStorage.getItem('kioskDebug') === '1';
  } catch {
    return false;
  }
}

function usePreloadScreens(): void {
  useEffect(() => {
    for (const asset of Object.values(INSADONG_SCREENS)) {
      const img = new Image();
      img.src = asset.image;
    }
    // Preload the (large) K-DRAMA promotion images so that page opens instantly.
    for (const url of kdramaAssetUrls) {
      const img = new Image();
      img.src = url;
    }
    // Pre-buffer the K-DRAMA promotion trailer so it plays the instant the page
    // opens (no white flash). The media:// protocol streams from local disk, so
    // preload='auto' warms the browser cache without bundling the 80MB file.
    const promo = document.createElement('video');
    promo.src = 'media://video/insadong/promotion.mp4';
    promo.muted = true;
    promo.preload = 'auto';
    promo.load();
  }, []);
}

/** InsadongWebScreen pages always kept mounted for instant load. */
const WEB_SCREENS = [
  { screen: 'market' as const, title: '위드마켓', url: WEB_EMBED_URLS.market, bodyHeight: undefined },
] as const;

type WebScreenKey = (typeof WEB_SCREENS)[number]['screen'];
function isWebScreen(s: string): s is WebScreenKey {
  return s === 'market';
}

export function InsadongKiosk(): JSX.Element {
  const controller = useKioskController();
  const debug = readDebugFlag();
  useWeatherSync();
  useExchangeSync();
  usePreloadScreens();

  const cur = controller.screen;
  const photoActive = controller.photoActive;

  // The "foreground" slot — null when a pre-warmed web screen is active.
  const foreground = photoActive ? (
    <PhotoWorkflow />
  ) : cur === 'home' ? (
    <InsadongHome controller={controller} debug={debug} />
  ) : cur === 'language' ? (
    <InsadongLanguage controller={controller} debug={debug} />
  ) : cur === 'about' ? (
    <InsadongAbout controller={controller} debug={debug} />
  ) : cur === 'museum' ? (
    <InsadongMuseum controller={controller} debug={debug} />
  ) : cur === 'eat' ? (
    <InsadongListScreen title="'인사' 뭐먹지" controller={controller} />
  ) : cur === 'shop' ? (
    <InsadongListScreen title="'인사' 뭐사지" controller={controller} />
  ) : cur === 'exchange' ? (
    <InsadongExchange controller={controller} debug={debug} />
  ) : cur === 'lodging' ? (
    <InsadongListScreen title="숙박안내" controller={controller} />
  ) : cur === 'palace' ? (
    <InsadongPalace controller={controller} debug={debug} />
  ) : cur === 'transport' ? (
    <InsadongTransport controller={controller} debug={debug} />
  ) : cur === 'map' ? (
    <InsadongTransport controller={controller} debug={debug} initialTab={1} />
  ) : cur === 'ai_search' ? (
    <InsadongAiSearch controller={controller} debug={debug} />
  ) : cur === 'ai_result' ? (
    <InsadongAiResult controller={controller} debug={debug} />
  ) : cur === 'search' ? (
    <InsadongSearch controller={controller} debug={debug} />
  ) : cur === 'ai_detail' ? (
    <InsadongAiDetail controller={controller} debug={debug} />
  ) : cur === 'hello' ? (
    <InsadongHello controller={controller} debug={debug} />
  ) : cur === 'help' ? (
    <InsadongHelp controller={controller} debug={debug} />
  ) : cur === 'restroom' ? (
    <InsadongHelp controller={controller} debug={debug} initialTab="화장실" />
  ) : cur === 'kdrama' ? (
    <InsadongKdrama controller={controller} debug={debug} />
  ) : cur === 'detail' ? (
    <InsadongDetail controller={controller} debug={debug} />
  ) : cur === 'events' ? (
    <InsadongEvents controller={controller} />
  ) : isWebScreen(cur) || cur === 'taxfree' ? (
    null  // handled by pre-warmed layer below
  ) : (
    <InsadongScreen screen={cur} controller={controller} debug={debug} />
  );

  return (
    <KioskArtboard>
      {/* Persistent background — stays mounted across navigation so the page
          background never flashes/blinks while the foreground swaps. */}
      {iconUrl('bg') && (
        <img
          src={iconUrl('bg')}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      )}
      {foreground}

      {/*
        Pre-warmed web screens — always in the DOM so webview guest processes
        stay alive and content is loaded before the user navigates here.
        When inactive we collapse to 0×0 + overflow:hidden instead of
        visibility:hidden because Electron <webview> elements paint at the OS
        compositor level and bleed through CSS visibility on their parent.
      */}
      {WEB_SCREENS.map(({ screen, title, url, bodyHeight }) => {
        const active = !photoActive && cur === screen;
        return (
          <div
            key={screen}
            style={
              active
                ? { position: 'absolute', inset: 0, zIndex: 1 }
                : { position: 'absolute', top: 0, left: 0, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }
            }
          >
            <InsadongWebScreen title={title} url={url} controller={controller} bodyHeight={bodyHeight} />
          </div>
        );
      })}

      {/* InsadongTaxfree has its own internal webview slots — always mount so they pre-warm. */}
      {(() => {
        const active = !photoActive && cur === 'taxfree';
        return (
          <div
            style={
              active
                ? { position: 'absolute', inset: 0, zIndex: 1 }
                : { position: 'absolute', top: 0, left: 0, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }
            }
          >
            <InsadongTaxfree controller={controller} />
          </div>
        );
      })()}
    </KioskArtboard>
  );
}
