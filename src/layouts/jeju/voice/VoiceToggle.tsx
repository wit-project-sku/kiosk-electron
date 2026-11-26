import { useKioskStore } from '@renderer/store/kioskStore';
import { VOICE_TOGGLE_EVENT, useVoiceStore } from './voiceStore';

const GLYPH_STYLE = { display: 'block', width: '100%', height: '100%', pointerEvents: 'none' } as const;

/**
 * The 음성 안내 on/off button, under the ♿ toggle on the 제주 rail. The one way to
 * turn voice on by touch; a keypad press still does it too.
 *
 * Renders nothing off 제주: the photo flow's screens are shared with other venues,
 * and only JejuKiosk mounts the voice guidance this button drives. The caller
 * supplies the position, as it does for the ♿ button above it.
 *
 * The art is a draft in ♿'s colours until there is a Figma frame for it.
 */
export function VoiceToggle({ className }: { className?: string }): JSX.Element | null {
  const on = useVoiceStore((s) => s.on);
  const isJeju = useKioskStore((s) => s.config.layout.startsWith('JEJU'));
  if (!isJeju) return null;
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(VOICE_TOGGLE_EVENT))}
      aria-label="음성 안내"
      aria-pressed={on}
    >
      <svg viewBox="0 0 85 85" style={GLYPH_STYLE} aria-hidden="true">
        <circle cx="42.5" cy="42.5" r="42.5" fill="#FF7F0F" />
        <path d="M19 35h10l14-12v39L29 50H19z" fill="#fff" />
        {on ? (
          <g fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round">
            <path d="M50 34.5a11 11 0 0 1 0 16" />
            <path d="M56.5 27.5a21 21 0 0 1 0 30" />
          </g>
        ) : (
          <g fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round">
            <path d="M51 35l14 15" />
            <path d="M65 35L51 50" />
          </g>
        )}
      </svg>
    </button>
  );
}
