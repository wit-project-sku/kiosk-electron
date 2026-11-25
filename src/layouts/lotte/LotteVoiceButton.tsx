import { lotteIconUrl } from '@renderer/assets/icons/lotte';
import { VOICE_TOGGLE_EVENT, useVoiceStore } from '../jeju/voice/voiceStore';

/**
 * The 음성 안내 on/off button on the 롯데 rail (home) and on every page (LottePageFrame), in the
 * frame's own art. The one way to turn voice on by touch; useJejuVoice (mounted by LotteKiosk)
 * owns what turning it on and off says. `onClass` marks it while voice is on.
 */
export function LotteVoiceButton({ className, onClass }: { className?: string; onClass?: string | undefined }): JSX.Element | null {
  const on = useVoiceStore((s) => s.on);
  const icon = lotteIconUrl('rail-voice');
  if (!icon) return null;
  return (
    <button
      type="button"
      className={`${className ?? ''} ${on && onClass ? onClass : ''}`}
      onClick={() => window.dispatchEvent(new Event(VOICE_TOGGLE_EVENT))}
      aria-label="음성 안내"
      aria-pressed={on}
    >
      <img src={icon} alt="" draggable={false} />
    </button>
  );
}
