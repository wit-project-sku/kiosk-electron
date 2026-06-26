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
}

/**
 * On-screen keyboard rendered inline inside the artboard, positioned right under
 * the search bar (Figma 검색: 키보드 tray at y=900, 2160×1000). A transparent
 * backdrop closes it on any outside tap, mirroring real focus/blur behaviour.
 */
export function FloatingKeyboard({ open, onKey, onClose, lang }: FloatingKeyboardProps): JSX.Element | null {
  if (!open) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      {/* preventDefault on mousedown keeps the tap from clearing focus/selection
          or triggering any default action (no flicker, no refresh). */}
      <div className={styles.panel} onMouseDown={(e) => e.preventDefault()}>
        <VirtualKeyboard onKey={onKey} lang={lang} />
      </div>
    </>
  );
}
