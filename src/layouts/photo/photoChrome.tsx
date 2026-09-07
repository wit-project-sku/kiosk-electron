import type { ComponentType } from 'react';
import { getKioskLocation, isJejuLayout, isKadaLayout } from '@shared/config/kioskLocations';
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
}

/**
 * The shared photo (AI 한복) workflow must adopt the host kiosk's chrome —
 * background, header wordmark and nav icons — not insadong's. This resolves the
 * right assets/header from the active kiosk layout. Osan/Hwaseong reuse insadong's
 * hanbok CONTENT (outfit images) but their own THEME (bg/header/icons/colours).
 */
export function usePhotoChrome(): PhotoChrome {
  const kioskId = useKioskStore((s) => s.config.kioskId);
  const layout = getKioskLocation(kioskId).layout;
  const isOsan = layout === 'OSAN';
  const isHwaseong = layout === 'HWASEONG';
  const isJeju = isJejuLayout(layout);
  const isKada = isKadaLayout(layout);

  const icon = isOsan
    ? (name: string) => osanIconUrl(name) ?? iconUrl(name)
    : isHwaseong
      ? (name: string) => hwaseongIconUrl(name) ?? iconUrl(name)
      : isJeju
        ? (name: string) => jejuIconUrl(name) ?? iconUrl(name)
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
    isKada,
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
