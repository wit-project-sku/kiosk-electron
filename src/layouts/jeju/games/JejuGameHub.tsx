/**
 * 제주 게임 — the card menu. The AR wait does not open on this screen; it
 * opens straight into 틀린그림찾기. The jump game is not listed.
 *
 * ── The photo is always on screen ─────────────────────────────────────
 * The status line under the list is the only non-game element, and it is not
 * decoration: the visitor is standing here because a photo of them is being
 * generated. When the photo lands, the line becomes the primary button.
 */
import type { ComponentType } from 'react';
import { pick, useLang } from '@renderer/lib/i18n';
import { tExact } from '@renderer/lib/loc';
import type { JejuGameId } from './gameTypes';
import { isMotionGame } from './gameTypes';
import { usePhotoChrome } from '../../photo/photoChrome';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { TEXT } from './gameText';
import { MOTION } from './motion/motionText';
import { sfx } from './gameSound';
import { GameShell } from './components/GameShell';
import { GameButton } from './components/GameButton';
import { CameraIcon, ChevronIcon, SpotDiffIcon, TouchIcon } from './components/GameIcons';
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

/** Menu order. The jump game (jeju-run) is not offered. */
const GAMES: { id: JejuGameId; Icon: ComponentType<{ size?: number }> }[] = [
  { id: 'spotdiff', Icon: SpotDiffIcon },
];

export function JejuGameHub({
  onPick,
  onHome,
  navLocked,
  aiReady,
  onSeePhoto,
}: Props): JSX.Element {
  const lang = useLang();
  /* Camera games are offered only where the customer display can actually run
     one — see PhotoChrome.motionGames. 인사동 takes this hub with 틀린그림찾기
     alone: its display has no pose tracking wired, and `jeju-run` is Jeju-
     branded end to end. Filtering the MENU (rather than the games themselves)
     keeps every game a leaf, which is the invariant JejuWaitingGames documents. */
  const { motionGames, isJeju, isOsan } = usePhotoChrome();
  // ♿ on 오산 (7894:59610) has its own menu layout; 제주 / 인사동 keep theirs.
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const lowOsan = isOsan && lowReach;
  const games = motionGames ? GAMES : GAMES.filter((g) => !isMotionGame(g.id));
  const total = useJejuPointsTotal();
  const byGame = useJejuPointsStore((s) => s.byGame);

  const label: Record<JejuGameId, { name: string; desc: string }> = {
    spotdiff: { name: pick(TEXT.spotDiffName, lang), desc: pick(TEXT.spotDiffDesc, lang) },
    'jeju-run': { name: pick(MOTION.runName, lang), desc: pick(MOTION.runDesc, lang) },
  };

  return (
    <GameShell
      // OSAEK: AR 의상착장 (Figma 7878:43190), sheet row first.
      headerTitle={isOsan ? tExact('Photo_ArOutfitTitle', lang) || 'AR 의상착장' : 'AR 한복체험'}
      title={pick(isJeju ? TEXT.hubTitle : TEXT.hubTitleGeneric, lang)}
      subtitle={pick(isJeju ? TEXT.hubSubtitle : TEXT.hubSubtitleGeneric, lang)}
      onHome={onHome}
      navDisabled={navLocked}
      lowOsan={lowOsan}
      chrome={
        <div className={lowOsan ? styles.lowOsan : undefined} style={{ display: 'contents' }}>
          <ul className={styles.list}>
            {games.map(({ id, Icon }, index) => {
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
              <span className={styles.pointsLabel}>{pick(isJeju ? TEXT.points : TEXT.pointsGeneric, lang)}</span>
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
        </div>
      }
    />
  );
}
