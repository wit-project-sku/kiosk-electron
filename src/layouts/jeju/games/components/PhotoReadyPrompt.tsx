/**
 * "Your photo is ready — keep playing, or see it?"
 *
 * ══ WHY THE PHOTO ASKS INSTEAD OF TAKING THE SCREEN ═══════════════════
 * The AI photo used to end whatever the visitor was doing the moment it
 * arrived: 틀린그림찾기 handed over a few seconds after a round finished, and
 * the idle sweep could pull the screen out from under a game. Visitors were in
 * the middle of something they were enjoying and it vanished without them
 * touching anything.
 *
 * The photo is not going anywhere — the workflow holds it until this screen
 * hands over — so the right move is to TELL them and let them choose. This
 * sheet slides up over the game once, when the photo lands. 계속 게임하기
 * closes it and nothing else changes; every screen behind it keeps its own
 * 사진 보기 so the choice can be made later.
 *
 * A bottom sheet rather than a centred modal: it covers the banner band, not
 * the game, so a visitor mid-round can still see what they were doing.
 */
import { pick, useLang } from '@renderer/lib/i18n';
import { TEXT } from '../gameText';
import { GameButton } from './GameButton';
import { PhotoIcon } from './GameIcons';
import styles from './PhotoReadyPrompt.module.css';

interface Props {
  onKeepPlaying: () => void;
  onSeePhoto: () => void;
}

export function PhotoReadyPrompt({ onKeepPlaying, onSeePhoto }: Props): JSX.Element {
  const lang = useLang();

  return (
    <div className={styles.scrim}>
      <section className={styles.sheet} role="dialog" aria-modal="true">
        <div className={styles.head}>
          <span className={styles.icon}>
            <PhotoIcon size={96} />
          </span>
          <div className={styles.text}>
            <p className={styles.title}>{pick(TEXT.photoReady, lang)}</p>
            <p className={styles.sub}>{pick(TEXT.photoReadyChoice, lang)}</p>
          </div>
        </div>
        <div className={styles.actions}>
          <GameButton variant="ghost" onClick={onKeepPlaying}>
            {pick(TEXT.keepPlaying, lang)}
          </GameButton>
          <GameButton variant="primary" onClick={onSeePhoto}>
            {pick(TEXT.seePhoto, lang)}
          </GameButton>
        </div>
      </section>
    </div>
  );
}
