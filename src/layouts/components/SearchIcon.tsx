interface SearchIconProps {
  className?: string;
}

/** Magnifier used on Insa / Osan / Hwaseong search fields. Shape matches Hwaseong home. */
export function SearchIcon({ className }: SearchIconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="80"
      height="77"
      viewBox="0 0 80 77"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M60.8219 58.9L75.5 72.5M70.7667 36.2333C70.7667 53.7592 55.9324 67.9667 37.6333 67.9667C19.3343 67.9667 4.5 53.7592 4.5 36.2333C4.5 18.7075 19.3343 4.5 37.6333 4.5C55.9324 4.5 70.7667 18.7075 70.7667 36.2333Z"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
      />
    </svg>
  );
}
