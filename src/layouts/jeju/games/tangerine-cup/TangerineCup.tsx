/**
 * 감귤은 어디에? — the screen.
 *
 * All game truth is in {@link useTangerineCup}; this file only draws it. The
 * one rule it has to keep on its own is that a cup is only a TAP TARGET during
 * the 'choose' phase — the engine drops taps from any other phase, and the
 * markup agrees rather than relying on that alone.
 *
 * The cups are 제주 옹기 — the island's dark, ash-glazed earthenware — rather
 * than the plastic cups of the fairground version. Same game, and it belongs to
 * the room it is standing in.
 */
import { useCallback, useMemo } from 'react';
import { pick, useLang } from '@renderer/lib/i18n';
import type { HostedGameProps } from '../gameTypes';
import { TEXT } from '../gameText';
import { GameShell } from '../components/GameShell';
import { GameHud } from '../components/GameHud';
import { GameResult } from '../components/GameResult';
import {
  CUP_IDS,
  POINTS_PER_ROUND,
  ROUNDS,
  SLOT_X,
  TOTAL_ROUNDS,
  useTangerineCup,
  type CupId,
} from './useTangerineCup';
import styles from './TangerineCup.module.css';

/** One 옹기 cup, upturned. Pure markup — no state, no ids that could collide. */
function CupArt({ id }: { id: CupId }): JSX.Element {
  // Gradient ids must be unique per instance: three cups sharing one id means
  // whichever mounts last owns the fill for all of them.
  const g = `cup-${id}`;
  return (
    <svg
      className={styles.cupArt}
      viewBox="0 0 420 620"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={`${g}-body`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5c4433" />
          <stop offset="26%" stopColor="#8a6a4e" />
          <stop offset="52%" stopColor="#a8825f" />
          <stop offset="78%" stopColor="#7a5c43" />
          <stop offset="100%" stopColor="#4d3829" />
        </linearGradient>
        <linearGradient id={`${g}-rim`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3f2e22" />
          <stop offset="50%" stopColor="#6d5138" />
          <stop offset="100%" stopColor="#3a2a1e" />
        </linearGradient>
      </defs>

      {/* Body — narrower at the top, belled at the base, the way an upturned
          옹기 actually sits. */}
      <path
        d="M132 62 C 132 30 288 30 288 62 L 342 540 C 350 578 316 596 210 596 C 104 596 70 578 78 540 Z"
        fill={`url(#${g}-body)`}
      />
      {/* Shoulder highlight — one soft band, not a plastic specular dot. */}
      <path
        d="M164 84 C 164 70 200 66 208 84 L 236 540 C 238 558 190 560 188 540 Z"
        fill="#ffffff"
        opacity="0.16"
      />
      {/* The glaze rings a wheel-thrown pot carries. */}
      {[190, 300, 410].map((y, i) => (
        <path
          key={i}
          d={`M${86 + (410 - y) * 0.11} ${y} C 210 ${y + 16} 210 ${y + 16} ${
            334 - (410 - y) * 0.11
          } ${y}`}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="7"
          fill="none"
        />
      ))}
      {/* Base rim, drawn last so it reads as the near edge of the opening. */}
      <ellipse cx="210" cy="588" rx="132" ry="26" fill={`url(#${g}-rim)`} />
      <ellipse cx="210" cy="584" rx="112" ry="18" fill="#2c1f16" opacity="0.85" />
      {/* Knob. */}
      <ellipse cx="210" cy="52" rx="52" ry="22" fill="#6d5138" />
      <ellipse cx="210" cy="46" rx="52" ry="22" fill="#8a6a4e" />
    </svg>
  );
}

/** The hidden fruit. Same construction as the falling tangerines, in SVG. */
function FruitArt(): JSX.Element {
  return (
    <svg
      className={styles.fruitArt}
      viewBox="0 0 220 220"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id="cupfruit" cx="0.36" cy="0.32" r="0.75">
          <stop offset="0%" stopColor="#ffc16b" />
          <stop offset="45%" stopColor="#ff9526" />
          <stop offset="100%" stopColor="#ee6d05" />
        </radialGradient>
      </defs>
      <ellipse cx="110" cy="122" rx="86" ry="80" fill="url(#cupfruit)" />
      <ellipse
        cx="84"
        cy="94"
        rx="26"
        ry="18"
        fill="#ffffff"
        opacity="0.42"
        transform="rotate(-28 84 94)"
      />
      <circle cx="110" cy="188" r="11" fill="#96460a" opacity="0.3" />
      <rect x="104" y="26" width="13" height="26" rx="6" fill="#7a5230" />
      <ellipse cx="142" cy="30" rx="34" ry="16" fill="#4f9b5c" transform="rotate(-22 142 30)" />
    </svg>
  );
}

export function TangerineCup({
  onExit,
  onAward,
  aiReady,
  onSeePhoto,
}: HostedGameProps): JSX.Element {
  const lang = useLang();
  const handleDone = useCallback((score: number) => onAward(score), [onAward]);
  const game = useTangerineCup(handleDone);

  /**
   * Stable ref callbacks, one per cup.
   *
   * An inline `ref={(el) => ...}` is a NEW function on every render, and React
   * responds by calling the old one with null and the new one with the element
   * — every render. `registerCup` parks a cup at its slot, so that would snap
   * all three cups home in the middle of a swap animation. `game.registerCup`
   * is stable, so this map is built once.
   */
  const { registerCup } = game;
  const cupRefs = useMemo(
    () =>
      Object.fromEntries(
        CUP_IDS.map((id) => [
          id,
          (el: HTMLDivElement | null): void => {
            registerCup(id, el);
          },
        ]),
      ) as Record<CupId, (el: HTMLDivElement | null) => void>,
    [registerCup],
  );

  const { phase } = game;
  const choosing = phase === 'choose';
  const revealing = phase === 'reveal' || phase === 'result';
  const wasCorrect = game.pickedSlot !== null && game.pickedSlot === game.revealSlot;

  /** One line, and which colour it takes. */
  const prompt = (() => {
    if (phase === 'show' || phase === 'settle' || phase === 'intro') {
      return { text: pick(TEXT.cupWatch, lang), accent: false };
    }
    if (phase === 'shuffle') return { text: pick(TEXT.cupShuffling, lang), accent: false };
    if (choosing) return { text: pick(TEXT.cupChoose, lang), accent: true };
    return {
      text: wasCorrect ? pick(TEXT.cupCorrect, lang) : pick(TEXT.cupWrong, lang),
      accent: false,
    };
  })();

  /** A cup is up when it is peeking at the start, or being revealed. */
  const isCupUp = (slot: number): boolean => {
    if (phase === 'show') return slot === game.fruitSlot;
    if (revealing) return slot === game.revealSlot || slot === game.pickedSlot;
    return false;
  };

  const roundDots = (compact: boolean): JSX.Element => (
    <div className={compact ? styles.resultRounds : styles.rounds}>
      {ROUNDS.map((_, i) => {
        const outcome = game.history[i];
        const cls =
          outcome === true
            ? styles.roundDotGood
            : outcome === false
              ? styles.roundDotBad
              : i === game.round && !compact
                ? styles.roundDotNow
                : '';
        return (
          <span key={i} className={`${styles.roundDot} ${cls}`}>
            {outcome === true ? '✓' : outcome === false ? '·' : i + 1}
          </span>
        );
      })}
    </div>
  );

  return (
    <GameShell
      headerTitle="AR 한복체험"
      title={pick(TEXT.cupName, lang)}
      subtitle={pick(TEXT.cupDesc, lang)}
      onHome={onExit}
      chrome={
        <GameHud
          top={920}
          score={game.score}
          middle={
            <>
              <span style={{ fontSize: 40, fontWeight: 700, color: '#9a9a9a' }}>
                {pick(TEXT.cupRound, lang)}
              </span>
              <span style={{ fontSize: 86, fontWeight: 800, color: '#333' }}>
                {Math.min(game.round + 1, TOTAL_ROUNDS)} / {TOTAL_ROUNDS}
              </span>
            </>
          }
        />
      }
      overlay={
        phase === 'result' ? (
          <GameResult
            emoji={game.correctCount >= 3 ? '🏆' : '🍊'}
            title={pick(TEXT.cupResultTitle, lang)}
            score={game.score}
            note={`${game.correctCount}/${TOTAL_ROUNDS} ${pick(TEXT.cupCorrectCount, lang)}`}
            extra={roundDots(true)}
            onPlayAgain={game.restart}
            onBackToGames={onExit}
            onSeePhoto={onSeePhoto}
            aiReady={aiReady}
            celebrate={game.correctCount >= 3}
          />
        ) : null
      }
    >
      <div className={styles.stage} onContextMenu={(e) => e.preventDefault()}>
        <div className={styles.table} />
        <div className={styles.tableEdge} />

        {/* Keyed on the phase so each new instruction replays its entrance. */}
        <p
          key={phase}
          className={`${styles.prompt} ${styles.promptIn} ${
            prompt.accent ? styles.promptAccent : ''
          }`}
        >
          {prompt.text}
        </p>

        {/* Shadows are separate elements so they can stay on the table while
            their cup lifts off it. */}
        {SLOT_X.map((x, slot) => (
          <div
            key={`shadow-${slot}`}
            className={`${styles.cupShadow} ${isCupUp(slot) ? styles.cupShadowUp : ''}`}
            style={{ transform: `translateX(${x}px)` }}
          />
        ))}

        {/* The fruit. Rendered only when the engine says it is visible — during
            the shuffle it is not in the DOM at all, so it cannot leak. */}
        {game.fruitSlot !== null && (
          <div
            className={styles.fruit}
            style={{ transform: `translateX(${SLOT_X[game.fruitSlot]}px)` }}
          >
            {revealing && <span className={styles.fruitGlow} />}
            <span className={revealing ? styles.fruitPop : ''}>
              <FruitArt />
            </span>
          </div>
        )}

        {/* One element per CUP IDENTITY, never per slot: the identity is what
            carries the fruit, and re-keying these by slot would make React
            recycle the wrong element on every swap. */}
        {CUP_IDS.map((id) => {
          const slot = game.slotOfCup(id);
          const up = isCupUp(slot);
          const isWrongPick =
            revealing && !wasCorrect && game.pickedSlot === slot && slot !== game.revealSlot;
          return (
            <div
              key={id}
              ref={cupRefs[id]}
              className={`${styles.cup} ${choosing ? styles.cupTappable : ''} ${
                isWrongPick ? styles.cupWrong : ''
              }`}
              // Only a live target during 'choose'. The engine gates this too;
              // both, because a tap that visibly does nothing is better than a
              // tap that is silently swallowed.
              onPointerDown={choosing ? () => game.choose(slot) : undefined}
              role={choosing ? 'button' : undefined}
              aria-label={choosing ? `cup ${slot + 1}` : undefined}
            >
              <div className={`${styles.lift} ${up ? styles.liftUp : ''}`}>
                <CupArt id={id} />
              </div>
            </div>
          );
        })}

        {revealing && (
          <>
            <p
              className={`${styles.verdict} ${wasCorrect ? styles.verdictGood : styles.verdictBad}`}
            >
              {wasCorrect ? pick(TEXT.cupCorrect, lang) : pick(TEXT.cupWrong, lang)}
            </p>
            {!wasCorrect && <p className={styles.verdictSub}>{pick(TEXT.cupWasHere, lang)}</p>}
            {wasCorrect && <span className={styles.plus}>+{POINTS_PER_ROUND}</span>}
          </>
        )}

        {roundDots(false)}
      </div>
    </GameShell>
  );
}
