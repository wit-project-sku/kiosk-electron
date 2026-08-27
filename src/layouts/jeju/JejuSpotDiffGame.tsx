/**
 * 제주공항 (W006) 틀린그림찾기 — the waiting game played on the touch screen
 * while the AR 한복 photo generates. Figma 6258:78631.
 *
 * ── Why this screen exists ────────────────────────────────────────────
 * `photo.handlers.ts` holds the AI result for a minimum of 60s
 * (`GENERATING_MIN_MS`) so the customer display's countdown can run out. Until
 * now the touch screen spent that whole minute showing a static camera-direction
 * popup. This fills it with something to do. The frame draws it as step ③ of
 * the AR flow, after ① 의상 선택 and ② 배경 테마 in JejuHanbokSelect.
 *
 * ── The one rule that shapes everything here ──────────────────────────
 * The game OUTLIVES the AI wait when it needs to. The 60s hold is a MINIMUM,
 * not a deadline: if the photo is ready while the visitor is still hunting, the
 * result waits for them, not the other way round. The component never cuts a
 * round short on `aiReady`.
 *
 * The other half of that rule is what happens when the visitor is FASTER than
 * the photo — the common case, since a good player clears a board in ~30s
 * against a 60s floor. Ending there used to drop them straight onto a spinner.
 * Now the round ends into a choice: 한 판 더 (next prefetched board, fresh
 * lives and clock) or 그냥 기다릴게요 (the spinner, deliberately). The choice is
 * only offered while the photo is NOT ready — once it is, the photo is what
 * they came for and another round would just stall it.
 *
 * So `aiReady` decides three things and none of them is "stop playing":
 * which copy the card shows, whether the replay offer appears, and when the
 * screen is finally handed to the result. Handing over is `handOver()`, which
 * is idempotent and deliberately NOT called when a round merely ends.
 *
 * Monitor 2 is held on its waiting screen for the same reason, via
 * `photo.setDeferResultDisplay` — see PhotoWorkflowService. Without it the big
 * screen would show the finished photo while the visitor is still playing for
 * it, which spoils both the game and the reveal.
 *
 * ── Where this departs from the frame, and why ────────────────────────
 * The frame is one static state: it has no lives, clock, hint or exit, because
 * it isn't drawing a game in progress. Those live in the empty band under the
 * pictures and at the two ends of the progress line — see the CSS header.
 *
 * ── Nothing here may throw the photo away ─────────────────────────────
 * Two departures from every other 제주 page, both the same rule: while the AI is
 * working, this screen has no destructive exit.
 *
 *  - The banner is drawn as the frame has it but is NOT tappable.
 *  - 홈/뒤로 are dimmed and inert until `aiReady` — see `navLocked`.
 *
 * A tap on either runs the photo reset, and the photo it discards is one the
 * visitor has already posed for and the AI is already generating. Everywhere
 * else backing out costs nothing; here it costs the thing they came for.
 * `NAV_LOCK_MAX_MS` makes sure the lock can never outlive its own reason.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { Lightbulb, Heart, Timer } from 'lucide-react';
import type { SpotDiffRound, SpotDiffSpot } from '@shared/types/spotDiff';
import { pick, useLang } from '@renderer/lib/i18n';
import { trackEvent } from '@renderer/lib/analytics';
import { useKioskStore } from '@renderer/store/kioskStore';
import { usePhotoChrome } from '../photo/photoChrome';
import styles from './JejuSpotDiffGame.module.css';

/** Wrong taps allowed before the round is lost. */
const MAX_LIVES = 5;
/**
 * How many differences the visitor has to find to win — the frame's "1/5".
 *
 * ★ A puzzle normally ships ~10 diffs and EVERY one stays a valid target — the
 * player just needs any five. That is what keeps a repeated puzzle interesting:
 * the five they happen to find differ each time, so the same picture plays like
 * a new board. Do not "select five and ignore the rest" — that throws the
 * variety away and makes a real difference read as a wrong tap.
 */
