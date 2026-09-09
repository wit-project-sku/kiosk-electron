/**
 * 감귤은 어디에? — the engine.
 *
 * ══ THE RULE THIS FILE EXISTS TO ENFORCE ══════════════════════════════
 * The tangerine is under a REAL cup, tracked through every swap, and the
 * reveal reads that state. It is never "animate three cups randomly, then pick
 * a winner" — that version is trivially easier to write and it is a lie: a
 * visitor who followed the right cup correctly can be told they were wrong,
 * and on a public kiosk that is the one bug nobody forgives.
 *
 * The model that makes it honest is two pieces of state and nothing else:
 *
 *   orderRef.current  — slot index → cup id.  ['b','a','c'] means cup 'b' is
 *                       standing in the left slot.
 *   tangerineRef      — the cup ID holding the fruit. Set once per round and
 *                       NEVER touched again until the next round.
 *
 * A swap is a swap of two entries in `orderRef`. The animation is a consequence
 * of that swap, not the other way round, and the answer is
 * `orderRef.current[tappedSlot] === tangerineRef.current`. The cup carries the
 * fruit because the cup IS the identity; positions are just where identities
 * are standing right now.
 *
 * ── Why the positions live in refs and the DOM, not in state ──────────
 * Rendering the swap through React would mean the cups' `transform` is whatever
 * the last render said, and a WAAPI animation running against it fights the
 * next re-render. Instead each cup's inline transform is set to its FINAL
 * position immediately, and the animation plays from the old one to it (the
 * FLIP technique) — so the resting state is always correct even if an animation
 * is cancelled, dropped, or never runs at all because the tab was hidden.
 *
 * ── Input is closed except in 'choose' ────────────────────────────────
 * Every other phase ignores taps. Not by hiding the cups — by `phase !==
 * 'choose'` in the handler — because a kiosk visitor WILL jab at a shuffling
 * cup, and the round must not resolve from a tap made before the shuffle ended.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../gameSound';

/**
 * The four rounds, easy to hard.
 *
 * `duration` is one swap's travel; `gap` is the beat between swaps. The pair
 * matters more than the swap count — 10 swaps at a readable speed is a fair
 * challenge, 10 swaps too fast to track is a coin flip with extra steps, and a
 * coin flip is not a game.
 */
export interface CupRound {
  swaps: number;
  /** ms per swap. */
  duration: number;
  /** ms of stillness between swaps. */
  gap: number;
  /** Round 4 only: a beat of hesitation now and then, which is what makes a
   *  real shuffle hard to follow — the eye locks onto a rhythm and loses the
   *  cup when the rhythm breaks. */
  pauses: boolean;
}

export const ROUNDS: CupRound[] = [
  { swaps: 4, duration: 620, gap: 140, pauses: false },
  { swaps: 6, duration: 460, gap: 100, pauses: false },
  { swaps: 9, duration: 340, gap: 70, pauses: false },
  { swaps: 11, duration: 260, gap: 50, pauses: true },
];

export const TOTAL_ROUNDS = ROUNDS.length;
export const POINTS_PER_ROUND = 100;

/** The three cups, by identity. Order in this array is meaningless. */
export const CUP_IDS = ['a', 'b', 'c'] as const;
export type CupId = (typeof CUP_IDS)[number];

/** Slot centres in field px — GameShell's field is 1900 wide. */
export const SLOT_X = [480, 950, 1420];

/**
 * The inner state machine, on top of the shared GamePhase:
 *
 *   intro → show → settle → shuffle → choose → reveal → (next round | result)
 */
export type CupPhase = 'intro' | 'show' | 'settle' | 'shuffle' | 'choose' | 'reveal' | 'result';

/** How long the fruit is on display before the cup comes down. */
const SHOW_MS = 2000;
/** The cup lowering over it. */
const SETTLE_MS = 620;
/** Beat between the cups landing and the first swap. */
const PRE_SHUFFLE_MS = 320;
/** How long the reveal is held before the next round. */
const REVEAL_MS = 2600;

