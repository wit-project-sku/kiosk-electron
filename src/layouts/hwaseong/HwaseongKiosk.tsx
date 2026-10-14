import type { CSSProperties } from 'react';
import { useKioskController } from '@renderer/hooks/useKioskController';
import { useWeatherSync } from '@renderer/hooks/useWeatherSync';
import { useExchangeSync } from '@renderer/hooks/useExchangeSync';
import { donationUrl } from '@shared/constants/webEmbeds';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useLang } from '@renderer/lib/i18n';
import { barrierFreeTitle } from '../insadong/barrierFree';
import { KioskArtboard } from '../components/KioskScreenImage';
import { DonationWebScreen } from '../components/DonationWebScreen';
import { PhotoWorkflow } from '../photo/PhotoWorkflow';
import { HwaseongExchange } from './HwaseongExchange';
import { HwaseongHome } from './HwaseongHome';
import { HwaseongLanguage } from './HwaseongLanguage';
import { HwaseongSearch } from './HwaseongSearch';
import { HwaseongTaxFree } from './HwaseongTaxFree';
import { HwaseongRestStop } from './HwaseongRestStop';
import { HwaseongWebScreen } from './HwaseongWebScreen';
import { HwaseongEvents } from './HwaseongEvents';
import { HwaseongListScreen } from './HwaseongListScreen';
import { HwaseongMarketScreen } from './HwaseongMarketScreen';
import { HwaseongHello } from './HwaseongHello';
import { HwaseongDetail } from './HwaseongDetail';
import { HwaseongHelp } from './HwaseongHelp';
import { HwaseongLocalpay } from './HwaseongLocalpay';
import { HwaseongNationwideRestStop } from './HwaseongNationwideRestStop';
import { HwaseongMap } from './HwaseongMap';
import { HwaseongScreen } from './HwaseongScreen';

// 전국도로교통상황 embeds https://www.its.go.kr/ — hide the site's own top
// header (#div_topHeader / #header) and footer (#footer) so only the live map
// shows inside our kiosk chrome. (.skip_nav / .header_popup are its overlays.)
const ITS_HIDE_CHROME_CSS = `
  #div_topHeader, #header, #footer, .skip_nav, .header_popup {
    display: none !important;
  }
  /* A fixed header/footer site keeps padding on html/body to reserve their
     space — that padding is the white gap left after we hide the chrome, so
     zero it (and pull the content containers to the very top). */
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    min-height: 0 !important;
  }
  #wrapper, #wrapper.mapType, #container, #contents, #content, #skipContents {
    margin: 0 !important;
    padding: 0 !important;
    top: 0 !important;
    min-height: 0 !important;
  }
`;

const FOOD_TABS = ['한식', '한정식', '바베큐', '분식', '사찰음식'];

/** ♿ mode bar height (Figma 7904:105363), the shift every participating page takes. */
const MODE_BAR = 145.759;
/**
 * Screens with their own barrier-free layout (7904:104975 home, 7904:105977
 * 언어선택, 7956:60794 상세, 7918:122434 / 122135 / 122215 화성시 이벤트;
 * 7956:82043 / 82691 / 82477 여기는 화성휴게소; 7977:94221 is the home's search
 * keyboard). 검색
 * (7909:106330) and 전국도로교통상황 (7986:94684) are drawn as the plain shift,
 * with ▲/▼ and the scroll track held in place. Every other
 * 화성 screen is moved down under the bar as a whole until its frame arrives;
 * backgrounds, the left nav and the bottom promos counter-move
 * (--hwaseong-mode-push) so they stay where the frames draw them.
 */
const MODE_DEDICATED = new Set(['home', 'language', 'detail', 'events', 'tourism']);

/** Theme the shared AR 한복 photo workflow with the 화성휴게소 blue (var(--kiosk-primary)). */
const PHOTO_THEME = {
  '--photo-accent': 'var(--kiosk-primary)',
  '--photo-accent-soft': 'var(--kiosk-secondary)',
  '--photo-tint': '#eef4fa',
  '--photo-accent-alt': '#616161',
} as CSSProperties;

