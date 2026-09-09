/**
 * The page frame shared by the game hub and all three games.
 *
 * Everything that must look identical across the four screens lives here — the
 * 제주 background plate, the header, the title/how-to pair, the promo banner —
 * so a game file contains only its game. It also means a visitor hopping
 * between games sees the furniture stay put and only the field change, which is
 * what makes a set of separate games read as one 게임존.
 *
 * ── The back/home buttons ─────────────────────────────────────────────
 * `onHome` here is NOT the kiosk's destructive home. Inside a game it returns
 * to the card menu, and only the HUB's home reaches the real one — see the
 * nav-lock note in JejuWaitingGames for why leaving this screen for real is
 * treated so differently from leaving any other 제주 page.
 */
import type { ReactNode } from 'react';
import { usePhotoChrome } from '../../../photo/photoChrome';
import styles from './GameShell.module.css';

interface Props {
  /** Centre pill of the header. */
  headerTitle: string;
  /** Large heading over the field. */
  title: string;
  /** One line under it. Usually the game's how-to. */
  subtitle?: string;
  /** Header 홈/뒤로. Inside a game this is "back to the card menu". */
  onHome: () => void;
  /** Grey out and disable 홈/뒤로 — only JejuHeader honours this. */
  navDisabled?: boolean;
  /** HUD row and anything else that positions itself on the ARTBOARD (2160×3840). */
  chrome?: ReactNode;
  /**
   * The game itself, inside the 1900×2060 field box.
   *
   * Optional because the hub has no field: its card grid is laid out against
   * the artboard directly and goes through `chrome`. Rendering an empty field
   * box for it would leave a positioned element nothing draws into.
   */
  children?: ReactNode;
  /** Overlays that must sit above the field — countdown, result card. */
  overlay?: ReactNode;
}

export function GameShell({
  headerTitle,
  title,
  subtitle,
  onHome,
  navDisabled = false,
  chrome,
  children,
  overlay,
}: Props): JSX.Element {
  const { icon, Header, banner } = usePhotoChrome();
  // `bg-page` is the illustrated 제주 plate; `bg` is the blank #faf7f2 one. Same
  // pairing (and same silent-fallback trap) as JejuSpotDiffGame — asking for the
  // wrong name loses the artwork without erroring.
  const pageBg = icon('bg-page') || icon('bg');

  return (
    <div className={styles.root}>
      {pageBg && <img className={styles.bg} src={pageBg} alt="" draggable={false} />}

      {/* `subtitleHidden` matches steps ① and ② of the AR flow (JejuHanbokSelect):
          the 한복체험 header reads title-only by operator request. Without it
          JejuHeader resolves a generic 제주 description from the sheet and the
          game screens would carry a line about travel information over a game. */}
      <Header
        title={headerTitle}
        onHome={onHome}
        onBack={onHome}
        navDisabled={navDisabled}
        subtitleHidden
      />

      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}

      {chrome}

      {children && <div className={styles.field}>{children}</div>}

      {banner && (
        <div className={styles.banner}>
          <img src={banner} alt="" draggable={false} />
        </div>
      )}

      {overlay}
    </div>
  );
}
