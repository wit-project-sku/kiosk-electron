import type { ComponentType } from 'react';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { useKioskStore } from '@renderer/store/kioskStore';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { InsadongHeader } from '@layouts/insadong/InsadongHeader';
import { OsanHeader } from '@layouts/osan/OsanHeader';
import { HwaseongHeader } from '@layouts/hwaseong/HwaseongHeader';
import { JejuHeader } from '@layouts/jeju/JejuHeader';

/** Header props common to every location header used by the photo workflow. */
export interface PhotoHeaderProps {
  title: string;
  onHome: () => void;
  onBack?: () => void;
  subtitle?: string;
}

export interface PhotoChrome {
  isOsan: boolean;
  isHwaseong: boolean;
  /** 제주 replaces the whole outfit-selection step — see JejuHanbokSelect. */
  isJeju: boolean;
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
  const isJeju = layout === 'JEJU_AIRPORT';

  const icon = isOsan
    ? (name: string) => osanIconUrl(name) ?? iconUrl(name)
    : isHwaseong
      ? (name: string) => hwaseongIconUrl(name) ?? iconUrl(name)
      : isJeju
        ? (name: string) => jejuIconUrl(name) ?? iconUrl(name)
        : iconUrl;

  const Header = (
    isOsan ? OsanHeader : isHwaseong ? HwaseongHeader : isJeju ? JejuHeader : InsadongHeader
  ) as ComponentType<PhotoHeaderProps>;

  return {
    isOsan,
    isHwaseong,
    isJeju,
    icon,
    Header,
    photoTitle: isOsan ? '사진 촬영' : 'AR 한복체험',
    banner: isOsan
      ? osanIconUrl('banner')
      : isHwaseong
        ? hwaseongIconUrl('fg-banner')
        : isJeju
          // `fg-banner` is HWASEONG's asset name — 제주's is `banner-hanbok`, the
          // 가상 한복 착장 art every AR 한복체험 frame draws. Asking for the wrong
          // name resolved to undefined, so the Jeju photo flow silently fell back
          // to INSADONG's rotating banners.
          ? jejuIconUrl('banner-hanbok')
          : undefined,
  };
}
