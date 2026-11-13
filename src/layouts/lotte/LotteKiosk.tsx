/**
 * Screen router for the 롯데 venues (W011~W013) — publishing stage: real layouts, sample data
 * (lotteSample.ts). The shared flows are the same ones 제주 uses: PhotoWorkflow; FillMe is a recoloured copy in ./fillme.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useKioskController } from '@renderer/hooks/useKioskController';
import { useWeatherSync } from '@renderer/hooks/useWeatherSync';
import { useShopStore } from '@renderer/store/shopStore';
import { WEB_EMBED_URLS } from '@shared/constants/webEmbeds';
import { KioskArtboard } from '../components/KioskScreenImage';
import { PhotoWorkflow } from '../photo/PhotoWorkflow';
import { LotteFillme } from './fillme/LotteFillme';
import { LotteAbout } from './LotteAbout';
import { LotteCinema } from './LotteCinema';
import { LotteDetail } from './LotteDetail';
import { LotteEvents } from './LotteEvents';
import { LotteHello } from './LotteHello';
import { LotteHome } from './LotteHome';
import { LotteLanguage } from './LotteLanguage';
import { LotteListScreen } from './LotteListScreen';
import { LotteSearch } from './LotteSearch';
import { LotteWebScreen } from './LotteWebScreen';
import { LotteWhatToDo, type LotteVisitChoice } from './LotteWhatToDo';
import { LotteRestroom } from './LotteRestroom';
import { lotteShopsFor } from './lotteSample';

const PHOTO_THEME = {
  '--photo-accent': '#DA291C',
} as CSSProperties;

export function LotteKiosk(): JSX.Element {
  const controller = useKioskController();
  useWeatherSync();
  const cur = controller.screen;

  /* The catalogue is the collected list until the server has these branches. `region: null` makes the
     shop service skip its fetch, so nothing overwrites this. */
  useEffect(() => {
    useShopStore.setState({ shops: lotteShopsFor(controller.kioskId), loaded: true });
  }, [controller.kioskId]);

  /* Lives here so a visit to a shop's 상세 and back keeps the recommendations. */
  const [visit, setVisit] = useState<LotteVisitChoice | null>(null);
  useEffect(() => {
    if (cur === 'home') setVisit(null);
  }, [cur]);

  const foreground = controller.photoActive ? (
    <div style={{ position: 'absolute', inset: 0, ...PHOTO_THEME }}>
      <PhotoWorkflow />
    </div>
  ) : cur === 'home' ? (
    <LotteHome controller={controller} />
  ) : cur === 'language' ? (
    <LotteLanguage controller={controller} />
  ) : cur === 'ai_search' ? (
    <LotteWhatToDo controller={controller} plan={visit} onPlan={setVisit} />
  ) : cur === 'search' ? (
    <LotteSearch controller={controller} />
  ) : cur === 'detail' ? (
    <LotteDetail controller={controller} />
  ) : cur === 'eat' || cur === 'shop' || cur === 'help' ? (
    <LotteListScreen screen={cur} controller={controller} />
  ) : cur === 'events' ? (
    <LotteEvents controller={controller} />
  ) : cur === 'cinema' ? (
    <LotteCinema controller={controller} />
  ) : cur === 'fillme' ? (
    <LotteFillme controller={controller} />
  ) : cur === 'about' ? (
    <LotteAbout controller={controller} />
  ) : cur === 'hello' ? (
    <LotteHello controller={controller} />
  ) : cur === 'restroom' ? (
    <LotteRestroom controller={controller} />
  ) : cur === 'market' ? (
    <LotteWebScreen
      controller={controller}
      title="위드마켓"
      subtitleKey="withMarketSubtitle"
      url={WEB_EMBED_URLS.market}
    />
  ) : (
    <LotteHome controller={controller} />
  );

  return <KioskArtboard>{foreground}</KioskArtboard>;
}
