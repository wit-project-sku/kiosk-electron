import { useEffect } from 'react';
import { useKioskStore } from '@renderer/store/kioskStore';

/**
 * Applies kiosk theme JSON tokens as CSS custom properties on :root.
 * Loaded locally at startup — never fetched from network.
 */
export function useKioskTheme(): void {
  const theme = useKioskStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const { colors, typography, spacing } = theme;

    root.style.setProperty('--kiosk-primary', colors.primary);
    root.style.setProperty('--kiosk-primary-hover', colors.primaryHover);
    root.style.setProperty('--kiosk-secondary', colors.secondary);
    root.style.setProperty('--kiosk-bg', colors.background);
    root.style.setProperty('--kiosk-surface', colors.surface);
    root.style.setProperty('--kiosk-text', colors.text);
    root.style.setProperty('--kiosk-text-muted', colors.textMuted);
    root.style.setProperty('--kiosk-accent', colors.accent);
    root.style.setProperty('--kiosk-font', typography.fontFamily);
    root.style.setProperty('--kiosk-heading-size', typography.headingSize);
    root.style.setProperty('--kiosk-body-size', typography.bodySize);
    root.style.setProperty('--kiosk-button-size', typography.buttonSize);
    root.style.setProperty('--kiosk-screen-padding', spacing.screenPadding);
    root.style.setProperty('--kiosk-button-gap', spacing.buttonGap);

    root.style.backgroundColor = colors.background;
    root.style.color = colors.text;
    root.style.fontFamily = typography.fontFamily;
  }, [theme]);
}
