import type { ComponentType } from 'react';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { useKioskStore } from '@renderer/store/kioskStore';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { InsadongHeader } from '@layouts/insadong/InsadongHeader';
import { OsanHeader } from '@layouts/osan/OsanHeader';
import { HwaseongHeader } from '@layouts/hwaseong/HwaseongHeader';

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

  const icon = isOsan
    ? (name: string) => osanIconUrl(name) ?? iconUrl(name)
    : isHwaseong
      ? (name: string) => hwaseongIconUrl(name) ?? iconUrl(name)
      : iconUrl;

  const Header = (
    isOsan ? OsanHeader : isHwaseong ? HwaseongHeader : InsadongHeader
  ) as ComponentType<PhotoHeaderProps>;

  return {
    isOsan,
    isHwaseong,
    icon,
    Header,
    photoTitle: isOsan ? '사진 촬영' : 'AR 한복체험',
    banner: isOsan ? osanIconUrl('banner') : isHwaseong ? hwaseongIconUrl('fg-banner') : undefined,
  };
}
