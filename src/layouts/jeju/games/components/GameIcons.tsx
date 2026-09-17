/**
 * Line icons for the 제주 game screens.
 *
 * One small set, one stroke weight, drawn in `currentColor` so the caller picks
 * the colour. Emoji were used here before, and a row of emoji in tinted circles
 * is exactly what made these screens look templated — the hand shapes are the
 * one place emoji stay, because ✌️ ✋ ✊ ARE the controls and a visitor has to
 * recognise the literal gesture.
 */
interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

/** 틀린그림찾기 — two frames side by side, one marked. */
export function SpotDiffIcon({ size = 48, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <rect x="4" y="10" width="17" height="24" rx="3" />
      <rect x="27" y="10" width="17" height="24" rx="3" />
      <circle cx="35.5" cy="22" r="4.5" />
      <path d="M12.5 40v-3M35.5 40v-3" />
    </svg>
  );
}

/** 제주 달리기 — a runner mid-stride. */
export function RunIcon({ size = 48, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="29" cy="8.5" r="3.5" />
      <path d="M17 19l7-5 6 4 4 7 6 1" />
      <path d="M24 14l-3 12 7 6-2 10" />
      <path d="M21 26l-6 6H8" />
    </svg>
  );
}

/** Played with a finger on the glass. */
export function TouchIcon({ size = 48, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M19 26V9a3.5 3.5 0 0 1 7 0v12" />
      <path d="M26 20a3.5 3.5 0 0 1 7 0v3M33 22a3.5 3.5 0 0 1 7 0v8c0 8-5 13-12 13h-2c-5 0-8-3-11-7l-6-8a3.2 3.2 0 0 1 5-4l4 4" />
    </svg>
  );
}

/** Uses the camera. */
export function CameraIcon({ size = 48, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6 16a4 4 0 0 1 4-4h5l3-4h12l3 4h5a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" />
      <circle cx="24" cy="25" r="7" />
    </svg>
  );
}

export function ChevronIcon({ size = 48, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <path d="M18 10l14 14-14 14" />
    </svg>
  );
}

/** The AI photo — a framed picture with a mountain and sun. */
export function PhotoIcon({ size = 48, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <rect x="5" y="8" width="38" height="32" rx="4" />
      <circle cx="17" cy="19" r="3.5" />
      <path d="M5 34l11-10 8 7 6-5 13 11" />
    </svg>
  );
}

/** "Look at the other screen" — a monitor with an arrow up into it. */
export function ScreenUpIcon({ size = 48, className }: IconProps): JSX.Element {
  return (
    <svg {...base(size)} className={className}>
      <rect x="5" y="4" width="38" height="24" rx="3" />
      <path d="M24 44V34M18 39l6-6 6 6" />
    </svg>
  );
}
