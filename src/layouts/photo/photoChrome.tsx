import type { ComponentType } from 'react';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { useKioskStore } from '@renderer/store/kioskStore';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { InsadongHeader } from '@layouts/insadong/InsadongHeader';
import { OsanHeader } from '@layouts/osan/OsanHeader';

/** Header props common to both InsadongHeader and OsanHeader. */
export interface PhotoHeaderProps {
  title: string;
  onHome: () => void;
  onBack?: () => void;
  subtitle?: string;
}

export interface PhotoChrome {
  isOsan: boolean;
  /** Icon resolver for the active location (Osan overrides; falls back to insadong). */
  icon: (name: string) => string | undefined;
  /** Location-correct content header (OSAEK MARKET vs INSADONG). */
  Header: ComponentType<PhotoHeaderProps>;
  /** Title for the outfit/capture page — Figma differs per location. */
  photoTitle: string;
}

/**
 * The shared photo (AI 한복) workflow must adopt the host kiosk's chrome —
 * background, header wordmark and nav icons — not insadong's. This resolves the
 * right assets/header from the active kiosk layout. Osan reuses insadong's
 * hanbok CONTENT (outfit images) but its own THEME (bg/header/icons/colours).
 */
export function usePhotoChrome(): PhotoChrome {
  const kioskId = useKioskStore((s) => s.config.kioskId);
  const isOsan = getKioskLocation(kioskId).layout === 'OSAN';
  return {
    isOsan,
    icon: isOsan ? (name) => osanIconUrl(name) ?? iconUrl(name) : iconUrl,
    Header: (isOsan ? OsanHeader : InsadongHeader) as ComponentType<PhotoHeaderProps>,
    photoTitle: isOsan ? '사진 촬영' : 'AR 한복체험',
  };
}