const SPOT_TARGET = 5;
/**
 * Game clock. Longer than the 60s AI hold on purpose — a game that always ended
 * first would never actually be the thing the visitor is waiting on, and the
 * screen would just go back to staring at a spinner.
 */
const GAME_SECONDS = 90;
/** Free hints per round. */
const MAX_HINTS = 1;
/** How long a hint ring stays up. */
const HINT_MS = 3000;
/** How long the ✕ stays on a wrong tap. */
const MISS_MS = 700;
/** Beat between the win/lose overlay and handing over to the result screen. */
const OUTCOME_HOLD_MS = 3200;
/**
 * Nobody has touched the 다시 하기 / 기다리기 card for this long AND the photo is
 * ready → the visitor has walked off, so let the result through rather than
 * parking the kiosk on the card. Applies ONLY once a round is over — see the
 * effect for why a round in play is deliberately exempt.
 */
const IDLE_RELEASE_MS = 20_000;
/**
 * Hard ceiling on the 홈/뒤로 lock — see `navLocked`.
 *
 * The lock is normally released by `aiReady`, which lands right after the 60s
 * floor in the common case. This bounds the case where it never lands at all: a
 * generation that neither finishes nor errors leaves `aiReady` false forever,
 * and without a ceiling the visitor is sealed on this screen with no way out.
 *
 * The global 3-minute inactivity reset is NOT that way out — it re-arms on every
 * touch, so someone jabbing the dead 홈 button (or still playing) keeps it from
 * ever firing. The escape has to be time-since-arrival, and it has to be here.
 *
 * Comfortably past the 60s `GENERATING_MIN_MS` hold in photo.handlers.ts, so it
 * never cuts the intended lock short — it only ends a lock that has stopped
 * making sense.
 */
const NAV_LOCK_MAX_MS = 90_000;
/** Step number in the AR flow, as the frame draws it. */
const STEP_NUMBER = '3';

/**
 * 'waiting' is a round that ENDED and whose player chose to sit it out rather
 * than replay. It is separate from 'won'/'lost' so the card can drop the choice
 * and show a plain spinner, and separate from 'skipped' because 'skipped' hands
 * the screen over immediately.
 */
type Outcome = 'playing' | 'won' | 'lost' | 'waiting' | 'skipped';

/** ③ heading — the frame's own wording. */
const STEP_TITLE = {
  ko: '잠시만 기다려주세요!',
  en: 'Just a moment, please!',
  ja: '少々お待ちください！',
  zh: '请稍等片刻！',
  vi: 'Vui lòng đợi một chút!',
  th: 'กรุณารอสักครู่!',
  ru: 'Пожалуйста, подождите!',
  id: 'Mohon tunggu sebentar!',
};

const PROMPT = {
  ko: '기다리는 동안 틀린 그림을 찾아보세요!',
  en: 'Spot the differences while you wait!',
  ja: 'お待ちの間に間違い探しをどうぞ！',
  zh: '等待时来找不同吧！',
  vi: 'Hãy tìm điểm khác biệt trong lúc chờ!',
  th: 'มาหาจุดต่างระหว่างรอกันเถอะ!',
  ru: 'Найдите отличия, пока ждёте!',
  id: 'Cari perbedaannya sambil menunggu!',
};

const HINT = {
  ko: '힌트',
  en: 'Hint',
  ja: 'ヒント',
  zh: '提示',
  vi: 'Gợi ý',
  th: 'คำใบ้',
  ru: 'Подсказка',
  id: 'Petunjuk',
};

const SKIP = {
  ko: '결과 보기',
  en: 'See my photo',
  ja: '結果を見る',
  zh: '查看结果',
  vi: 'Xem kết quả',
  th: 'ดูผลลัพธ์',
  ru: 'Посмотреть результат',
  id: 'Lihat hasil',
};

const WON = {
  ko: '다 찾았어요!',
  en: 'You found them all!',
  ja: '全部見つけました！',
  zh: '全部找到了！',
  vi: 'Bạn đã tìm hết!',
  th: 'พบครบทุกจุดแล้ว!',
  ru: 'Вы нашли все!',
  id: 'Semua ketemu!',
};