export function HwaseongKiosk(): JSX.Element {
  const controller = useKioskController();
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const lang = useLang();
  useWeatherSync();
  useExchangeSync();

  const cur = controller.screen;
  const photoActive = controller.photoActive;

  const foreground = photoActive ? (
    <div style={{ position: 'absolute', inset: 0, ...PHOTO_THEME }}>
      <PhotoWorkflow />
    </div>
  ) : cur === 'home' ? (
      <HwaseongHome controller={controller} />
    ) : cur === 'language' ? (
      <HwaseongLanguage controller={controller} />
    ) : cur === 'search' ? (
      <HwaseongSearch controller={controller} />
    ) : cur === 'taxfree' ? (
      <HwaseongTaxFree controller={controller} />
    ) : cur === 'tourism' ? (
      <HwaseongRestStop controller={controller} />
    ) : cur === 'events' ? (
      <HwaseongEvents controller={controller} />
    ) : cur === 'transport' ? (
      <HwaseongWebScreen controller={controller} title="전국도로교통상황" url="https://www.its.go.kr/" injectCss={ITS_HIDE_CHROME_CSS} bodyHeight={2030} />
    ) : cur === 'food_court' ? (
      <HwaseongListScreen controller={controller} title="'휴' 뭐먹지" baseCategory="휴 뭐먹지" defaultTabs={FOOD_TABS} />
    ) : cur === 'shop' ? (
      // Figma 7918:123976 draws category tabs here too; the 뭐사지 rows carry no
      // second category yet, so the row stays empty until the data has them.
      <HwaseongListScreen controller={controller} title="'휴' 뭐사지" baseCategory="휴 뭐사지" />
    ) : cur === 'market' ? (
      <HwaseongMarketScreen controller={controller} />
    ) : cur === 'hello' ? (
      <HwaseongHello controller={controller} />
    ) : cur === 'detail' ? (
      // One 상세 for every list (Figma 7956:61987 draws 전국시장 > 상세 with it).
      <HwaseongDetail controller={controller} />
    ) : cur === 'rest_info' ? (
      <HwaseongLocalpay controller={controller} />
    ) : cur === 'help' ? (
      <HwaseongHelp controller={controller} />
    ) : cur === 'restroom' ? (
      <HwaseongHelp controller={controller} defaultTab="화장실" />
    ) : cur === 'convenience' ? (
      <HwaseongNationwideRestStop controller={controller} />
    ) : cur === 'parking' ? (
      <HwaseongMap controller={controller} />
    ) : cur === 'donation' ? (
      // Mounted on demand, matching this layout's other webview screens (TAX-FREE)
      // — Hwaseong pre-warms nothing, unlike Insadong/Osan.
      <DonationWebScreen url={donationUrl(controller.kioskId)} controller={controller} />
    ) : cur === 'exchange' ? (
      <HwaseongExchange controller={controller} />
    ) : (
      <HwaseongScreen screen={cur} controller={controller} />
    );

  // The ♿ bar is on every screen, the photo flow included. 기부 is a separate
  // website in a fullscreen webview: no bar and no shift, shown as it is.
  const barOn = lowReach && (photoActive || cur !== 'donation');
  const shiftOn = barOn && (photoActive || !MODE_DEDICATED.has(cur));
  const shiftStyle = (
    shiftOn
      ? { position: 'absolute', inset: 0, transform: `translateY(${MODE_BAR}px)`, '--hwaseong-mode-push': `${MODE_BAR}px` }
      : { position: 'absolute', inset: 0 }
  ) as CSSProperties;

  return (
    <KioskArtboard>
      {hwaseongIconUrl('bg') && (
        <img
          src={hwaseongIconUrl('bg')}
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
      {barOn && (
        <div
          style={{ position: 'absolute', top: 0, left: 0, width: 2160, height: MODE_BAR, background: '#005ab4', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Pretendard, sans-serif', fontWeight: 700, fontSize: 68, zIndex: 60 }}
        >
          {barrierFreeTitle(lang)}
        </div>
      )}
      <div style={shiftStyle}>{foreground}</div>
    </KioskArtboard>
  );
}
