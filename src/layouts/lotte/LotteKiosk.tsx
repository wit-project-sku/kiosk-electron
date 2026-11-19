/**
 * Screen router for the 롯데 venues (W011~W013) — publishing stage: real layouts, sample data
 * (lotteSample.ts and the per-screen lotte*.ts modules). The shared flows are the same ones 제주
 * uses: PhotoWorkflow; FillMe is a recoloured copy in ./fillme.
 *
 * 화면정의서 (2026-11-13): '롯데' 뭐하지 opens 영화 전후 코스; 영화 나눔, 오늘의 사연 and the
 * 건물 단추 (건물 안내) are new. 롯데 미션 (2026-11-16) is on hold until it is decided — its screens
 * (LotteMission.tsx) are kept but not routed.
 */
import { useEffect, type CSSProperties } from 'react';
import { useKioskController } from '@renderer/hooks/useKioskController';
import { useWeatherSync } from '@renderer/hooks/useWeatherSync';
import { useShopStore } from '@renderer/store/shopStore';
import { WEB_EMBED_URLS } from '@shared/constants/webEmbeds';
import { KioskArtboard } from '../components/KioskScreenImage';
import { useJejuKeypad } from '../jeju/keypad/useJejuKeypad';
import { useJejuVoice } from '../jeju/voice/useJejuVoice';
import { PhotoWorkflow } from '../photo/PhotoWorkflow';
import { LotteFillme } from './fillme/LotteFillme';
import { LotteAbout } from './LotteAbout';
import { LotteBuilding } from './LotteBuilding';
import { LotteCinema } from './LotteCinema';
import { LotteDetail } from './LotteDetail';
import { LotteEvents } from './LotteEvents';
import { LotteHello } from './LotteHello';
import { LotteHome } from './LotteHome';
import { LotteLanguage } from './LotteLanguage';
import { LotteListScreen } from './LotteListScreen';
import { LotteMovieCourse } from './LotteMovieCourse';
import { LotteMovieShare } from './LotteMovieShare';
import { LotteSearch } from './LotteSearch';
import { LotteStories } from './LotteStories';
import { LotteWebScreen } from './LotteWebScreen';
import { LotteRestroom } from './LotteRestroom';
import { withLotteFallback } from './lotteFacilities';

const PHOTO_THEME = {
  '--photo-accent': '#DA291C',
} as CSSProperties;

export function LotteKiosk(): JSX.Element {
  const controller = useKioskController();
  useWeatherSync();
  // 음성 안내 (the 롯데 sheet's Text-to-speech_Script): 제주's engine on 롯데's lines — see
  // lotteVoice.ts. Off until the 🔊 button or a keypad press turns it on. The keypad hook is
  // inert without the JD-KP100 attached; the voice script's key help assumes one.
  useJejuKeypad(controller);
  useJejuVoice(controller);
  const cur = controller.screen;

  /* The catalogue is the server's (region-keyed, like every kiosk), topped up with the collected
     rows it does not carry yet — see withLotteFallback. Re-applied whenever the store changes. */
  useEffect(() => {
    const fill = (): void => {
      const { shops } = useShopStore.getState();
      const merged = withLotteFallback(shops, controller.kioskId);
      // Not `loaded`: that flag is App's — setting it here would make its load() skip the API.
      if (merged !== shops) useShopStore.setState({ shops: merged });
    };
    fill();
    return useShopStore.subscribe(fill);
  }, [controller.kioskId]);

  const foreground = controller.photoActive ? (
    <div style={{ position: 'absolute', inset: 0, ...PHOTO_THEME }}>
      <PhotoWorkflow />
    </div>
  ) : cur === 'home' ? (
    <LotteHome controller={controller} />
  ) : cur === 'language' ? (
    <LotteLanguage controller={controller} />
  ) : cur === 'ai_search' ? (
    <LotteMovieCourse controller={controller} />
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
  ) : cur === 'movie_share' ? (
    <LotteMovieShare controller={controller} />
  ) : cur === 'stories' ? (
    <LotteStories controller={controller} />
  ) : cur === 'building' ? (
    <LotteBuilding controller={controller} />

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
