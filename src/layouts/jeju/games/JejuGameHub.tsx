/**
 * 제주 게임 — the menu the AR wait opens on.
 *
 * ── Why a menu at all ─────────────────────────────────────────────────
 * The wait used to drop straight into 틀린그림찾기. One game is a good minute
 * for the visitor it suits and a dead minute for everyone else, and there is no
 * way for them to say so. A menu costs one tap and turns the wait into a choice.
 *
 * ── One list, and each row says how it is played ──────────────────────
 * The two games are two very different postures — a finger on the glass, or a
 * camera watching your hand — and that choice has to be deliberate. It used to
 * be carried by section headings, an orange camera badge and a tinted edge.
 * Now each row states it once, as a plain label with an icon, which says the
 * same thing with a third of the furniture.
 *
 * ── The photo is always on screen ─────────────────────────────────────
 * The status line under the list is the only non-game element, and it is not
 * decoration: the visitor is standing here because a photo of them is being
 * generated. When the photo lands, the line becomes the primary button.
 */
import type { ComponentType } from 'react';
import { pick, useLang } from '@renderer/lib/i18n';
import type { JejuGameId } from './gameTypes';
import { isMotionGame } from './gameTypes';
import { TEXT } from './gameText';
import { MOTION } from './motion/motionText';
import { sfx } from './gameSound';
import { GameShell } from './components/GameShell';
import { GameButton } from './components/GameButton';
import { CameraIcon, ChevronIcon, RunIcon, SpotDiffIcon, TouchIcon } from './components/GameIcons';
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

/** Menu order. Touch first: it asks nothing of the visitor but a tap. */
const GAMES: { id: JejuGameId; Icon: ComponentType<{ size?: number }> }[] = [
  { id: 'spotdiff', Icon: SpotDiffIcon },
  { id: 'jeju-run', Icon: RunIcon },
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
    spotdiff: { name: pick(TEXT.spotDiffName, lang), desc: pick(TEXT.spotDiffDesc, lang) },
    'jeju-run': { name: pick(MOTION.runName, lang), desc: pick(MOTION.runDesc, lang) },
  };

  return (
    <GameShell
      headerTitle="AR 한복체험"
      title={pick(TEXT.hubTitle, lang)}
      subtitle={pick(TEXT.hubSubtitle, lang)}
      onHome={onHome}
      navDisabled={navLocked}
      chrome={
        <>
          <ul className={styles.list}>
            {GAMES.map(({ id, Icon }, index) => {
              const camera = isMotionGame(id);
              const best = byGame[id];
              return (
                <li key={id} className={styles.item} style={{ animationDelay: `${index * 60}ms` }}>
                  <button
                    type="button"
                    className={styles.card}
                    onClick={() => {
                      sfx.tap();
                      onPick(id);
                    }}
                  >
                    <span className={styles.tile}>
                      <Icon size={210} />
                    </span>

                    <span className={styles.body}>
                      <span className={styles.name}>{label[id].name}</span>
                      <span className={styles.desc}>{label[id].desc}</span>
                      <span className={styles.meta}>
                        <span className={styles.mode}>
                          {camera ? <CameraIcon size={40} /> : <TouchIcon size={40} />}
                          {camera ? pick(TEXT.motionGames, lang) : pick(TEXT.touchGames, lang)}
                        </span>
                        {best !== undefined && best > 0 && (
                          <span className={styles.best}>
                            {pick(MOTION.runBest, lang)} {best}
                          </span>
                        )}
                      </span>
                    </span>

                    <ChevronIcon size={64} className={styles.chevron} />
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Only once something has been scored — an empty "0" is a scoreboard
              telling a visitor they have failed at a game they have not played. */}
          {total > 0 && (
            <p className={styles.points}>
              <span className={styles.pointsLabel}>{pick(TEXT.points, lang)}</span>
              <span className={styles.pointsValue}>{total}</span>
            </p>
          )}

          <div className={styles.status}>
            {aiReady ? (
              <GameButton variant="primary" onClick={onSeePhoto} className={styles.statusButton}>
                {pick(TEXT.seePhoto, lang)}
              </GameButton>
            ) : (
              <p className={styles.statusText}>
                <span className={styles.spinner} aria-hidden />
                {pick(TEXT.photoWorking, lang)}
              </p>
            )}
          </div>
        </>
      }
    />
  );
}
