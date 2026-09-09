/**
 * 제주 게임존 — the host for everything the visitor can do while the AR 한복
 * photo generates. Drop-in replacement for the old direct render of
 * JejuSpotDiffGame in PhotoWorkflow: same four props, same contract.
 *
 * ══ WHAT THIS FILE IS FOR ═════════════════════════════════════════════
 * The games are leaves. This is the only place that knows a photo exists, and
 * it carries the four rules that used to live inside 틀린그림찾기 — moved here
 * rather than copied into each game, because a copy of a rule per game is a
 * chance per game for one of them to be wrong.
 *
 *  1. THE GAMES OUTLIVE THE WAIT. `GENERATING_MIN_MS` in photo.handlers is a
 *     60s FLOOR, not a deadline. Nothing here ever cuts a game short because
 *     the photo arrived — `aiReady` changes what is OFFERED (a 사진 보기 button
 *     appears), never what is running. Handing the screen over is always the
 *     visitor's tap, or the idle rescue below.
 *
 *  2. onFinish FIRES EXACTLY ONCE. {@link handOver} is idempotent. Note it
 *     guards the hand-over, not the end of a game — games start and end as
 *     often as the visitor likes before the screen is finally given up.
 *
 *  3. NOTHING HERE MAY THROW THE PHOTO AWAY. 홈/뒤로 run the photo reset, and
 *     the photo they discard is one the visitor has already posed for and the
 *     AI is already generating. Everywhere else in the kiosk backing out costs
 *     nothing; here it costs the thing they came for. So the kiosk's real home
 *     is dead until the photo lands — see `navLocked` — and inside a game the
 *     header instead returns to the card menu, which is free.
 *
 *  4. THE LOCK CANNOT OUTLIVE ITS REASON. A generation that neither finishes
 *     nor errors would otherwise seal the visitor on this screen forever; the
 *     global 3-minute inactivity reset is not an escape, because it re-arms on
 *     every touch and someone jabbing the dead 홈 button keeps it from firing.
 *     {@link NAV_LOCK_MAX_MS} is the ceiling.
 *
 * Monitor 2 is held on its waiting screen for the same reason, by PhotoWorkflow
 * via `photo.setDeferResultDisplay` — the big screen must not show the finished
 * photo while the visitor is still playing for it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpotDiffRound } from '@shared/types/spotDiff';
import { trackEvent } from '@renderer/lib/analytics';
import { useKioskStore } from '@renderer/store/kioskStore';
import { JejuSpotDiffGame } from '../JejuSpotDiffGame';
import type { JejuGameId, JejuGameView } from './gameTypes';
import { sfx } from './gameSound';
import { useJejuPointsStore } from './jejuPointsStore';
import { JejuGameHub } from './JejuGameHub';
import { TangerineCatch } from './tangerine-catch/TangerineCatch';
import { TangerineCup } from './tangerine-cup/TangerineCup';
import { isMotionGame } from './gameTypes';
import { useMotionGameState } from './motion/useMotionGameState';
import { MotionRemote } from './motion/components/MotionRemote';

/**
 * Hard ceiling on the 홈/뒤로 lock — rule 4 above.
 *
 * Comfortably past the 60s `GENERATING_MIN_MS` hold in photo.handlers.ts, so it
 * never cuts the intended lock short; it only ends a lock that has stopped
 * making sense.
 */
const NAV_LOCK_MAX_MS = 90_000;

/**
 * Nobody has touched the screen for this long AND the photo is ready → the
 * visitor has walked off, so let the result through rather than parking the
 * kiosk on a games menu.
 *
 * Deliberately long. A visitor watching a cup shuffle or reading the cards
 * touches nothing for fifteen or twenty seconds at a time, and ending their
 * session for them would be the exact opposite of the point. Armed only once
 * the photo is ready, because before that there is nothing to release to.
 */
const IDLE_RELEASE_MS = 45_000;

interface Props {
  /**
   * 틀린그림찾기 boards for this session, prefetched by PhotoWorkflow. Passed
   * straight through — the other three games need no assets at all, which is
   * why they still work when this is empty.
   */
  rounds: SpotDiffRound[];
  /** True once the AI result has landed (workflow phase === 'result'). */
  aiReady: boolean;
  /** The visitor is done here — the workflow may show the result. */
  onFinish: () => void;
  /** The kiosk's real home. Abandons the photo session. */
  onHome: () => void;
}

