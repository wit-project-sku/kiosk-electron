import type { ComponentType } from 'react';
import {
  getKioskLocation,
  isInsadongLayout,
  isJejuLayout,
  isKadaLayout,
  usesGestureCapture,
} from '@shared/config/kioskLocations';
import { useKioskStore } from '@renderer/store/kioskStore';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { kadaIconUrl } from '@renderer/assets/icons/kada';
import { InsadongHeader } from '@layouts/insadong/InsadongHeader';
import { OsanHeader } from '@layouts/osan/OsanHeader';
import { HwaseongHeader } from '@layouts/hwaseong/HwaseongHeader';
import { JejuHeader } from '@layouts/jeju/JejuHeader';
import { KadaHeader } from '@layouts/kada/KadaHeader';

/** Header props common to every location header used by the photo workflow. */
export interface PhotoHeaderProps {
  title: string;
  onHome: () => void;
  onBack?: () => void;
  subtitle?: string;
  /**
   * Drop the description row under the title. Like `navDisabled` below, only
   * JejuHeader honours it — its header otherwise resolves a subtitle from the
   * sheet (or a generic fallback) even when none is passed, which is what the
   * AR 한복체험 page uses this to switch off. A no-op on the other headers, which
   * draw a subtitle only when one is explicitly given.
   */
  subtitleHidden?: boolean;
  /**
   * Grey out 홈/뒤로 and stop them responding.
   *
   * ★ Only JejuHeader honours this — it is the only location with a screen that
   * must not be walked away from (틀린그림찾기, which runs over a photo that is
   * already generating). Passing it to the other three is a no-op rather than an
   * error, so if another location ever grows a comparable screen, wire the prop
   * in that header rather than assuming this one already did.
   */
  navDisabled?: boolean;
}

export interface PhotoChrome {
  isOsan: boolean;
  isHwaseong: boolean;
  /** 제주 replaces the whole outfit-selection step — see JejuHanbokSelect. */
  isJeju: boolean;
  /** 인사동 W001–W003 (both INSADONG and NAM_INSADONG layouts). */
  isInsadong: boolean;
  /** KADA (W202) — the venue's K-CULTURE CHALLENGE entry into this same flow. */
  isKada: boolean;
  /** Icon resolver for the active location (falls back to insadong). */
  icon: (name: string) => string | undefined;
  /** Location-correct content header (OSAEK MARKET / INSADONG / HWASEONG SA). */
  Header: ComponentType<PhotoHeaderProps>;
  /** Title for the outfit/capture page — Figma differs per location. */
  photoTitle: string;
  /** Single promo banner for this location (undefined → insadong rotates its set). */
  banner: string | undefined;

  /* ── Photo-flow capabilities ──────────────────────────────────────────
     These three used to be spelled `isJeju` at each call site in
     PhotoWorkflow. They are separate NAMED capabilities now because 인사동
     adopted the same three together (2026-09-28) and a fourth location may
     well want one without the others — `isJeju` as a stand-in for "has the
     rich flow" stopped being true the moment a second location had it.

     They travel as a set for a reason: see `gestureCapture`. */

  /**
   * Draw the rich outfit picker (JejuHanbokSelect) instead of the legacy
   * HanbokSelect. API-driven throughout — tabs come from
   * `/api/outfits/categories` and cards from `/api/outfits`, both already
   * filtered by kioskId — so it renders the HOST location's catalogue, not
   * 제주's. 인사동 has 7 categories / 72 outfits and no `jeju` category, which
   * simply leaves the background-theme tab unbuilt.
   */
  richOutfit: boolean;
  /**
   * Hand the capture trigger to the visitor's open palm rather than starting
   * the countdown on a timer.
   *
   * ★ Requires `richOutfit`. This went fleet-wide once before (2026-08-24 →
   * 08-26) and was pulled back precisely because the legacy camera screen
   * draws no palm/fist chips: the gate then reads as a silent ~30s stall until
   * the fallback timer fires. Never set this without the screen that explains
   * it.
   */
  gestureCapture: boolean;
  /** Fill the AI wait with the 게임존 instead of a static popup. */
  waitingGames: boolean;
  /**
   * Whether the 게임존 offers the camera games as well as the touch ones.
   *
   * 제주-only for now: the motion games run on the CUSTOMER DISPLAY and need
   * pose tracking on its camera, and the one that exists (`jeju-run`) is
   * Jeju-branded end to end. 인사동 takes the hub with 틀린그림찾기 alone,
   * whose puzzles come from a GLOBAL endpoint (no kioskId) and so need no
   * per-location content.
   */
  motionGames: boolean;
}