const LOST = {
  ko: '아쉬워요!',
  en: 'So close!',
  ja: '惜しかったです！',
  zh: '差一点！',
  vi: 'Tiếc quá!',
  th: 'เกือบแล้ว!',
  ru: 'Почти получилось!',
  id: 'Sayang sekali!',
};

const SCORE = {
  ko: '개를 찾았어요',
  en: 'found',
  ja: '個見つけました',
  zh: '处不同',
  vi: 'điểm khác biệt',
  th: 'จุด',
  ru: 'отличий',
  id: 'perbedaan',
};

const WRAPPING_UP = {
  ko: 'AI 사진을 마무리하고 있어요',
  en: 'Finishing your AI photo…',
  ja: 'AI写真を仕上げています',
  zh: '正在完成您的AI照片',
  vi: 'Đang hoàn thiện ảnh AI của bạn',
  th: 'กำลังสร้างภาพ AI ของคุณ',
  ru: 'Завершаем ваше ИИ-фото',
  id: 'Menyelesaikan foto AI Anda',
};

const READY = {
  ko: '사진이 완성됐어요!',
  en: 'Your photo is ready!',
  ja: '写真が完成しました！',
  zh: '照片已完成！',
  vi: 'Ảnh của bạn đã xong!',
  th: 'ภาพของคุณพร้อมแล้ว!',
  ru: 'Ваше фото готово!',
  id: 'Foto Anda siap!',
};

const PLAY_AGAIN = {
  ko: '한 판 더!',
  en: 'Play again',
  ja: 'もう一回！',
  zh: '再玩一次！',
  vi: 'Chơi lại!',
  th: 'เล่นอีกครั้ง!',
  ru: 'Ещё раз!',
  id: 'Main lagi!',
};

const JUST_WAIT = {
  ko: '그냥 기다릴게요',
  en: "I'll just wait",
  ja: '待ちます',
  zh: '我等一下',
  vi: 'Tôi sẽ đợi',
  th: 'ขอรอก่อน',
  ru: 'Просто подожду',
  id: 'Saya tunggu saja',
};

/** Shown with the choice, so the offer doesn't read as "your photo failed". */
const STILL_MAKING = {
  ko: 'AI가 아직 사진을 만들고 있어요',
  en: 'The AI is still making your photo',
  ja: 'AIはまだ写真を作っています',
  zh: 'AI还在生成您的照片',
  vi: 'AI vẫn đang tạo ảnh của bạn',
  th: 'AI ยังสร้างภาพของคุณอยู่',
  ru: 'ИИ ещё создаёт ваше фото',
  id: 'AI masih membuat foto Anda',
};

const LOADING = {
  ko: '게임을 불러오는 중…',
  en: 'Loading the game…',
  ja: 'ゲームを読み込み中…',
  zh: '正在加载游戏…',
  vi: 'Đang tải trò chơi…',
  th: 'กำลังโหลดเกม…',
  ru: 'Загрузка игры…',
  id: 'Memuat permainan…',
};

interface Props {
  /**
   * The boards for this session, already picked and their images decoded, from
   * `useSpotDiffRounds`. Passed in rather than fetched here so the network work
   * happens at session start instead of during the AI wait — including the
   * replay boards, which is why this is a list. Empty only while the prefetch is
   * in flight (or after it failed): the board shows its loading line and, on
   * failure, the workflow moves on without a game.
   */
  rounds: SpotDiffRound[];
  /** True once the AI result has landed (workflow phase === 'result'). */
  aiReady: boolean;
  /** The game is over — the workflow may show the result as soon as it has one. */
  onFinish: () => void;
  /** Home button in the header (abandons the photo session, as elsewhere). */
  onHome: () => void;
}

