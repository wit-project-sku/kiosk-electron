import { useEffect, type CSSProperties } from 'react';
import { useKioskController } from '@renderer/hooks/useKioskController';
import { useWeatherSync } from '@renderer/hooks/useWeatherSync';
import { useExchangeSync } from '@renderer/hooks/useExchangeSync';
import { WEB_EMBED_URLS, donationUrl } from '@shared/constants/webEmbeds';
import { DONATION_COMING_SOON } from '@shared/config/donation';
import { useHasDonationTile } from '@renderer/lib/buttonLayout';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { KioskArtboard } from '../components/KioskScreenImage';
import { DonationWebScreen } from '../components/DonationWebScreen';
import { PhotoWorkflow } from '../photo/PhotoWorkflow';
import { OsanHome } from './OsanHome';
import { OsanLanguage } from './OsanLanguage';
import { OsanSearch } from './OsanSearch';
import { OsanListScreen } from './OsanListScreen';
import { OsanDetail } from './OsanDetail';
import { OsanAiCourse } from './OsanAiCourse';
import { OsanAiCourseResult } from './OsanAiCourseResult';
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
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useLang } from '@renderer/lib/i18n';
import { barrierFreeTitle } from '../insadong/barrierFree';

/** Mode bar height (Figma 7894:57571), the shift every participating page takes. */
const MODE_BAR = 145.759;
/**
 * Screens with their own barrier-free layout (7894:57182 home, 7878:44195
 * language, 7878:44658 / 45935 / 44811 '정이' 뭐하지, 7878:46736 위드마켓). Every other Osan screen is moved down as a
 * whole by the shift below.
 */
const MODE_DEDICATED = new Set(['home', 'language', 'ai_search', 'market']);

/** Pre-warmed web screens, kept mounted so webview guests load before navigation. */
const WEB_SCREENS = [
  { screen: 'market' as const, title: '위드마켓', url: WEB_EMBED_URLS.market },
] as const;

type WebScreenKey = (typeof WEB_SCREENS)[number]['screen'];
function isWebScreen(s: string): s is WebScreenKey {
  return s === 'market';
}

/** Theme the shared photo (AI 한복) workflow navy for Osan (insadong stays orange).
 *  Figma 3474:73963/73618: primary var(--kiosk-primary), selected light bg var(--kiosk-secondary), 다시찍기 #616161. */
const PHOTO_THEME = {
  '--photo-accent': 'var(--kiosk-primary)',
  '--photo-accent-soft': 'var(--kiosk-secondary)',
  '--photo-tint': '#eef4fa',
  '--photo-accent-alt': '#616161',
  /* The shared game UI reads this; 제주 and 인사동 keep their own orange. */
  '--game-accent': '#1a4d7e',
} as CSSProperties;

export function OsanKiosk(): JSX.Element {
  const controller = useKioskController();
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const lang = useLang();
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
    /* 오산>코스선택 7812:110430 (landing) + 오산>코스카테고리-01 7812:110570
       (builder) — one screen with a step, on the 인사동 course API. */
    <OsanAiCourse controller={controller} />
  ) : cur === 'ai_result' ? (
    /* 오산>코스 결과-01 7812:110989. */
    <OsanAiCourseResult controller={controller} />
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

  // The ♿ bar is on every screen, the photo flow included (AR 한복체험 저장하기,
  // 7894:56717). Screens without a dedicated layout — and the photo flow — are
  // moved down as a whole; backgrounds, rails and bottom banners counter-move
  // (--osan-mode-push), so they stay where the frames draw them.
  // 기부 is a separate website in a fullscreen webview: no ♿ bar and no shift,
  // the site is shown exactly as it is.
  const barOn = lowReach && (photoActive || cur !== 'donation');
  const shiftOn = barOn && (photoActive || !MODE_DEDICATED.has(cur));
  const shiftStyle = (
    shiftOn ? { position: 'absolute', inset: 0, transform: `translateY(${MODE_BAR}px)`, '--osan-mode-push': `${MODE_BAR}px` } : { position: 'absolute', inset: 0 }
  ) as CSSProperties;

  return (
    <KioskArtboard>
      {barOn && (
        <div
          style={{ position: 'absolute', top: 0, left: 0, width: 2160, height: MODE_BAR, background: '#1a4d7e', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Pretendard, sans-serif', fontWeight: 700, fontSize: 68, zIndex: 60 }}
        >
          {barrierFreeTitle(lang)}
        </div>
      )}
      {/* Persistent background image — stays mounted across screen changes.
          Outside the ♿ shift: every frame keeps the art at y0 (7878:44427). */}
      {osanIconUrl('page-bg') && (
        <img
          src={osanIconUrl('page-bg')}
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
      <div style={shiftStyle}>
      {foreground}

      {/* Pre-warmed web screens (위드마켓 · 오산시 이벤트) — collapse to 0×0 when inactive. */}
      {WEB_SCREENS.map(({ screen, title, url }) => {
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
            <OsanWebScreen title={title} url={url} controller={controller} />
          </div>
        );
      })}

      {/* TAX-FREE has its own internal webview — always mount so it pre-warms. */}
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
            <OsanTaxfree controller={controller} />
          </div>
        );
      })()}

      {/* Donation web app — fullscreen embed, pre-warmed so it opens instantly.
          zIndex 2 so it covers the kiosk chrome and reads as a native page.
          Only mounted where 기부 exists AND is live: the layer loads the remote
          page immediately, so on a kiosk with no 기부 tile — or while 기부 is 준비중
          (unreachable) — it would sit there fetching a page nothing can reach. */}
      {hasDonation && !DONATION_COMING_SOON && (() => {
        const active = !photoActive && cur === 'donation';
        return (
          <div
            style={
              active
                ? { position: 'absolute', inset: 0, zIndex: 2 }
                : { position: 'absolute', top: 0, left: 0, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }
            }
          >
            <DonationWebScreen url={donationUrl(controller.kioskId)} controller={controller} />
          </div>
        );
      })()}
      </div>
    </KioskArtboard>
  );
}