export function JejuWaitingGames({ rounds, aiReady, onFinish, onHome }: Props): JSX.Element {
  const [view, setView] = useState<JejuGameView>('hub');
  const kioskId = useKioskStore((s) => s.config.kioskId);
  const award = useJejuPointsStore((s) => s.award);
  const resetPoints = useJejuPointsStore((s) => s.reset);

  const handedOverRef = useRef(false);
  const lastTouchRef = useRef(Date.now());

  // ── Rule 4: the lock's escape hatch ───────────────────────────────────
  const [navLockExpired, setNavLockExpired] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setNavLockExpired(true), NAV_LOCK_MAX_MS);
    return () => clearTimeout(id);
  }, []);

  /** Rule 3. Released by `aiReady`, not by a clock — see the header. */
  const navLocked = !aiReady && !navLockExpired;

  /** Rule 2. */
  const handOver = useCallback(() => {
    if (handedOverRef.current) return;
    handedOverRef.current = true;
    // Whatever is on the big screen goes with us. The photo result is about to
    // take that monitor, and a motion game left running would keep the camera
    // open and draw over it.
    void window.api.motion.stop();
    onFinish();
  }, [onFinish]);

  // ── Session hygiene ───────────────────────────────────────────────────
  // A new visitor starts on zero, and the total does not survive them: this is
  // a public kiosk with no login, and a score left standing belongs to whoever
  // walks up next. Cleared on the way in AND on the way out.
  useEffect(() => {
    resetPoints();
    sfx.unsilence();
    return () => {
      resetPoints();
      // The games screen is going away — so is anything it started on the
      // customer display. This is the only teardown a motion game gets: the
      // display unmounts it on the broadcast, which releases the camera, the
      // inference loop and every timer with it.
      void window.api.motion.stop();
      // The one moment a scheduled cue could land over the photo result. Games
      // do NOT do this on their own unmount — returning to the menu is an
      // unmount too, and that must not kill sound for the rest of the session.
      sfx.silence();
    };
  }, [resetPoints]);

  // ── The idle rescue ───────────────────────────────────────────────────
  useEffect(() => {
    if (!aiReady) return;
    const id = setInterval(() => {
      if (Date.now() - lastTouchRef.current >= IDLE_RELEASE_MS) handOver();
    }, 2000);
    return () => clearInterval(id);
  }, [aiReady, handOver]);

  const handleAward = useCallback(
    (game: JejuGameId, points: number) => {
      award(game, points);
      void trackEvent({
        name: 'button_clicked',
        payload: { screen: 'photo_jeju_games', game, points, aiReady, kioskId },
      });
    },
    [award, aiReady, kioskId],
  );

  // ── The motion games, which live on the OTHER screen ──────────────────
  const motion = useMotionGameState();

  const backToHub = useCallback(() => setView('hub'), []);

  /** Stop whatever is on the big screen and come back to the menu. */
  const stopMotion = useCallback(() => {
    void window.api.motion.stop();
    setView('hub');
  }, []);

  /** Same game, new run. `runId` is what makes Monitor 2 remount it. */
  const replayMotion = useCallback(() => {
    if (motion.game) void window.api.motion.start(motion.game);
  }, [motion.game]);

  const pickGame = useCallback(
    (game: JejuGameId) => {
      // A motion game is not opened here — it is REQUESTED. Main broadcasts it,
      // the customer display mounts it, and this window becomes its remote.
      if (isMotionGame(game)) {
        void window.api.motion.start(game);
        setView('motion');
      } else {
        setView(game);
      }
      void trackEvent({
        name: 'button_clicked',
        payload: { screen: 'photo_jeju_games', action: 'open', game, aiReady, kioskId },
      });
    },
    [aiReady, kioskId],
  );

  /**
   * 틀린그림찾기 finishing inside the hub.
   *
   * Its 결과 보기 button hands over unconditionally, which is right when the
   * photo is there and wrong when it is not — handing over early would set the
   * workflow's gate while the phase is still 'generating', and this screen
   * would simply be re-rendered over a game that has already ended. So before
   * the photo lands, "finished" means "back to the menu", where there are three
   * other games and an honest status line.
   */
  const finishFromSpotDiff = useCallback(() => {
    if (aiReady) handOver();
    else backToHub();
  }, [aiReady, handOver, backToHub]);

  // Memoised per game. An inline `onAward={(p) => ...}` would be a new function
  // on every render, and each game holds its award callback in an effect's dep
  // list — the effect would re-run on every render of this host. The `doneRef`
  // guards inside the games make that harmless, not free.
  const awardCatch = useCallback((p: number) => handleAward('catch', p), [handleAward]);
  const awardCup = useCallback((p: number) => handleAward('cup', p), [handleAward]);
  const awardSpotDiff = useCallback((p: number) => handleAward('spotdiff', p), [handleAward]);

  const hosted = {
    onExit: backToHub,
    aiReady,
    onSeePhoto: handOver,
  };

  return (
    // One capture-phase listener for the whole screen rather than a
    // `lastTouchRef.current = Date.now()` in every handler in every game. It
    // cannot be swallowed by stopPropagation and it cannot be forgotten by the
    // next game somebody adds.
    <div
      style={{ position: 'absolute', inset: 0 }}
      onPointerDownCapture={() => {
        lastTouchRef.current = Date.now();
      }}
    >
      {view === 'hub' && (
        <JejuGameHub
          onPick={pickGame}
          onHome={onHome}
          navLocked={navLocked}
          aiReady={aiReady}
          onSeePhoto={handOver}
        />
      )}

      {view === 'catch' && <TangerineCatch {...hosted} onAward={awardCatch} />}

      {view === 'cup' && <TangerineCup {...hosted} onAward={awardCup} />}

      {/* ── Motion games ────────────────────────────────────────────────
          These do NOT render here. The game itself is full-screen on the
          customer display — see JejuMotionDisplay — because the camera is aimed
          at someone standing back from the kiosk, and a body-controlled game is
          useless on a touchscreen the player has just walked away from. This
          window shows the remote instead. */}
      {view === 'motion' && (
        <MotionRemote
          state={motion}
          onStop={stopMotion}
          onPlayAgain={replayMotion}
          onSeePhoto={handOver}
          aiReady={aiReady}
          onAward={handleAward}
        />
      )}

      {view === 'spotdiff' && (
        <JejuSpotDiffGame
          rounds={rounds}
          aiReady={aiReady}
          onFinish={finishFromSpotDiff}
          onHome={onHome}
          // Presence of this prop is what tells 틀린그림찾기 it is hosted: its
          // header stops being the destructive kiosk home and becomes "back to
          // the menu", so its own nav lock no longer applies.
          onExit={backToHub}
          onAward={awardSpotDiff}
        />
      )}
    </div>
  );
}
