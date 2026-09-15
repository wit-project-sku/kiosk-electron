import { useEffect, type CSSProperties } from 'react';
import { useKioskController } from '@renderer/hooks/useKioskController';
import { useWeatherSync } from '@renderer/hooks/useWeatherSync';
import { useExchangeSync } from '@renderer/hooks/useExchangeSync';
import { WEB_EMBED_URLS, donationUrl } from '@shared/constants/webEmbeds';
import { DONATION_COMING_SOON } from '@shared/config/donation';
import { useHasDonationTile } from '@renderer/lib/buttonLayout';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { KioskArtboard } from '../components/KioskScreenImage';
import { DonationWebScreen } from '../components/DonationWebScreen';
import { PhotoWorkflow } from '../photo/PhotoWorkflow';
import { InsadongLowReachTop, lowReachPageBox } from '../insadong/InsadongLowReach';
import { OsanHome } from './OsanHome';
import { OsanLanguage } from './OsanLanguage';
import { OsanSearch } from './OsanSearch';
import { OsanListScreen } from './OsanListScreen';
import { OsanDetail } from './OsanDetail';
import { OsanAiSearch } from './OsanAiSearch';
import { OsanAiResult } from './OsanAiResult';
import { OsanAiDetail } from './OsanAiDetail';
import { OsanExchange } from './OsanExchange';
import { OsanHelp } from './OsanHelp';
import { OsanHello } from './OsanHello';
import { OsanKdrama } from './OsanKdrama';
import { OsanTransport } from './OsanTransport';
import { OsanAbout } from './OsanAbout';
import { OsanLocalpay } from './OsanLocalpay';
import { OsanWebScreen } from './OsanWebScreen';
import { OsanEvents } from './OsanEvents';
import { OsanTaxfree } from './OsanTaxfree';
import { OsanScreen } from './OsanScreen';

/** Pre-warmed web screens, kept mounted so webview guests load before navigation. */
const WEB_SCREENS = [
  { screen: 'market' as const, title: '위드마켓', url: WEB_EMBED_URLS.market },
] as const;

type WebScreenKey = (typeof WEB_SCREENS)[number]['screen'];
function isWebScreen(s: string): s is WebScreenKey {
  return s === 'market';
}

/**
 * Theme the shared photo (AI 한복) workflow navy for Osan (insadong stays orange).
 * Figma 3474:73963/73618: primary var(--kiosk-primary), selected light bg var(--kiosk-secondary), 다시찍기 #616161.
 *
 * Flattened like Insadong: no outlines and no drop shadows on its tabs, outfit
 * cards, panels, buttons, QR frames or pop-ups — except the SELECTED outfit card,
 * which keeps a 5px ring in the primary colour so the pick is obvious.
 */
const PHOTO_THEME = {
  '--photo-accent': 'var(--kiosk-primary)',
  '--photo-accent-soft': 'var(--kiosk-secondary)',
  '--photo-tint': '#eef4fa',
  '--photo-accent-alt': '#616161',
  '--photo-tab-border-width': '0px',
  '--photo-card-border-width': '0px',
  '--photo-card-sel-border-width': '5px',
  '--photo-card-shadow': 'none',
  '--photo-panel-border-width': '0px',
  '--photo-panel-shadow': 'none',
  '--photo-button-shadow': 'none',
  '--photo-cam-shadow': 'none',
  '--photo-result-shadow': 'none',
  '--photo-qr-border-width': '0px',
  '--photo-modal-border-width': '0px',
  '--photo-modal-shadow': 'none',
} as CSSProperties;

/**
 * Sub-pages whose body runs to the artboard foot instead of stopping at a
 * bottom promo banner (they draw no OsanBanner). In ♿ low-reach their box is
 * only as tall as the room left under the moved header, so the last card stays
 * reachable (see lowReachPageBox).
 */
const NO_BANNER_SCREENS: ReadonlySet<string> = new Set([
  'eat', 'shop', 'lodging', 'help', 'restroom', 'about', 'kdrama',
]);

const HIDDEN_LAYER: CSSProperties = {
  position: 'absolute', top: 0, left: 0, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
};

