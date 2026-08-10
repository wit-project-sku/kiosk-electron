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
 *  - DonationWebScreen (기부) — W006 has hasDonation, one URL for every kiosk.
 */
import type { CSSProperties } from 'react';
import { useKioskController } from '@renderer/hooks/useKioskController';
import { useWeatherSync } from '@renderer/hooks/useWeatherSync';
import { useExchangeSync } from '@renderer/hooks/useExchangeSync';
import { WEB_EMBED_URLS } from '@shared/constants/webEmbeds';
import { KioskArtboard } from '../components/KioskScreenImage';
import { DonationWebScreen } from '../components/DonationWebScreen';
import { PhotoWorkflow } from '../photo/PhotoWorkflow';
import { JejuAiSearch } from './JejuAiSearch';
import { JejuHome } from './JejuHome';
import { JejuLanguage } from './JejuLanguage';
import { JejuScreen } from './JejuScreen';
import { JejuSearch } from './JejuSearch';

/** Theme the shared AR 한복 photo workflow with the 제주 orange (#ff7f0f, the
 *  Figma `[제주] main 01` token). NOTE: photoChrome.tsx resolves Jeju's icons but
 *  still renders InsadongHeader — the photo flow shows the INSADONG wordmark
 *  until a JejuHeader exists. */
const PHOTO_THEME = {
  '--photo-accent': '#ff7f0f',
  '--photo-accent-soft': '#f5f1ef',
  '--photo-tint': '#fdf4ec',
  '--photo-accent-alt': '#616161',
} as CSSProperties;

export function JejuKiosk(): JSX.Element {
  const controller = useKioskController();
  useWeatherSync();
  useExchangeSync();

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
  ) : cur === 'search' ? (
    <JejuSearch controller={controller} />
  ) : cur === 'donation' ? (
    <DonationWebScreen url={WEB_EMBED_URLS.donation} controller={controller} />
  ) : (
    <JejuScreen screen={cur} controller={controller} />
  );

  // No background is painted here: 제주 uses a DIFFERENT one per screen — the home
  // screen's flat cream `bg`, and `bg-page` (an illustration at 70% over white)
  // on every sub-page. Each screen owns its own, so nothing paints a background
  // that the next layer immediately covers.
  return <KioskArtboard>{foreground}</KioskArtboard>;
}