/**
 * The shared photo (AI 한복) workflow must adopt the host kiosk's chrome —
 * background, header wordmark and nav icons — not insadong's. This resolves the
 * right assets/header from the active kiosk layout. Osan/Hwaseong reuse insadong's
 * hanbok CONTENT (outfit images) but their own THEME (bg/header/icons/colours).
 */
/**
 * Photo-flow icon name → the 제주 asset that actually carries that art.
 *
 * The rail asks for insadong's names (`home-btn` / `back-arrow`), 제주 ships
 * neither, and the resolver below falls through to insadong — which draws its
 * home button as a SOLID #fe6c50 coral disc. Beside 제주's own ♿ button in
 * #ff7f0f, the rail read as one button in the wrong brand colour.
 *
 * 제주 does have the pair, under the names its header uses: hdr-home.svg is
 * filled #FF7F0F and hdr-back.svg is the white outline twin. Aliasing here fixes
 * every photo screen that draws the rail, not just the one it was noticed on,
 * and leaves the other locations untouched.
 */
const JEJU_PHOTO_ICON_ALIASES: Record<string, string> = {
  'home-btn': 'hdr-home',
  'back-arrow': 'hdr-back',
};

export function usePhotoChrome(): PhotoChrome {
  const kioskId = useKioskStore((s) => s.config.kioskId);
  const layout = getKioskLocation(kioskId).layout;
  const isOsan = layout === 'OSAN';
  const isHwaseong = layout === 'HWASEONG';
  const isJeju = isJejuLayout(layout);
  const isKada = isKadaLayout(layout);
  const isInsadong = isInsadongLayout(layout);

  const icon = isOsan
    ? (name: string) => osanIconUrl(name) ?? iconUrl(name)
    : isHwaseong
      ? (name: string) => hwaseongIconUrl(name) ?? iconUrl(name)
      : isJeju
        ? (name: string) => jejuIconUrl(JEJU_PHOTO_ICON_ALIASES[name] ?? name) ?? iconUrl(name)
        : isKada
          ? // KADA ships no AR-screen art of its own — only the home furniture in
            // assets/icons/kada. Everything the capture/result steps ask for
            // (bg, camera-popup, nav-circle, …) therefore falls through to
            // insadong, exactly as Osan and Hwaseong did before their own sets
            // were drawn. Drop KADA versions into assets/icons/kada under the
            // SAME base names to override one at a time.
            (name: string) => kadaIconUrl(name) ?? iconUrl(name)
          : iconUrl;

  const Header = (
    isOsan
      ? OsanHeader
      : isHwaseong
        ? HwaseongHeader
        : isJeju
          ? JejuHeader
          : isKada
            ? KadaHeader
            : InsadongHeader
  ) as ComponentType<PhotoHeaderProps>;

  return {
    isOsan,
    isHwaseong,
    isJeju,
    isInsadong,
    isKada,
    // 인사동 joined 제주 on all three 2026-09-28; Osan/Hwaseong/KADA keep the
    // legacy picker and the timer countdown.
    richOutfit: isJeju || isInsadong,
    // Shared with the customer display, which draws the chips — see the helper.
    gestureCapture: usesGestureCapture(layout),
    waitingGames: isJeju || isInsadong,
    motionGames: isJeju,
    icon,
    Header,
    // KADA's audience reads English and Vietnamese, not Korean — this string is
    // drawn straight into the photo header, so it is the one place the shared
    // flow would otherwise show Korean to a Hanoi visitor.
    // Every KADA header carries the venue wordmark, not a per-screen name —
    // Figma 4618:2742 and the partner pages all draw 'KADA' in the centre slot.
    // It doubles as the one string here that must never be Korean: KADA has no
    // Localization sheet, so a t() lookup would fall back to it.
    photoTitle: isKada ? 'KADA' : isOsan ? '사진 촬영' : 'AR 한복체험',
    banner: isKada
      ? // No promo banner at this venue, and '' is the only way to SAY that:
        // consumers resolve `chromeBanner ?? rotating`, so undefined would fall
        // back to insadong's rotating set — 인사동 shop advertising on a Hanoi
        // kiosk. '' is non-nullish so it wins the ??, and every render site
        // guards with `{banner && …}`, so nothing is drawn.
        ''
      : isOsan
        ? osanIconUrl('banner')
        : isHwaseong
          ? hwaseongIconUrl('fg-banner')
          : isJeju
            ? // `fg-banner` is HWASEONG's asset name — 제주's is `banner-hanbok`, the
              // 가상 한복 착장 art every AR 한복체험 frame draws. Asking for the wrong
              // name resolved to undefined, so the Jeju photo flow silently fell back
              // to INSADONG's rotating banners.
              jejuIconUrl('banner-hanbok')
            : undefined,
  };
}
