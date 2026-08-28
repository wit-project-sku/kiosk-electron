/**
 * Screen router for 제주공항 (W006).
 *
 * Structure mirrors OsanKiosk/HwaseongKiosk so the Jeju screens can be filled in
 * one at a time: add a `cur === '<screen>'` branch as each Figma frame is built,
 * and everything still unbuilt falls through to the JejuScreen scaffold.
 *
 * The shared flows are already wired and need no Jeju-specific code:
 *  - PhotoWorkflow (한복/사진) — themed via CSS vars, see PHOTO_THEME below and
 *    photoChrome.tsx for the per-layout header/icon resolution.
 *  - DonationWebScreen (기부) — W006 has hasDonation; URL via donationUrl(kioskId).
 */
import type { CSSProperties } from 'react';
import type { KioskScreenId } from '@shared/types/kiosk';
import { useKioskController } from '@renderer/hooks/useKioskController';
import { useWeatherSync } from '@renderer/hooks/useWeatherSync';
import { useFlightSync } from '@renderer/hooks/useFlightSync';
import { useSailingSync } from '@renderer/hooks/useSailingSync';
import { useExchangeSync } from '@renderer/hooks/useExchangeSync';
import { WEB_EMBED_URLS, donationUrl } from '@shared/constants/webEmbeds';
import { DONATION_COMING_SOON } from '@shared/config/donation';
import { useHasDonationTile } from '@renderer/lib/buttonLayout';
import { KioskArtboard } from '../components/KioskScreenImage';
import { DonationWebScreen } from '../components/DonationWebScreen';
import { PhotoWorkflow } from '../photo/PhotoWorkflow';
import { JejuAiSearch } from './JejuAiSearch';
import { JejuAiResult } from './JejuAiResult';
import { JejuAiDetail } from './JejuAiDetail';
import { JejuHome } from './JejuHome';
import { JejuLanguage } from './JejuLanguage';
import { JejuScreen } from './JejuScreen';
import { JejuSearch } from './JejuSearch';
import { JejuDetail } from './JejuDetail';
import { JejuListScreen } from './JejuListScreen';
import { JejuTaxFree } from './JejuTaxFree';
import { JejuAbout } from './JejuAbout';
import { JejuHello } from './JejuHello';
import { JejuHelp } from './JejuHelp';
import { JejuLocalpay } from './JejuLocalpay';
import { JejuWebScreen } from './JejuWebScreen';
import { JejuEvents } from './JejuEvents';
import { JejuFlights } from './JejuFlights';
import { JejuCruise } from './JejuCruise';
import { JejuExchange } from './JejuExchange';
import { JejuRentcar } from './JejuRentcar';

/** Theme the shared AR 한복 photo workflow with the 제주 orange (#ff7f0f, the
 *  Figma `[제주] main 01` token). photoChrome.tsx resolves Jeju's icons, header
 *  and banner, so the flow wears 제주 chrome throughout. */
const PHOTO_THEME = {
  '--photo-accent': '#ff7f0f',
  '--photo-accent-soft': '#f5f1ef',
  '--photo-tint': '#fdf4ec',
  '--photo-accent-alt': '#616161',
} as CSSProperties;

/**
 * Pre-warmed web screens — the same treatment 위드마켓 gets on Insadong and Osan.
 *
 * Each <webview> guest is a separate process that has to boot, fetch and paint
 * its site from scratch. Mounting one only when its screen is current means the
 * visitor taps the tile and stares at an empty panel while that happens; the
 * other kiosks keep it in the DOM from boot so the site is already painted when
 * they arrive. Two guests run here (witteria + tamnao), both idle after load.
 */
interface WebScreen {
  screen: Extract<KioskScreenId, 'market' | 'tamnao'>;
  url: string;
  /** Header title id — JejuHeader localizes it (see i18n TITLE_KEYS). */
  title: string;
  /** Omit to let the sheet supply it, or hide the row when it has none. */
  subtitle?: string;
  subtitleColor?: string;
  subtitleStar?: boolean;
  /** 탐나오 only — the QR row + that frame's panel metrics. */
  showMobileQr?: boolean;
}

const WEB_SCREENS: readonly WebScreen[] = [
  {
    screen: 'market',
    url: WEB_EMBED_URLS.market,
    // 제주's own chrome for this screen — Figma 6050:149556 titles it "WIT Store"
    // with the store's brown subtitle and no ★, unlike Insadong/Osan's 위드마켓.
    title: 'WIT Store',
    subtitle: '오직 현장에서만 할인받을 수 있는 상품들을 확인해보세요!',
    subtitleColor: '#8b7355',
    subtitleStar: false,
  },
  {
    // 탐나오 (제주공공플랫폼) — the same treatment WIT Store gets: the live site
    // in a <webview> under 제주's own header/nav/banner. No subtitle is passed:
    // 탐나오 has no SubHeader_* row in Localization_Jeju, and JejuHeader hides
    // the row when neither a prop nor the sheet supplies one.
    screen: 'tamnao',
    url: WEB_EMBED_URLS.tamnao,
    title: '탐나오',
    // 6219:105645 hangs a "모바일에서 확인하기" QR under the panel so a visitor
    // can carry the site away on their phone. WIT Store's frame has no such row.
    showMobileQr: true,
  },
];

type WebScreenKey = WebScreen['screen'];

