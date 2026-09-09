/**
 * The score card every game ends on.
 *
 * ── The three buttons, and why the third is conditional ───────────────
 * 한 판 더 / 다른 게임 are always offered. 사진 보기 appears ONLY once the photo
 * has landed, because before that there is nothing to show — a button that
 * leads to a spinner is worse than no button, and this screen exists precisely
 * to keep the visitor off that spinner.
 *
 * When the photo IS ready, 사진 보기 becomes the primary action and the two game
 * buttons drop to ghost. The visitor came for the photo; the games were the
 * wait. The hierarchy should say so without taking the choice away — someone
 * mid-streak is still allowed another round.
 */
import type { ReactNode } from 'react';
import { pick, useLang } from '@renderer/lib/i18n';
import { TEXT } from '../gameText';
import { GameButton } from './GameButton';
import styles from './gameUi.module.css';

interface Props {
  /** Big glyph at the top of the card. */
  emoji: string;
  title: string;
  /** The number under the title. Omit for a card that has nothing to count. */
  score?: number;
  /** One line under the score — "12개를 받았어요". */
  note?: string;
  /** Anything between the note and the buttons (stamp row, round dots). */
  extra?: ReactNode;
  /**
   * The three action handlers and `aiReady` are optional because a card can be
   * drawn with no buttons at all — see {@link Props.hideActions}. On the
   * customer display nothing is pressable, so requiring them would only force
   * three no-op callbacks per game.
   */
  onPlayAgain?: () => void;
  onBackToGames?: () => void;
  onSeePhoto?: () => void;
  aiReady?: boolean;
  /** Drop the confetti burst behind the card. */
  celebrate?: boolean;
  /**
   * Render the card with NO buttons.
   *
   * For the customer display, which has no touchscreen: Monitor 2 celebrates
   * the score and Monitor 1's remote carries every control. A row of buttons
   * nobody can press would read as a frozen screen.
   */
  hideActions?: boolean;
  /**
   * Replaces 한 판 더 with a caller-supplied primary action — the hunt's
   * "제주 여행 둘러보기". Still shown alongside 다른 게임.
   */
  primaryOverride?: { label: string; onPress: () => void; disabled?: boolean };
}

/** Fixed burst. Enough to read as celebration, few enough to stay composited. */
const CONFETTI_COUNT = 28;
const CONFETTI_COLORS = ['#ff7f0f', '#ffc43d', '#ff5a5f', '#3ec1a0', '#5aa9ff', '#ffe08a'];

/**
 * Pre-computed at module scope, NOT per render: the pieces must not re-randomise
 * when the card re-renders (a language change, a late `aiReady`), which would
 * restart every animation mid-fall.
 */
const CONFETTI = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
  left: (i * 97) % 100,
  delay: (i * 137) % 900,
  duration: 2200 + ((i * 311) % 1500),
  spin: 360 + ((i * 233) % 720),
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] as string,
}));

export function GameResult({
  emoji,
  title,
  score,
  note,
  extra,
  onPlayAgain,
  onBackToGames,
  onSeePhoto,
  aiReady = false,
  celebrate = false,
  hideActions = false,
  primaryOverride,
}: Props): JSX.Element {
  const lang = useLang();

  return (
    <>
      {celebrate && (
        <div className={styles.confetti} aria-hidden>
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className={styles.confettiPiece}
              style={
                {
                  left: `${c.left}%`,
                  background: c.color,
                  '--cf-delay': `${c.delay}ms`,
                  '--cf-dur': `${c.duration}ms`,
                  '--cf-spin': `${c.spin}deg`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      <div className={styles.resultScrim}>
        <div className={styles.resultCard}>
          <span className={styles.resultEmoji} aria-hidden>
            {emoji}
          </span>
          <h2 className={styles.resultTitle}>{title}</h2>

          {score !== undefined && <span className={styles.resultScore}>{score}</span>}
          {note && <p className={styles.resultNote}>{note}</p>}
          {extra && <div className={styles.resultExtra}>{extra}</div>}

          {!hideActions && (
            <div className={styles.resultActions}>
              {aiReady && (
                <GameButton variant="primary" onClick={onSeePhoto ?? (() => {})}>
                  {pick(TEXT.seePhoto, lang)}
                </GameButton>
              )}

              {primaryOverride ? (
                <GameButton
                  variant={aiReady ? 'ghost' : 'primary'}
                  onClick={primaryOverride.onPress}
                  disabled={primaryOverride.disabled}
                >
                  {primaryOverride.label}
                </GameButton>
              ) : (
                <GameButton
                  variant={aiReady ? 'ghost' : 'primary'}
                  onClick={onPlayAgain ?? (() => {})}
                >
                  {pick(TEXT.playAgain, lang)}
                </GameButton>
              )}

              <GameButton variant="ghost" onClick={onBackToGames ?? (() => {})}>
                {pick(TEXT.backToGames, lang)}
              </GameButton>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