export function OsanKiosk(): JSX.Element {
  const controller = useKioskController();
  useWeatherSync();
  useExchangeSync();

  // Pre-buffer the Osaek promotion trailer so the K-Culture page plays instantly
  // (no white flash). preload='auto' warms the cache from local disk via media://.
  useEffect(() => {
    const promo = document.createElement('video');
    promo.src = 'media://video/osaek/promotion.mp4';
    promo.muted = true;
    promo.preload = 'auto';
    promo.load();
  }, []);

  const cur = controller.screen;
  const photoActive = controller.photoActive;
  const hasDonation = useHasDonationTile(controller.kioskId);

  // 베리어프리 (♿ low-reach): mode bar + promo at the top, every page moved down
  // under them. Not over the photo flow or the fullscreen donation app.
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const lowTop = lowReach && !photoActive && cur !== 'donation';

  const foreground = photoActive ? (
    <div style={{ position: 'absolute', inset: 0, ...PHOTO_THEME }}>
      <PhotoWorkflow />
    </div>
  ) : cur === 'home' ? (
    <OsanHome controller={controller} />
  ) : cur === 'language' ? (
    <OsanLanguage controller={controller} />
  ) : cur === 'search' ? (
    <OsanSearch controller={controller} />
  ) : cur === 'detail' ? (
    <OsanDetail controller={controller} />
  ) : cur === 'ai_search' ? (
    <OsanAiSearch controller={controller} />
  ) : cur === 'ai_result' ? (
    <OsanAiResult controller={controller} />
  ) : cur === 'ai_detail' ? (
    <OsanAiDetail controller={controller} />
  ) : cur === 'eat' ? (
    // key per screen → remount so the shared list resets its selected tab/data
    // when switching between 뭐먹지 / 뭐사지(식품) / 뭐사지(물품).
    <OsanListScreen key="eat" title="'정이' 뭐먹지" controller={controller} />
  ) : cur === 'shop' ? (
    <OsanListScreen key="shop" title="'정이' 뭐사지(식품)" controller={controller} />
  ) : cur === 'lodging' ? (
    <OsanListScreen key="lodging" title="'정이' 뭐사지(물품)" controller={controller} />
  ) : cur === 'exchange' ? (
    <OsanExchange controller={controller} />
  ) : cur === 'help' ? (
    <OsanHelp controller={controller} />
  ) : cur === 'restroom' ? (
    <OsanHelp controller={controller} initialTab="화장실" />
  ) : cur === 'hello' ? (
    <OsanHello controller={controller} />
  ) : cur === 'kdrama' ? (
    <OsanKdrama controller={controller} />
  ) : cur === 'transport' ? (
    <OsanTransport controller={controller} initialTab={0} />
  ) : cur === 'map' ? (
    <OsanTransport controller={controller} initialTab={1} />
  ) : cur === 'about' ? (
    <OsanAbout controller={controller} />
  ) : cur === 'museum' ? (
    <OsanLocalpay controller={controller} />
  ) : cur === 'events' ? (
    <OsanEvents controller={controller} />
  ) : isWebScreen(cur) || cur === 'taxfree' || cur === 'donation' ? (
    null // handled by pre-warmed layers below
  ) : (
    <OsanScreen screen={cur} controller={controller} />
  );

  // Home re-lays itself out for low-reach; every other page is moved as a whole.
  const pageBox = lowTop && cur !== 'home' ? lowReachPageBox(!NO_BANNER_SCREENS.has(cur)) : undefined;

  /** An active pre-warmed layer — full artboard, or the moved ♿ box. */
  const activeLayer = (zIndex: number): CSSProperties =>
    lowTop ? { ...lowReachPageBox(true), zIndex } : { position: 'absolute', inset: 0, zIndex };

  return (
    <KioskArtboard>
      {/* Persistent background image — stays mounted across screen changes */}
      {osanIconUrl('bg') && (
        <img
          src={osanIconUrl('bg')}
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
      {pageBox && foreground ? <div style={pageBox}>{foreground}</div> : foreground}

      {/* Pre-warmed web screens (위드마켓) — collapse to 0×0 when inactive. */}
      {WEB_SCREENS.map(({ screen, title, url }) => {
        const active = !photoActive && cur === screen;
        return (
          <div key={screen} style={active ? activeLayer(1) : HIDDEN_LAYER}>
            <OsanWebScreen title={title} url={url} controller={controller} />
          </div>
        );
      })}

      {/* TAX-FREE has its own internal webview — always mount so it pre-warms. */}
      <div style={!photoActive && cur === 'taxfree' ? activeLayer(1) : HIDDEN_LAYER}>
        <OsanTaxfree controller={controller} />
      </div>

      {/* ♿ mode bar + promo banner, over the moved page. */}
      {lowTop && (
        <InsadongLowReachTop onBanner={() => controller.startPhoto()} bannerFallback={osanIconUrl('banner')} />
      )}

      {/* Donation web app — fullscreen embed, pre-warmed so it opens instantly.
          zIndex 2 so it covers the kiosk chrome and reads as a native page.
          Only mounted where 기부 exists AND is live: the layer loads the remote
          page immediately, so on a kiosk with no 기부 tile — or while 기부 is 준비중
          (unreachable) — it would sit there fetching a page nothing can reach. */}
      {hasDonation && !DONATION_COMING_SOON && (
        <div
          style={
            !photoActive && cur === 'donation'
              ? { position: 'absolute', inset: 0, zIndex: 2 }
              : HIDDEN_LAYER
          }
        >
          <DonationWebScreen url={donationUrl(controller.kioskId)} controller={controller} />
        </div>
      )}
    </KioskArtboard>
  );
}
