import type { SupportedLanguage } from '@shared/types/kiosk';
import { VirtualKeyboard, type KeyAction } from './VirtualKeyboard';
import styles from './FloatingKeyboard.module.css';

interface FloatingKeyboardProps {
  open: boolean;
  onKey: (action: KeyAction) => void;
  /** Called when the user taps outside the keyboard (loses focus). */
  onClose: () => void;
  /** Active UI language — picks the initial keyboard layout (Korean vs English). */
  lang: SupportedLanguage;
  /** Use the light (non-dark) backspace key — Hwaseong design. */
  lightBackspace?: boolean;
  /**
   * Artboard y of the tray's top edge, so it sits flush under THIS layout's
   * search bar. Defaults to 900 — the Insadong/Osan/Hwaseong position, where the
   * search bar ends at ~903.
   *
   * Pass it whenever a layout puts its search bar somewhere else: 제주's sits at
   * y1138–1320, and with the 900 default the tray rendered ABOVE the search bar
   * instead of under it.
   */
  top?: number;
}

/**
 * On-screen keyboard rendered inline inside the artboard, positioned right under
 * the search bar (Figma 검색: 키보드 tray at y=900, 2160×1000 — see {@link
 * FloatingKeyboardProps.top}). A transparent backdrop closes it on any outside
 * tap, mirroring real focus/blur behaviour.
 */
export function FloatingKeyboard({ open, onKey, onClose, lang, lightBackspace, top }: FloatingKeyboardProps): JSX.Element | null {
  if (!open) return null;

  return (
    <>
      {/* `data-pad-dismiss` is how 제주's barrier-free keypad closes this tray:
          its ✕ presses whatever carries the marker before it means "go back".
          Deliberately NOT a <button> or [role="button"] — the backdrop covers
          the whole artboard, and making it focusable would give the keypad's
          arrows a full-screen landing spot to fall into. Every other layout
          ignores the attribute. See jeju/keypad/useJejuKeypad. */}
      <div className={styles.backdrop} data-pad-dismiss onClick={onClose} />
      {/* preventDefault on mousedown keeps the tap from clearing focus/selection
          or triggering any default action (no flicker, no refresh). */}
      <div
        className={styles.panel}
        style={top == null ? undefined : { top }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <VirtualKeyboard onKey={onKey} lang={lang} lightBackspace={lightBackspace} />
      </div>
    </>
  );
}
