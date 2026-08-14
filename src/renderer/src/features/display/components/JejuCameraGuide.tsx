/**
 * 제주공항 (W006) customer-display camera guide — what the second screen shows
 * while the visitor is being photographed (`camera` / `countdown` modes).
 *
 * ★ Built from the designer's reference IMAGE, not a Figma node: 6268:79294 is
 * an empty white rectangle. See the note at the top of the CSS.
 *
 * 제주 replaces Insadong's screen rather than reskinning it — that one carries a
 * live countdown badge, three numbered tips, two reference-pose boxes, a
 * disclaimer and a branding line, none of which this design has.
 *
 * ── The gesture prompt is NOT wired ───────────────────────────────────
 * "오른손을 들면 카운트다운이 시작됩니다" describes a trigger the app does not
 * have: `PhotoWorkflowService.beginCountdown()` is called straight from 등록하기,
 * so the count starts on the button press and the raised hand does nothing.
 * There is no hand/pose detection anywhere in the repo. The line is rendered
 * because it is in the design, but it currently describes an intention rather
 * than the behaviour — wire it (or reword it) before this goes in front of
 * travellers.
 */
import type { RefObject } from 'react';
import { PHOTO_COUNTDOWN_SECONDS } from '@shared/constants/photoOptions';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { pick } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import styles from './JejuCameraGuide.module.css';

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  lang: Lang;
  /** Live seconds remaining, or null before the count starts. */
  countdown: number | null;
}

const TITLE_REST = {
  ko: '초 후에 촬영이 됩니다',
  en: ' seconds until the photo',
  ja: '秒後に撮影されます',
  zh: '秒后开始拍摄',
  vi: 'giây nữa sẽ chụp',
  th: 'วินาทีก่อนถ่ายภาพ',
  ru: 'секунд до снимка',
  id: 'detik lagi difoto',
};

const NO_GLASSES = {
  ko: '안경은 벗고 찍어주세요',
  en: 'Please take your glasses off',
  ja: 'メガネを外して撮影してください',
  zh: '请摘下眼镜后拍摄',
  vi: 'Vui lòng bỏ kính ra',
  th: 'กรุณาถอดแว่นก่อนถ่าย',
  ru: 'Снимите очки, пожалуйста',
  id: 'Mohon lepas kacamata Anda',
};

const RAISE_HAND = {
  ko: '오른손을 들면 카운트다운이 시작됩니다.',
  en: 'Raise your right hand to start the countdown.',
  ja: '右手を上げるとカウントダウンが始まります。',
  zh: '举起右手即开始倒计时。',
  vi: 'Giơ tay phải để bắt đầu đếm ngược.',
  th: 'ยกมือขวาเพื่อเริ่มนับถอยหลัง',
  ru: 'Поднимите правую руку, чтобы начать отсчёт.',
  id: 'Angkat tangan kanan untuk memulai hitungan mundur.',
};

export function JejuCameraGuide({ videoRef, lang, countdown }: Props): JSX.Element {
  // Before the count starts the design shows the full duration, not a blank.
  const seconds = countdown ?? PHOTO_COUNTDOWN_SECONDS;
  const glasses = jejuIconUrl('ico-no-glasses');
  const pose = jejuIconUrl('pose-guide');

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <p className={styles.title}>
          <span className={styles.count}>&lsquo;{seconds}&rsquo;</span>
          <span className={styles.titleRest}>{pick(TITLE_REST, lang)}</span>
        </p>

        <div className={styles.pill}>
          {glasses && <img src={glasses} alt="" className={styles.pillIcon} draggable={false} />}
          <p className={styles.pillText}>{pick(NO_GLASSES, lang)}</p>
        </div>

        <div className={styles.rule} />
        <p className={styles.hint}>{pick(RAISE_HAND, lang)}</p>
      </div>

      <div className={styles.feedWrap}>
        <video ref={videoRef} className={styles.feed} muted playsInline />
        {/* The dashed figure the visitor lines up with — `pose-guide.png`, a
            97%-transparent RGBA export, so it reads as an outline over the live
            feed rather than a plate on top of it. Still guarded like every other
            제주 asset: a missing file leaves the feed running bare. */}
        {pose && <img src={pose} alt="" className={styles.pose} draggable={false} />}
      </div>
    </div>
  );
}
