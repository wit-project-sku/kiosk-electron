/**
 * 🏝️ 제주 게임 — the card menu the AR wait now opens on.
 *
 * ── Why a menu at all ─────────────────────────────────────────────────
 * The wait used to drop straight into 틀린그림찾기. One game is a good minute
 * for the visitor it suits and a dead minute for everyone else, and there is no
 * way for them to say so. A menu costs one tap and turns the wait into a
 * choice — which is also what makes every game after the first worth building.
 *
 * 틀린그림찾기 is still here. It is not replaced.
 *
 * ── Two kinds of game, and the split is the important part ────────────
 * The menu is grouped into 터치 게임 and 모션 게임, and they are NOT interleaved.
 * The difference between them is not a feature, it is a posture: one is played
 * with a finger while standing at the glass, the other requires stepping BACK
 * from the kiosk and moving your whole body in a public airport concourse. A
 * visitor deciding between them is really deciding whether they want to be seen
 * doing that, and burying a camera game among touch games would spring it on
 * them. The 📷 badge and the section heading exist to make that choice
 * deliberate.
 *
 * ── The photo is always on screen ─────────────────────────────────────
 * The status row under the cards is the only non-game element, and it is not
 * decoration: the visitor is standing here because a photo of them is being
 * generated, and a games menu that never mentions it would read as the kiosk
 * having forgotten. When the photo lands, the row becomes the primary button.
 */
import { pick, useLang } from '@renderer/lib/i18n';
import type { JejuGameId } from './gameTypes';
import { TEXT } from './gameText';
import { MOTION } from './motion/motionText';
import { sfx } from './gameSound';
import { GameShell } from './components/GameShell';
import { GameButton } from './components/GameButton';
import { useJejuPointsStore, useJejuPointsTotal } from './jejuPointsStore';
import styles from './JejuGameHub.module.css';

interface Props {
  onPick: (game: JejuGameId) => void;
  /** The kiosk's real home — destructive while the photo generates. */
  onHome: () => void;
  navLocked: boolean;
  aiReady: boolean;
  onSeePhoto: () => void;
}

interface CardSpec {
  id: JejuGameId;
  glyph: string;
  /** Plate tint. One per game, so the cards are told apart by colour too. */
  tint: string;
  name: string;
  desc: string;
}

/**
 * 🏺 rather than the 🥤 of the classic shell game: the cups on that screen are
 * 제주 옹기, and the card should promise what the game actually shows.
 */
const TOUCH_CARDS: Omit<CardSpec, 'name' | 'desc'>[] = [
  { id: 'catch', glyph: '🍊', tint: '#fff0dc' },
  { id: 'cup', glyph: '🏺', tint: '#f1ecff' },
  { id: 'spotdiff', glyph: '🔍', tint: '#e6f1fb' },
];

const MOTION_CARDS: Omit<CardSpec, 'name' | 'desc'>[] = [
  { id: 'body-catch', glyph: '🙆', tint: '#ffe8d0' },
  { id: 'pose', glyph: '🕺', tint: '#efe4fb' },
  { id: 'dodge', glyph: '🌋', tint: '#ffe0d6' },
];

export function JejuGameHub({
  onPick,
  onHome,
  navLocked,
  aiReady,
  onSeePhoto,
}: Props): JSX.Element {
  const lang = useLang();
  const total = useJejuPointsTotal();
  const byGame = useJejuPointsStore((s) => s.byGame);

  const label: Record<JejuGameId, { name: string; desc: string }> = {
    catch: { name: pick(TEXT.catchName, lang), desc: pick(TEXT.catchDesc, lang) },
    cup: { name: pick(TEXT.cupName, lang), desc: pick(TEXT.cupDesc, lang) },
    spotdiff: { name: pick(TEXT.spotDiffName, lang), desc: pick(TEXT.spotDiffDesc, lang) },
    'body-catch': { name: pick(MOTION.catchName, lang), desc: pick(MOTION.catchDesc, lang) },
    pose: { name: pick(MOTION.poseName, lang), desc: pick(MOTION.poseDesc, lang) },
    dodge: { name: pick(MOTION.dodgeName, lang), desc: pick(MOTION.dodgeDesc, lang) },
  };

  const renderCard = (
    card: Omit<CardSpec, 'name' | 'desc'>,
    index: number,
    motion: boolean,
  ): JSX.Element => {
    const best = byGame[card.id];
    return (
      <button
        key={card.id}
        type="button"
        className={`${styles.card} ${styles.cardIn} ${motion ? styles.cardMotion : ''}`}
        // Staggered by index. Inline because it is per-card data, not a style
        // rule — an nth-child rule per card says the same thing worse.
        style={{ animationDelay: `${index * 70}ms` }}
        onClick={() => {
          sfx.tap();
          onPick(card.id);
        }}
      >
        {motion && (
          <span className={styles.cameraBadge} aria-hidden>
            📷
          </span>
        )}
        <span className={styles.plate} style={{ background: card.tint }}>
          <span className={styles.plateGlyph} aria-hidden>
            {card.glyph}
          </span>
        </span>
        <span className={styles.cardName}>{label[card.id].name}</span>
        <span className={styles.cardDesc}>{label[card.id].desc}</span>
        {best !== undefined && best > 0 && <span className={styles.cardBest}>⭐ {best}</span>}
      </button>
    );
  };

  return (
    <GameShell
      headerTitle="AR 한복체험"
      title={`🏝️ ${pick(TEXT.hubTitle, lang)}`}
      subtitle={pick(TEXT.hubSubtitle, lang)}
      onHome={onHome}
      navDisabled={navLocked}
      chrome={
        <>
          <p className={`${styles.sectionLabel} ${styles.sectionTouch}`}>
            👆 {pick(TEXT.touchGames, lang)}
          </p>
          <div className={`${styles.row} ${styles.rowTouch}`}>
            {TOUCH_CARDS.map((c, i) => renderCard(c, i, false))}
          </div>

          <p className={`${styles.sectionLabel} ${styles.sectionMotion}`}>
            📷 {pick(TEXT.motionGames, lang)}
          </p>
          <div className={`${styles.row} ${styles.rowMotion}`}>
            {MOTION_CARDS.map((c, i) => renderCard(c, i + 3, true))}
          </div>

          {/* Only once something has been scored — an empty "JEJU POINTS 0" is
              a scoreboard telling a visitor they have failed at a game they
              have not played yet. */}
          {total > 0 && (
            <div className={styles.points}>
              <div className={styles.pointsPill}>
                <span>⭐ {pick(TEXT.points, lang)}</span>
                <span className={styles.pointsValue}>{total}</span>
              </div>
            </div>
          )}

          <div className={styles.status}>
            {aiReady ? (
              <GameButton variant="primary" onClick={onSeePhoto}>
                📸 {pick(TEXT.seePhoto, lang)}
              </GameButton>
            ) : (
              <>
                <span className={styles.spinner} aria-hidden />
                <p className={styles.statusText}>{pick(TEXT.photoWorking, lang)}</p>
              </>
            )}
          </div>
        </>
      }
    />
  );
}