function isWebScreen(s: string): s is WebScreenKey {
  return s === 'market' || s === 'tamnao';
}

export function JejuKiosk(): JSX.Element {
  const controller = useKioskController();
  useWeatherSync();
  useFlightSync();
  useSailingSync();
  useExchangeSync();
  const hasDonation = useHasDonationTile(controller.kioskId);

  const cur = controller.screen;

  const foreground = controller.photoActive ? (
    <div style={{ position: 'absolute', inset: 0, ...PHOTO_THEME }}>
      <PhotoWorkflow />
    </div>
  ) : cur === 'home' ? (
    <JejuHome controller={controller} />
  ) : cur === 'language' ? (
    <JejuLanguage controller={controller} />
  ) : cur === 'ai_search' ? (
    <JejuAiSearch controller={controller} />
  ) : cur === 'ai_result' ? (
    <JejuAiResult controller={controller} />
  ) : cur === 'ai_detail' ? (
    <JejuAiDetail controller={controller} />
  ) : cur === 'search' ? (
    <JejuSearch controller={controller} />
  ) : cur === 'detail' ? (
    <JejuDetail controller={controller} />
  ) : cur === 'eat' || cur === 'shop' || cur === 'lodging' ? (
    <JejuListScreen screen={cur} controller={controller} />
  ) : cur === 'events' ? (
    <JejuEvents controller={controller} />
  ) : cur === 'flights' ? (
    <JejuFlights controller={controller} />
  ) : cur === 'cruise' ? (
    // 여객터미널 W007's ferry board. Reachable only there — W006's home draws
    // 렌트카 in the slot that navigates here.
    <JejuCruise controller={controller} />
  ) : cur === 'exchange' ? (
    <JejuExchange controller={controller} />
  ) : cur === 'rentcar' ? (
    <JejuRentcar controller={controller} />
  ) : cur === 'taxfree' ? (
    <JejuTaxFree controller={controller} />
  ) : cur === 'about' ? (
    <JejuAbout controller={controller} />
  ) : cur === 'hello' ? (
    <JejuHello controller={controller} />
  ) : cur === 'help' || cur === 'restroom' ? (
    // 화장실 has no screen of its own: the home button opens 도와줘 '하영' with the
    // 화장실 chip already lit, which is that page's first category anyway.
    <JejuHelp controller={controller} initialCategory={cur === 'restroom' ? '화장실' : undefined} />
  ) : cur === 'localpay' ? (
    <JejuLocalpay controller={controller} />
  ) : // WIT Store · 탐나오 · 기부 all render from the pre-warmed layers below, so
  // the foreground deliberately draws nothing for them.
  isWebScreen(cur) || cur === 'donation' ? null : (
    <JejuScreen screen={cur} controller={controller} />
  );

  // No background is painted here: 제주 uses a DIFFERENT one per screen — the home
  // screen's flat cream `bg`, and `bg-page` (an illustration at 70% over white)
  // on every sub-page. Each screen owns its own, so nothing paints a background
  // that the next layer immediately covers.
  return (
    <KioskArtboard>
      {foreground}

      {/*
        Always in the DOM so the webview guest process stays alive and the site
        is loaded before the visitor navigates here.

        Inactive screens collapse to 0×0 + overflow:hidden rather than
        `visibility: hidden` — Electron <webview> paints at the OS compositor
        level and BLEEDS THROUGH CSS visibility on its parent, so a hidden one
        would sit on top of the home screen. Same reason Insadong and Osan do it
        this way.
      */}
      {WEB_SCREENS.map(({ screen, url, title, subtitle, subtitleColor, subtitleStar, showMobileQr }) => {
        const active = !controller.photoActive && cur === screen;
        return (
          <div
            key={screen}
            style={
              active
                ? { position: 'absolute', inset: 0, zIndex: 1 }
                : {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 0,
                    height: 0,
                    overflow: 'hidden',
                    pointerEvents: 'none',
                    zIndex: 0,
                  }
            }
          >
            <JejuWebScreen
              controller={controller}
              title={title}
              subtitle={subtitle}
              subtitleColor={subtitleColor}
              subtitleStar={subtitleStar}
              url={url}
              showMobileQr={showMobileQr}
            />
          </div>
        );
      })}

      {/*
        기부 — the same pre-warmed layer, and for the same reason. It used to be
        mounted inline the moment `cur === 'donation'`, so the guest process was
        booting, fetching and painting the remote app WHILE the visitor watched:
        that is the flash. Insadong and Osan have always kept it mounted from
        boot, which is why 기부 opens smoothly there and only here it did not.

        zIndex 2 (not 1) so it covers the kiosk chrome and reads as a native page.
        Mounted only where 기부 exists and is live — the layer loads the remote
        page immediately, so on a kiosk without the tile it would fetch for
        nothing.
      */}
      {hasDonation &&
        !DONATION_COMING_SOON &&
        (() => {
          const active = !controller.photoActive && cur === 'donation';
          return (
            <div
              style={
                active
                  ? { position: 'absolute', inset: 0, zIndex: 2 }
                  : {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: 0,
                      height: 0,
                      overflow: 'hidden',
                      pointerEvents: 'none',
                      zIndex: 0,
                    }
              }
            >
              <DonationWebScreen url={donationUrl(controller.kioskId)} controller={controller} />
            </div>
          );
        })()}
    </KioskArtboard>
  );
}
