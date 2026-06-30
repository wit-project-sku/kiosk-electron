import type { CSSProperties } from 'react';
import { useKioskController } from '@renderer/hooks/useKioskController';
import { useWeatherSync } from '@renderer/hooks/useWeatherSync';
import { useExchangeSync } from '@renderer/hooks/useExchangeSync';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { KioskArtboard } from '../components/KioskScreenImage';
import { PhotoWorkflow } from '../photo/PhotoWorkflow';
import { HwaseongExchange } from './HwaseongExchange';
import { HwaseongHome } from './HwaseongHome';
import { HwaseongLanguage } from './HwaseongLanguage';
import { HwaseongSearch } from './HwaseongSearch';
import { HwaseongTaxFree } from './HwaseongTaxFree';
import { HwaseongRestStop } from './HwaseongRestStop';
import { HwaseongWebScreen } from './HwaseongWebScreen';
import { HwaseongListScreen } from './HwaseongListScreen';
import { HwaseongMarketScreen } from './HwaseongMarketScreen';
import { HwaseongHello } from './HwaseongHello';
import { HwaseongDetail } from './HwaseongDetail';
import { HwaseongMarketDetail } from './HwaseongMarketDetail';
import { HwaseongHelp } from './HwaseongHelp';
import { HwaseongLocalpay } from './HwaseongLocalpay';
import { HwaseongNationwideRestStop } from './HwaseongNationwideRestStop';
import { HwaseongMap } from './HwaseongMap';
import { HwaseongScreen } from './HwaseongScreen';
import { useDetailStore } from '@renderer/store/detailStore';

const FOOD_TABS = ['한식', '한정식', '바베큐', '분식', '사찰음식'];
// 뭐사지 Figma tabs (node 4167-173813) — the shop data has no second category,
// so these render for visual parity with the design.
const SHOP_TABS = ['의류', '공예품', '수제도장', '엔틱', '화방', '한복', '잡화', '표구·액자', '기념품', '기타'];

/** Theme the shared AR 한복 photo workflow with the 화성휴게소 blue (#005ab4). */
const PHOTO_THEME = {
  '--photo-accent': '#005ab4',
  '--photo-accent-soft': '#daecfe',
  '--photo-tint': '#eef4fa',
  '--photo-accent-alt': '#616161',
} as CSSProperties;

export function HwaseongKiosk(): JSX.Element {
  const controller = useKioskController();
  useWeatherSync();
  useExchangeSync();

  const cur = controller.screen;
  const photoActive = controller.photoActive;
  const detailFrom = useDetailStore((s) => s.item?.from);

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
      <HwaseongWebScreen controller={controller} title="화성시 이벤트" url="https://withevent.kr/kiosk/events?region=hwaseong&category=ALL&page=1" />
    ) : cur === 'transport' ? (
      <HwaseongWebScreen controller={controller} title="전국도로교통상황" url="https://www.its.go.kr/" />
    ) : cur === 'food_court' ? (
      <HwaseongListScreen controller={controller} title="'휴' 뭐먹지" baseCategory="휴 뭐먹지" defaultTabs={FOOD_TABS} />
    ) : cur === 'shop' ? (
      <HwaseongListScreen controller={controller} title="'휴' 뭐사지" baseCategory="휴 뭐사지" fixedTabs={SHOP_TABS} />
    ) : cur === 'market' ? (
      <HwaseongMarketScreen controller={controller} />
    ) : cur === 'hello' ? (
      <HwaseongHello controller={controller} />
    ) : cur === 'detail' ? (
      detailFrom === 'market' ? (
        <HwaseongMarketDetail controller={controller} />
      ) : (
        <HwaseongDetail controller={controller} />
      )
    ) : cur === 'rest_info' ? (
      <HwaseongLocalpay controller={controller} />
    ) : cur === 'help' ? (
      <HwaseongHelp controller={controller} />
    ) : cur === 'restroom' ? (
      <HwaseongHelp controller={controller} defaultTab="화장실" noScroll />
    ) : cur === 'convenience' ? (
      <HwaseongNationwideRestStop controller={controller} />
    ) : cur === 'parking' ? (
      <HwaseongMap controller={controller} />
    ) : cur === 'exchange' ? (
      <HwaseongExchange controller={controller} />
    ) : (
      <HwaseongScreen screen={cur} controller={controller} />
    );

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
      {foreground}
    </KioskArtboard>
  );
}