export interface TangerineCupApi {
  phase: CupPhase;
  /** 0-based. */
  round: number;
  score: number;
  correctCount: number;
  /** Per-round outcome so far — drives the round dots. */
  history: boolean[];
  /** The slot the visitor tapped, or null. */
  pickedSlot: number | null;
  /** Slot the fruit is actually in. Only meaningful from 'reveal' onward. */
  revealSlot: number | null;
  /** Set during 'show' and 'reveal' so the fruit can be drawn in the right slot. */
  fruitSlot: number | null;
  /** Register a cup's outer (translateX) element. */
  registerCup: (id: CupId, el: HTMLDivElement | null) => void;
  /** Slot index of a cup right now — for the lift/reveal classes. */
  slotOfCup: (id: CupId) => number;
  choose: (slot: number) => void;
  restart: () => void;
}

export function useTangerineCup(onDone: (score: number) => void): TangerineCupApi {
  const [phase, setPhase] = useState<CupPhase>('intro');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<boolean[]>([]);
  const [pickedSlot, setPickedSlot] = useState<number | null>(null);
  const [revealSlot, setRevealSlot] = useState<number | null>(null);
  /** Bumped whenever the cups move, purely to re-render the slot-derived UI. */
  const [, setOrderTick] = useState(0);

  /** slot index → cup id. THE authority on where every cup is. */
  const orderRef = useRef<CupId[]>([...CUP_IDS]);
  /** The cup holding the fruit this round. */
  const tangerineRef = useRef<CupId>('b');
  const cupElsRef = useRef<Partial<Record<CupId, HTMLDivElement | null>>>({});
  /** Live WAAPI animations, so a teardown can stop them mid-flight. */
  const animsRef = useRef<Animation[]>([]);
  const scoreRef = useRef(0);
  const doneRef = useRef(false);
  /** One choice per round, enforced synchronously — see {@link choose}. */
  const pickedRef = useRef(false);

  const registerCup = useCallback((id: CupId, el: HTMLDivElement | null): void => {
    cupElsRef.current[id] = el;
    if (el) {
      // Park it at its current slot the moment it exists, so the very first
      // frame is already correct and nothing slides in from x=0.
      const slot = orderRef.current.indexOf(id);
      el.style.transform = `translateX(${SLOT_X[slot < 0 ? 0 : slot]}px)`;
    }
  }, []);

  const slotOfCup = useCallback((id: CupId): number => orderRef.current.indexOf(id), []);

  /** Stop and forget every running animation. Safe to call at any time. */
  const killAnims = useCallback((): void => {
    for (const a of animsRef.current) {
      try {
        a.cancel();
      } catch {
        /* Already finished or detached — nothing to cancel. */
      }
    }
    animsRef.current = [];
  }, []);

  /**
   * Swap the cups in two slots — state first, then the animation that shows it.
   *
   * The two cups take DIFFERENT arcs: one passes in front and above, the other
   * behind and below. That is what makes it read as two physical objects moving
   * around each other instead of two sprites crossfading through the same line,
   * and it is also the honest picture of what just happened to the state.
   */
  const swap = useCallback((slotA: number, slotB: number, duration: number): void => {
    const order = orderRef.current;
    const idA = order[slotA] as CupId;
    const idB = order[slotB] as CupId;

    // ── State. Everything below is presentation. ──
    order[slotA] = idB;
    order[slotB] = idA;

    const fromA = SLOT_X[slotA] as number;
    const fromB = SLOT_X[slotB] as number;
    const dir = fromB > fromA ? 1 : -1;

    const move = (id: CupId, from: number, to: number, front: boolean): void => {
      const el = cupElsRef.current[id];
      if (!el) return;

      // Land the element on its final transform NOW. If the animation is
      // cancelled — unmount, a restart, a dropped frame — the cup is still
      // exactly where the state says it is. (FLIP: set final, animate from.)
      el.style.transform = `translateX(${to}px)`;
      el.style.zIndex = front ? '3' : '1';

      const mid = (from + to) / 2;
      // The front cup swings up and out; the back cup dips and tucks in.
      const lift = front ? -150 : 60;
      const bow = front ? dir * 46 : -dir * 26;
      const scale = front ? 1.07 : 0.93;

      try {
        const anim = el.animate(
          [
            { transform: `translateX(${from}px) translateY(0) rotate(0deg) scale(1)` },
            {
              transform: `translateX(${mid + bow}px) translateY(${lift}px) rotate(${
                dir * (front ? 9 : -5)
              }deg) scale(${scale})`,
              offset: 0.5,
            },
            { transform: `translateX(${to}px) translateY(0) rotate(0deg) scale(1)` },
          ],
          {
            duration,
            // A gentle overshoot at each end — the ease-in-out default reads
            // as a slide, and a real cup shuffle has weight in it.
            easing: 'cubic-bezier(0.34, 0.9, 0.28, 1)',
          },
        );
        animsRef.current.push(anim);
        // Drop it from the list once it is over, so the array cannot grow
        // across a long round (11 swaps × 4 rounds × every replay).
        anim.finished
          .then(() => {
            animsRef.current = animsRef.current.filter((x) => x !== anim);
          })
          .catch(() => {
            // A cancelled animation rejects. That is the teardown path and is
            // expected; killAnims has already emptied the list.
          });
      } catch {
        // No WAAPI (or the element was detached between the ref read and
        // here). The transform above already placed the cup, so the game
        // continues correctly — it just jumps instead of sliding.
      }
    };

    move(idA, fromA, fromB, dir > 0);
    move(idB, fromB, fromA, dir <= 0);

    setOrderTick((n) => n + 1);
  }, []);

  /** Start a round: new hiding place, cups back to their home slots. */
  const startRound = useCallback((): void => {
    killAnims();
    orderRef.current = [...CUP_IDS];
    for (const id of CUP_IDS) {
      const el = cupElsRef.current[id];
      if (!el) continue;
      el.style.transform = `translateX(${SLOT_X[orderRef.current.indexOf(id)]}px)`;
      el.style.zIndex = '2';
    }
    tangerineRef.current = CUP_IDS[Math.floor(Math.random() * CUP_IDS.length)] as CupId;
    pickedRef.current = false;
    setPickedSlot(null);
    setRevealSlot(null);
    setOrderTick((n) => n + 1);
    setPhase('show');
  }, [killAnims]);

  // ── show → settle → shuffle ───────────────────────────────────────────
  useEffect(() => {
    if (phase === 'show') {
      const id = setTimeout(() => setPhase('settle'), SHOW_MS);
      return () => clearTimeout(id);
    }
    if (phase === 'settle') {
      const id = setTimeout(() => setPhase('shuffle'), SETTLE_MS);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [phase]);

  // ── The shuffle ───────────────────────────────────────────────────────
  // A self-rescheduling timeout rather than an async loop: one timer handle to
  // clear, and cancelling it is the whole teardown. An `await` chain would keep
  // running after unmount and would need a token check at every step.
  useEffect(() => {
    if (phase !== 'shuffle') return;
    const cfg = ROUNDS[round] ?? (ROUNDS[ROUNDS.length - 1] as CupRound);
    let remaining = cfg.swaps;
    let timer = 0;
    /** Which pair moved last — never the same pair twice running. */
    let lastPair = -1;

    const step = (): void => {
      if (remaining <= 0) {
        setPhase('choose');
        return;
      }
      remaining -= 1;

      // Three possible pairs: 0-1, 1-2, 0-2. Re-picking the same pair
      // immediately just undoes the previous swap, which looks like a stutter
      // AND gives the fruit back its old position for free.
      let pair = Math.floor(Math.random() * 3);
      if (pair === lastPair) pair = (pair + 1 + Math.floor(Math.random() * 2)) % 3;
      lastPair = pair;
      const [a, b] = pair === 0 ? [0, 1] : pair === 1 ? [1, 2] : [0, 2];

      swap(a, b, cfg.duration);
      sfx.shuffle();

      const hesitate = cfg.pauses && remaining > 0 && remaining % 3 === 0 ? 380 : 0;
      timer = window.setTimeout(step, cfg.duration + cfg.gap + hesitate);
    };

    timer = window.setTimeout(step, PRE_SHUFFLE_MS);
    return () => clearTimeout(timer);
  }, [phase, round, swap]);

  // ── The choice ────────────────────────────────────────────────────────
  const choose = useCallback(
    (slot: number): void => {
      // The gate. Taps in any other phase are dropped on the floor — see the
      // header on why that is checked here rather than by hiding the cups.
      if (phase !== 'choose') return;
      // Second gate, and it is not redundant: `phase` is a render-time value,
      // so two pointerdowns in one batch — a double-tap, or two fingers on two
      // cups at once, which visitors absolutely do — would both read 'choose'
      // and resolve the round twice. The ref flips synchronously.
      if (pickedRef.current) return;
      pickedRef.current = true;

      const truthSlot = orderRef.current.indexOf(tangerineRef.current);
      const correct = orderRef.current[slot] === tangerineRef.current;

      setPickedSlot(slot);
      setRevealSlot(truthSlot);
      setPhase('reveal');
      setHistory((h) => [...h, correct]);

      if (correct) {
        scoreRef.current += POINTS_PER_ROUND;
        setScore(scoreRef.current);
        sfx.win();
      } else {
        sfx.lose();
      }
    },
    [phase],
  );

  // ── reveal → next round, or the result card ───────────────────────────
  useEffect(() => {
    if (phase !== 'reveal') return;
    const id = setTimeout(() => {
      if (round + 1 >= TOTAL_ROUNDS) {
        setPhase('result');
        return;
      }
      setRound((r) => r + 1);
      startRound();
    }, REVEAL_MS);
    return () => clearTimeout(id);
  }, [phase, round, startRound]);

  // First round, once the cups have mounted and registered.
  useEffect(() => {
    if (phase !== 'intro') return;
    const id = setTimeout(startRound, 400);
    return () => clearTimeout(id);
  }, [phase, startRound]);

  // Award once.
  useEffect(() => {
    if (phase !== 'result' || doneRef.current) return;
    doneRef.current = true;
    sfx.finish();
    onDone(scoreRef.current);
  }, [phase, onDone]);

  // Nothing may outlive the screen. The timers are cleared by their own
  // effects; the animations are not attached to one, so they are cleared here.
  useEffect(() => () => killAnims(), [killAnims]);

  const restart = useCallback((): void => {
    killAnims();
    doneRef.current = false;
    pickedRef.current = false;
    scoreRef.current = 0;
    setScore(0);
    setHistory([]);
    setRound(0);
    setPickedSlot(null);
    setRevealSlot(null);
    setPhase('intro');
  }, [killAnims]);

  /**
   * Where to draw the fruit. `null` while it is hidden — during the shuffle it
   * is not merely invisible, it is not rendered at all, so no stray paint or
   * z-index accident can ever leak the answer.
   */
  const fruitSlot =
    phase === 'show' || phase === 'settle'
      ? orderRef.current.indexOf(tangerineRef.current)
      : phase === 'reveal' || phase === 'result'
        ? revealSlot
        : null;

  return {
    phase,
    round,
    score,
    correctCount: history.filter(Boolean).length,
    history,
    pickedSlot,
    revealSlot,
    fruitSlot,
    registerCup,
    slotOfCup,
    choose,
    restart,
  };
}