/** Distance test in NORMALIZED image space — see the note in shared/types/spotDiff. */
function hitSpot(spots: SpotDiffSpot[], found: Set<string>, x: number, y: number, aspect: number):
  | { spot: SpotDiffSpot; alreadyFound: boolean }
  | null {
  let best: { spot: SpotDiffSpot; d: number; already: boolean } | null = null;
  for (const spot of spots) {
    // y is a fraction of HEIGHT while r is a fraction of WIDTH, so the vertical
    // delta has to be converted into width-units before the two are compared —
    // otherwise the hit area is an ellipse and tall images play unfairly.
    const dx = x - spot.x;
    const dy = (y - spot.y) / aspect;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > spot.r) continue;
    const already = found.has(spot.id);
    // An UNFOUND difference beats an already-found one no matter which centre is
    // nearer. Two hit circles can overlap — nothing stops the CMS from placing
    // them that way — and picking purely by distance would let a found spot
    // shadow its neighbour, leaving a difference that can never be claimed.
    const better =
      best === null || (best.already && !already) || (best.already === already && d < best.d);
    if (better) best = { spot, d, already };
  }
  if (!best) return null;
  return { spot: best.spot, alreadyFound: best.already };
}

export function JejuSpotDiffGame({ rounds, aiReady, onFinish, onHome }: Props): JSX.Element {
  const lang = useLang();
  const kioskId = useKioskStore((s) => s.config.kioskId);
  const { icon, Header, photoTitle, banner } = usePhotoChrome();
  const pageBg = icon('bg-page') || icon('bg');

  /** Which board of `rounds` is in play; a replay advances it. */
  const [roundIdx, setRoundIdx] = useState(0);
  const [found, setFound] = useState<Set<string>>(() => new Set());
  const [misses, setMisses] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(GAME_SECONDS);
  const [outcome, setOutcome] = useState<Outcome>('playing');
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintSpotId, setHintSpotId] = useState<string | null>(null);
  /** Transient ✕ for a wrong tap: normalized position + which panel was hit. */
  const [missMark, setMissMark] = useState<{ x: number; y: number; panel: number; key: number } | null>(null);

  /**
   * The 홈/뒤로 lock's escape hatch — flips true NAV_LOCK_MAX_MS after arrival
   * and never back. See the constant for why a ceiling is not optional.
   */
  const [navLockExpired, setNavLockExpired] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setNavLockExpired(true), NAV_LOCK_MAX_MS);
    return () => clearTimeout(id);
  }, []);

  /**
   * 홈/뒤로 are dead until the photo is ready.
   *
   * Leaving THIS screen is not like leaving any other: `onHome` runs the photo
   * reset, and the photo it throws away is one the AI is already being paid to
   * generate and the visitor has already posed for. Every other 제주 page can be
   * backed out of at no cost; this one cannot, so for the ~60s it takes, it
   * isn't offered.
   *
   * Released by `aiReady` rather than by a 60s timer, because the 60s
   * (GENERATING_MIN_MS) is a FLOOR, not the finish: unlocking on the clock while
   * the photo is still 10 seconds out would hand back an exit precisely when
   * leaving is still destructive. `navLockExpired` bounds the wait either way.
   */
  const navLocked = !aiReady && !navLockExpired;

  /**
   * onFinish must fire exactly once. Note this guards the HAND-OVER, not the end
   * of a round — a round can end and be replayed any number of times before the
   * workflow is finally handed the screen.
   */
  const handedOverRef = useRef(false);
  const lastTouchRef = useRef(Date.now());

  // Wraps: a one-puzzle CMS replays the same board, which still plays
  // differently because winning takes any five of its ~10 differences.
  const round = rounds.length > 0 ? (rounds[roundIdx % rounds.length] as SpotDiffRound) : null;
  // A short puzzle can't demand five. Any diff counts, so the target is simply
  // capped by how many the round actually carries.
  const target = Math.min(SPOT_TARGET, round?.spots.length ?? SPOT_TARGET);
  const livesLeft = Math.max(0, MAX_LIVES - misses);
  const playing = outcome === 'playing' && round !== null;

  /**
   * End the current round. The functional update is the guard: timer, taps, skip
   * and the idle sweep all race for this, and only a round still in play can be
   * ended — otherwise a timer tick could overwrite a win with a loss.
   */
  const finish = useCallback((result: Outcome) => {
    setOutcome((prev) => (prev === 'playing' ? result : prev));
  }, []);

  /** Give the screen to the workflow. Idempotent across replays. */
  const handOver = useCallback(() => {
    if (handedOverRef.current) return;
    handedOverRef.current = true;
    onFinish();
  }, [onFinish]);

  /** 다시 하기 — next board, everything else back to a fresh round. */
  const playAgain = useCallback(() => {
    lastTouchRef.current = Date.now();
    setRoundIdx((i) => i + 1);
    setFound(new Set());
    setMisses(0);
    setSecondsLeft(GAME_SECONDS);
    setHintsUsed(0);
    setHintSpotId(null);
    setMissMark(null);
    setOutcome('playing');
  }, []);

  // The prefetch never produced a round (endpoint down AND no cache, or it
  // failed outright). That costs the GAME, not the photo — let the workflow
  // carry on rather than trapping the visitor on a dead board. Held off a few
  // seconds so a merely-slow prefetch still gets to show a game.
  useEffect(() => {
    if (round) return;
    const id = setTimeout(() => finish('skipped'), 4000);
    return () => clearTimeout(id);
  }, [round, finish]);

  // Nothing was ever prefetched — hand over rather than sit on a dead board.
  useEffect(() => {
    if (outcome === 'skipped' && rounds.length === 0) handOver();
  }, [outcome, rounds.length, handOver]);

  // ── Game clock ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          finish('lost');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [playing, finish]);

  // ── Abandoned kiosk rescue ────────────────────────────────────────────
  // Only armed once the photo is ready: before that there is nothing to release,
  // and cutting a quiet-but-present player short would be worse than waiting.
  // ★ Only while a round is OVER — never during play.
  //
  // Staring at two pictures without touching anything for 20s is not a visitor
  // who left, it is a visitor playing the game; ending their round there would
  // be the exact opposite of the point. A round in play needs no rescue anyway,
  // because the game clock already bounds it — it always reaches won/lost, and
  // this sweep then covers the card that follows.
  useEffect(() => {
    if (outcome === 'playing' || outcome === 'skipped' || !aiReady) return;
    const id = setInterval(() => {
      if (Date.now() - lastTouchRef.current >= IDLE_RELEASE_MS) handOver();
    }, 1000);
    return () => clearInterval(id);
  }, [outcome, aiReady, handOver]);

  // ── Hand over to the result screen ────────────────────────────────────
  // 결과 보기 / idle goes straight through. A finished round does NOT: while the
  // photo is still generating the visitor is offered 다시 하기, so handing over
  // then would yank the choice away and drop them on a spinner — the exact thing
  // this screen exists to avoid. Once the photo IS ready the outcome gets a beat
  // on screen and then the result takes over.
  useEffect(() => {
    if (outcome === 'playing') return;
    if (outcome === 'skipped') {
      handOver();
      return;
    }
    if (!aiReady) return;
    const id = setTimeout(handOver, outcome === 'waiting' ? 0 : OUTCOME_HOLD_MS);
    return () => clearTimeout(id);
  }, [outcome, aiReady, handOver]);

  useEffect(() => {
    if (outcome === 'playing' || !round) return;
    void trackEvent({
      name: 'button_clicked',
      payload: {
        screen: 'photo_spot_diff',
        outcome,
        found: found.size,
        target,
        // How many the puzzle offered, vs how many were needed — tells us
        // whether a puzzle is too hard long before anyone complains.
        available: round.spots.length,
        misses,
        secondsLeft,
        // Which attempt this was — 0 is the first board of the session.
        attempt: roundIdx,
        aiReady,
        roundId: round.id,
        placeholder: Boolean(round.placeholder),
        kioskId,
      },
    });
    // Once per round END. `roundIdx` is a dep so a replay's outcome is reported
    // too — without it the second board would be invisible in analytics.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, roundIdx]);

  // ── Hint ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hintSpotId) return;
    const id = setTimeout(() => setHintSpotId(null), HINT_MS);
    return () => clearTimeout(id);
  }, [hintSpotId]);

  useEffect(() => {
    if (!missMark) return;
    const id = setTimeout(() => setMissMark(null), MISS_MS);
    return () => clearTimeout(id);
  }, [missMark]);

  const takeHint = (): void => {
    lastTouchRef.current = Date.now();
    if (!playing || !round || hintsUsed >= MAX_HINTS) return;
    const remaining = round.spots.filter((s) => !found.has(s.id));
    if (remaining.length === 0) return;
    const pickSpot = remaining[Math.floor(Math.random() * remaining.length)];
    if (!pickSpot) return;
    setHintsUsed((n) => n + 1);
    setHintSpotId(pickSpot.id);
  };

  const handlePanelTap = (panel: number) => (event: ReactPointerEvent<HTMLDivElement>): void => {
    lastTouchRef.current = Date.now();
    if (!playing || !round) return;

    // Normalize against the RENDERED rect, so the artboard's CSS scale, the
    // plate size and the image's natural resolution all cancel out.
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    const hit = hitSpot(round.spots, found, x, y, round.aspect);

    // Re-tapping a difference already found is neither a hit nor a miss —
    // penalising it would punish the visitor for double-tapping their own win.
    if (hit?.alreadyFound) return;

    if (hit) {
      const next = new Set(found);
      next.add(hit.spot.id);
      setFound(next);
      if (hintSpotId === hit.spot.id) setHintSpotId(null);
      // Five of however many the puzzle carries — not all of them. See SPOT_TARGET.
      if (next.size >= target) finish('won');
      return;
    }

    setMissMark({ x, y, panel, key: Date.now() });
    setMisses((prev) => {
      const next = prev + 1;
      if (next >= MAX_LIVES) finish('lost');
      return next;
    });
  };

  /** One of the frame's two grey plates, with the picture fitted inside it. */
  const renderSlot = (
    panel: number,
    slotClass: string | undefined,
    src: string | undefined,
  ): JSX.Element => (
    <div className={`${styles.slot} ${slotClass ?? ''}`}>
      {round && src ? (
        <div
          className={styles.panel}
          // Drives the fit-inside arithmetic in the CSS — see the note on .panel.
          style={{ '--sd-aspect': String(round.aspect) } as CSSProperties}
          onPointerDown={handlePanelTap(panel)}
        >
          <img className={styles.panelImg} src={src} alt="" draggable={false} />

          {round.spots
            .filter((s) => found.has(s.id))
            .map((s) => (
              <span
                key={s.id}
                className={styles.foundRing}
                style={{
                  left: `${s.x * 100}%`,
                  top: `${s.y * 100}%`,
                  width: `${s.r * 2 * 100}%`,
                }}
              />
            ))}

          {hintSpotId &&
            round.spots
              .filter((s) => s.id === hintSpotId)
              .map((s) => (
                <span
                  key={`hint-${s.id}`}
                  className={styles.hintRing}
                  style={{
                    left: `${s.x * 100}%`,
                    top: `${s.y * 100}%`,
                    width: `${s.r * 2.4 * 100}%`,
                  }}
                />
              ))}

          {missMark?.panel === panel && (
            <span
              key={missMark.key}
              className={styles.missMark}
              style={{ left: `${missMark.x * 100}%`, top: `${missMark.y * 100}%` }}
            >
              ✕
            </span>
          )}

          {round.placeholder && <span className={styles.sampleTag}>샘플 이미지</span>}
        </div>
      ) : (
        <p className={styles.loading}>{pick(LOADING, lang)}</p>
      )}
    </div>
  );

  return (
    <div className={styles.root}>
      {/* `bg-page` is the illustrated 제주 plate 6258:78631 draws; `bg` is the
          BLANK #faf7f2 one the home screen uses. Both resolve and both are
          2160×3840, so asking for the wrong one loses the artwork silently —
          same slip as JejuHanbokSelect had. `bg` stays as the fallback. */}
      {pageBg && <img className={styles.bg} src={pageBg} alt="" draggable={false} />}

      <Header title={photoTitle} onHome={onHome} onBack={onHome} navDisabled={navLocked} />

      {/* ── ③ 잠시만 기다려주세요! ── */}
      <div className={styles.step}>
        <span className={styles.stepBadge}>{STEP_NUMBER}</span>
        <p className={styles.stepTitle}>{pick(STEP_TITLE, lang)}</p>
      </div>

      <p className={styles.prompt}>{pick(PROMPT, lang)}</p>

      {/* ── Progress: lives · n/5 · clock ── */}
      <div className={styles.status}>
        <div className={styles.statusSide} aria-label={`lives ${livesLeft}`}>
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <Heart
              key={i}
              className={i < livesLeft ? styles.heart : styles.heartSpent}
              strokeWidth={2.2}
            />
          ))}
        </div>

        <p className={styles.counter}>
          {found.size}/{target}
        </p>

        <div className={`${styles.statusSide} ${styles.statusRight}`}>
          <Timer className={styles.clockIcon} strokeWidth={2.2} />
          <span className={`${styles.clock} ${secondsLeft <= 10 ? styles.clockUrgent : ''}`}>
            {secondsLeft}
          </span>
        </div>
      </div>

      {renderSlot(0, styles.slotA, round?.originalUrl)}
      {renderSlot(1, styles.slotB, round?.modifiedUrl)}

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.hintBtn}`}
          onClick={takeHint}
          disabled={!playing || hintsUsed >= MAX_HINTS}
        >
          <Lightbulb className={styles.hintIcon} strokeWidth={2.2} />
          {pick(HINT, lang)}
          <span className={styles.hintCount}>{MAX_HINTS - hintsUsed}</span>
        </button>

        <button
          type="button"
          className={`${styles.actionBtn} ${styles.skipBtn}`}
          onClick={() => finish('skipped')}
        >
          {pick(SKIP, lang)}
        </button>
      </div>

      {banner && (
        <div className={styles.banner}>
          <img src={banner} alt="" draggable={false} />
        </div>
      )}

      {/* ── Round over ──
          Three shapes, decided by whether the photo has landed:
            round just ended, photo NOT ready → offer 한 판 더 / 그냥 기다릴게요
            player chose to wait             → spinner, no choice
            photo ready                      → the score, then the result takes over
          The choice is deliberately withheld once the photo is ready: at that
          point the photo is the thing they came for, and offering another round
          would only stall it. */}
      {outcome !== 'playing' && outcome !== 'skipped' && (
        <div className={styles.overlay}>
          <div className={styles.overlayCard}>
            {outcome !== 'waiting' && (
              <>
                <p className={styles.overlayTitle}>
                  {outcome === 'won' ? pick(WON, lang) : pick(LOST, lang)}
                </p>
                <p className={styles.overlayScore}>
                  <span className={styles.overlayScoreNum}>{found.size}</span>
                  {pick(SCORE, lang)}
                </p>
              </>
            )}

            <p className={styles.overlayNote}>
              {aiReady
                ? pick(READY, lang)
                : outcome === 'waiting'
                  ? pick(WRAPPING_UP, lang)
                  : pick(STILL_MAKING, lang)}
            </p>

            {!aiReady && <span className={styles.overlaySpinner} aria-hidden />}

            {!aiReady && outcome !== 'waiting' && (
              <div className={styles.overlayActions}>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.hintBtn}`}
                  onClick={playAgain}
                >
                  {pick(PLAY_AGAIN, lang)}
                </button>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.skipBtn}`}
                  onClick={() => {
                    lastTouchRef.current = Date.now();
                    setOutcome('waiting');
                  }}
                >
                  {pick(JUST_WAIT, lang)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
