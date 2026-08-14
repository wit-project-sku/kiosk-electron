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
 * ── The gesture prompt is now REAL ────────────────────────────────────
 * The design's "오른손을 들면 카운트다운이 시작됩니다" used to describe a trigger
 * the app did not have — the count started on the 등록하기 press and a raised
 * hand did nothing. It is wired now (`PhotoGestureGate`), with two changes to
 * the wording it was written with:
 *
 *  - EITHER hand. The detector does not care which, and telling a visitor to
 *    use their right hand only makes them fail with their left.
 *  - The line follows the gate. Once counting, the useful thing to say is not
 *    how to start — they already have — but that a fist will stop it.
 *
 * This one line IS the whole explanation. There was briefly a full-screen
 * briefing card over this screen listing both gestures up front; it was cut as
 * redundant, and it was — the header already says the only thing that is
 * actionable right now, and saying the other half early means saying it before
 * there is a countdown to stop. The gate walks the visitor through both in the
 * order they need them, which is what the card was doing more loudly.
 */
import type { RefObject } from 'react';
import { PHOTO_COUNTDOWN_SECONDS } from '@shared/constants/photoOptions';
import type { PhotoGestureGate } from '@shared/types/photo';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { pick } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import styles from './JejuCameraGuide.module.css';

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  lang: Lang;
  /** Live seconds remaining, or null before the count starts. */
  countdown: number | null;
  /** 손동작 게이트 — 'off' at every other location. See PhotoGestureGate. */
  gestureGate: PhotoGestureGate;
  /**
   * Hand detection could not start (no model, no GPU delegate, a camera the
   * landmarker cannot read). The hint must then stop asking for a gesture that
   * nothing is watching for — see `hintFor`.
   */
  detectionUnavailable: boolean;
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

/** Gate 'waiting' — the briefing overlay is up; this is what shows beneath it. */
const SHOW_PALM = {
  ko: '손바닥을 펴면 카운트다운이 시작됩니다.',
  en: 'Show an open palm to start the countdown.',
  ja: '手のひらを開くとカウントダウンが始まります。',
  zh: '张开手掌即开始倒计时。',
  vi: 'Xòe bàn tay để bắt đầu đếm ngược.',
  th: 'แบมือเพื่อเริ่มนับถอยหลัง',
  ru: 'Раскройте ладонь, чтобы начать отсчёт.',
  id: 'Buka telapak tangan untuk memulai hitungan mundur.',
};

/** Gate 'running' — they already started it; tell them how to stop it. */
const MAKE_FIST = {
  ko: '주먹을 쥐면 카운트다운이 멈춥니다.',
  en: 'Make a fist to pause the countdown.',
  ja: '手を握るとカウントダウンが止まります。',
  zh: '握拳即可暂停倒计时。',
  vi: 'Nắm tay lại để tạm dừng đếm ngược.',
  th: 'กำมือเพื่อหยุดนับถอยหลัง',
  ru: 'Сожмите кулак, чтобы остановить отсчёт.',
  id: 'Kepalkan tangan untuk menjeda hitungan mundur.',
};

/** Gate 'held' — the count is frozen; the only thing to say is how to resume. */
const RESUME_HINT = {
  ko: '손바닥을 펴면 이어서 셉니다.',
  en: 'Open your palm to continue.',
  ja: '手のひらを開くと続きから再開します。',
  zh: '张开手掌即可继续。',
  vi: 'Xòe bàn tay để tiếp tục.',
  th: 'แบมือเพื่อไปต่อ',
  ru: 'Раскройте ладонь, чтобы продолжить.',
  id: 'Buka telapak tangan untuk melanjutkan.',
};

const PAUSED = {
  ko: '일시정지',
  en: 'Paused',
  ja: '一時停止',
  zh: '已暂停',
  vi: 'Tạm dừng',
  th: 'หยุดชั่วคราว',
  ru: 'Пауза',
  id: 'Dijeda',
};

/**
 * Detection is down — the fallback timer is about to start the countdown on its
 * own. Asking for a palm here would be the one thing this screen must never do:
 * promise a gesture that does nothing, and leave the visitor holding it up at a
 * kiosk that cannot see them.
 */
const AUTO_START = {
  ko: '잠시 후 촬영이 자동으로 시작됩니다.',
  en: 'The photo will start automatically in a moment.',
  ja: 'まもなく自動で撮影が始まります。',
  zh: '稍后将自动开始拍摄。',
  vi: 'Ảnh sẽ được chụp tự động sau giây lát.',
  th: 'ระบบจะเริ่มถ่ายภาพอัตโนมัติในอีกสักครู่',
  ru: 'Съёмка начнётся автоматически через несколько секунд.',
  id: 'Pemotretan akan dimulai otomatis sebentar lagi.',
};

/**
 * The bottom line of the header — the whole gesture explanation, one state at a
 * time. Only 제주's gated flow has anything useful to say here; an ungated
 * countdown ('off') has no gesture to describe, so it keeps the design's
 * original invitation rather than inventing a fourth state.
 */
function hintFor(
  gate: PhotoGestureGate,
  detectionUnavailable: boolean,
): Partial<Record<Lang, string>> {
  if (gate === 'running') return MAKE_FIST;
  if (gate === 'held') return RESUME_HINT;
  // Only the waiting state can be lying: once counting, the count is real
  // whether or not a hand ever started it.
  if (gate === 'waiting' && detectionUnavailable) return AUTO_START;
  return SHOW_PALM;
}

export function JejuCameraGuide({
  videoRef,
  lang,
  countdown,
  gestureGate,
  detectionUnavailable,
}: Props): JSX.Element {
  // Before the count starts the design shows the full duration, not a blank.
  const seconds = countdown ?? PHOTO_COUNTDOWN_SECONDS;
  const held = gestureGate === 'held';
  const glasses = jejuIconUrl('ico-no-glasses');
  const pose = jejuIconUrl('pose-guide');

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        {/* Held: the number is frozen, so it dims. A full-brightness numeral
            that has stopped moving reads as a crashed kiosk — this reads as a
            deliberate pause, which is what it is. */}
        <p className={`${styles.title} ${held ? styles.titleHeld : ''}`}>
          <span className={styles.count}>&lsquo;{seconds}&rsquo;</span>
          <span className={styles.titleRest}>{pick(TITLE_REST, lang)}</span>
        </p>

        <div className={styles.pill}>
          {glasses && <img src={glasses} alt="" className={styles.pillIcon} draggable={false} />}
          <p className={styles.pillText}>{pick(NO_GLASSES, lang)}</p>
        </div>

        <div className={styles.rule} />
        <p className={styles.hint}>{pick(hintFor(gestureGate, detectionUnavailable), lang)}</p>
      </div>

      <div className={styles.feedWrap}>
        <video ref={videoRef} className={styles.feed} muted playsInline />
        {/* The dashed figure the visitor lines up with — `pose-guide.png`, an
            RGBA export that is ~98% transparent (1.9% ink), so it reads as an
            outline over the live feed rather than a plate on top of it. Sized
            and placed by the CSS at its own export dimensions; see `.pose`.

            ★ The figure is drawn WITH ITS HAND RAISED, which is the gesture that
            starts the countdown. It is the instruction as much as it is a
            framing guide, so if it is ever re-exported, keep the hand up.

            Guarded like every other 제주 asset: a missing file leaves the feed
            running bare. */}
        {pose && <img src={pose} alt="" className={styles.pose} draggable={false} />}

        {/* On the FEED, not in the header: a visitor holding a fist is looking at
            themselves, checking whether the kiosk noticed. The badge has to be
            where their eyes already are. */}
        {held && (
          <div className={styles.pausedBadge}>
            <span className={styles.pausedBars} aria-hidden="true" />
            {pick(PAUSED, lang)}
          </div>
        )}
      </div>
    </div>
  );
}
