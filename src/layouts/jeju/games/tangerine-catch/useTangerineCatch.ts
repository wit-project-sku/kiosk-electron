/**
 * 감귤 받기 — the engine.
 *
 * ── The split this file exists to enforce ─────────────────────────────
 * Everything that changes 60 times a second (items, particles, pops, the
 * basket's x) lives in REFS and is drawn straight to the canvas. Only what a
 * human reads — the score, the clock, the phase — is React state.
 *
 * That is not a micro-optimisation. Putting a dozen falling objects in state
 * means a dozen reconciliations per frame on a machine that is, at that exact
 * moment, also uploading a photo and running an AR request; the game visibly
 * stutters precisely when the visitor is judging whether this kiosk is any
 * good. Score changes a handful of times per run, so it costs nothing.
 *
 * ── Difficulty ────────────────────────────────────────────────────────
 * Three tiers over 30 seconds. The first ten seconds are deliberately, almost
 * insultingly easy: the audience is tourists with luggage, children and older
 * visitors, and the run has to be obviously winnable before it is interesting.
 * Rocks do not appear at all until the second tier, so nothing punishes a
 * visitor still working out what the basket does.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../gameSound';
import { useGameLoop } from '../useGameLoop';
import type { FallingItem, GamePhase, Particle, ScorePop } from '../gameTypes';
import {
  BASKET_W,
  BASKET_Y,
  FIELD_H,
  FIELD_W,
  RADIUS,
  drawBasket,
  drawItem,
  drawParticle,
  drawScorePop,
} from './catchRender';

/** Run length. Matches the brief and sits well inside the 60s AI floor. */
export const GAME_SECONDS = 30;

const POINTS = { normal: 10, golden: 50, rock: -5 } as const;

/**
 * Hard ceilings. The kiosk runs for days, and every one of these pools is fed
 * by a timer — an unbounded pool is a leak with extra steps. Reaching a cap
 * drops the OLDEST entry, so the newest feedback is always the visible one.
 */
const MAX_ITEMS = 14;
const MAX_PARTICLES = 90;
const MAX_POPS = 8;

/** Per-tier tuning, applied by elapsed seconds. */
interface Tier {
  /** Seconds between spawns. */
  interval: number;
  /** Fall speed range, px/s. */
  speed: [number, number];
  /** Chance a spawn is golden / a rock. */
  golden: number;
  rock: number;
  /** How many may fall at once. */
  concurrent: number;
}

const TIERS: { until: number; tier: Tier }[] = [
  // 0–10s — one object at a time, slow, no rocks. Everyone scores here.
  { until: 10, tier: { interval: 0.82, speed: [560, 700], golden: 0.07, rock: 0, concurrent: 4 } },
  // 10–20s — faster, denser, rocks appear.
  { until: 20, tier: { interval: 0.6, speed: [740, 950], golden: 0.1, rock: 0.14, concurrent: 7 } },
  // 20–30s — the sprint.
  {
    until: Infinity,
    tier: { interval: 0.42, speed: [920, 1220], golden: 0.13, rock: 0.2, concurrent: 10 },
  },
];

function tierAt(elapsed: number): Tier {
  // `?? last` rather than a non-null assertion: the table is data, and a future
  // edit that leaves a gap should degrade to the hardest tier, not crash.
  return (TIERS.find((t) => elapsed < t.until) ?? TIERS[TIERS.length - 1])?.tier ?? TIERS[0]!.tier;
}

export interface TangerineCatchApi {
  phase: GamePhase;
  score: number;
  secondsLeft: number;
  /** Objects caught, rocks excluded — the number the result card shows. */
  caught: number;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Attach to the field: pointer down/move steer the basket. */
  onPointer: (event: React.PointerEvent<HTMLDivElement>) => void;
  /** Countdown finished — start the clock. */
  begin: () => void;
  /** Back to the countdown with everything cleared. */
  restart: () => void;
}

export function useTangerineCatch(onDone: (score: number) => void): TangerineCatchApi {
  const [phase, setPhase] = useState<GamePhase>('countdown');
  const [score, setScore] = useState(0);
  const [caught, setCaught] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(GAME_SECONDS);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const itemsRef = useRef<FallingItem[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const popsRef = useRef<ScorePop[]>([]);
  /** Where the basket IS, and where the finger wants it. Eased between. */
  const basketRef = useRef(FIELD_W / 2);
  const basketTargetRef = useRef(FIELD_W / 2);
  /** 0…1 catch reaction, decayed every frame. */
  const liftRef = useRef(0);
  const elapsedRef = useRef(0);
  const spawnRef = useRef(0);
  const nextIdRef = useRef(1);
  /** Mirrors `score` for the end-of-run award, which must not read stale state. */
  const scoreRef = useRef(0);
  /** onDone must fire exactly once per run. */
  const doneRef = useRef(false);

  const reset = useCallback(() => {
    itemsRef.current = [];
    particlesRef.current = [];
    popsRef.current = [];
    basketRef.current = FIELD_W / 2;
    basketTargetRef.current = FIELD_W / 2;
    liftRef.current = 0;
    elapsedRef.current = 0;
    spawnRef.current = 0;
    scoreRef.current = 0;
    doneRef.current = false;
    setScore(0);
    setCaught(0);
    setSecondsLeft(GAME_SECONDS);
  }, []);

  const begin = useCallback(() => {
    reset();
    setPhase('playing');
  }, [reset]);

  const restart = useCallback(() => {
    reset();
    setPhase('countdown');
  }, [reset]);

  /** Steer the basket. Pointer events cover touch, stylus and mouse in one path. */
  const onPointer = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    // buttons === 0 on a move means nothing is held down; a mouse drifting over
    // the field must not drag the basket around after the visitor let go.
    if (event.type === 'pointermove' && event.buttons === 0 && event.pointerType === 'mouse')
      return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    // Normalise against the RENDERED rect so the artboard's CSS scale cancels
    // out — the same arithmetic the 틀린그림찾기 panels use.
    const x = ((event.clientX - rect.left) / rect.width) * FIELD_W;
    basketTargetRef.current = Math.max(BASKET_W / 2, Math.min(FIELD_W - BASKET_W / 2, x));
  }, []);

  const spawn = useCallback((tier: Tier): void => {
    const roll = Math.random();
    const kind: FallingItem['kind'] =
      roll < tier.golden ? 'golden' : roll < tier.golden + tier.rock ? 'rock' : 'normal';
    const r = RADIUS[kind];
    const [lo, hi] = tier.speed;
    const items = itemsRef.current;
    if (items.length >= MAX_ITEMS) items.shift();
    items.push({
      id: nextIdRef.current++,
      kind,
      // Inset by the radius so nothing is ever half off-screen, which on a
      // touch game reads as unfair rather than as decoration.
      x: r + Math.random() * (FIELD_W - r * 2),
      y: -r,
      vy: lo + Math.random() * (hi - lo),
      r,
      spin: Math.random() * Math.PI * 2,
      spinRate: (Math.random() - 0.5) * 2.4,
    });
  }, []);

  const burst = useCallback((x: number, y: number, hue: Particle['hue'], count: number): void => {
    const pool = particlesRef.current;
    for (let i = 0; i < count; i += 1) {
      if (pool.length >= MAX_PARTICLES) pool.shift();
      const angle = Math.random() * Math.PI * 2;
      const speed = 260 + Math.random() * 520;
      const life = 0.4 + Math.random() * 0.4;
      pool.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        // Biased upward: sparks that only fall read as debris, not celebration.
        vy: Math.sin(angle) * speed - 220,
        life,
        maxLife: life,
        hue,
        size: 8 + Math.random() * 14,
      });
    }
  }, []);

  // ── The run clock ─────────────────────────────────────────────────────
  // A plain 1s interval rather than deriving from the frame loop, so the number
  // the visitor reads ticks evenly even if a frame is dropped.
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setPhase('result');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Award once, on the way to the result card.
  useEffect(() => {
    if (phase !== 'result' || doneRef.current) return;
    doneRef.current = true;
    sfx.finish();
    onDone(scoreRef.current);
  }, [phase, onDone]);

  // ── Frame ─────────────────────────────────────────────────────────────
  useGameLoop(
    useCallback(
      (dt: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        elapsedRef.current += dt;
        const tier = tierAt(elapsedRef.current);

        // Spawn.
        spawnRef.current += dt;
        if (spawnRef.current >= tier.interval && itemsRef.current.length < tier.concurrent) {
          spawnRef.current = 0;
          spawn(tier);
        }

        // Basket: ease toward the finger rather than snapping to it. The lag is
        // what gives the basket weight; without it a fast drag looks like the
        // basket teleporting and catches stop feeling earned.
        const bx = basketRef.current;
        basketRef.current = bx + (basketTargetRef.current - bx) * Math.min(1, dt * 18);
        liftRef.current = Math.max(0, liftRef.current - dt * 3.4);

        // Items: integrate, then test the basket mouth.
        const mouthHalf = BASKET_W / 2;
        const items = itemsRef.current;
        let gained = 0;
        let caughtNow = 0;

        for (let i = items.length - 1; i >= 0; i -= 1) {
          const item = items[i] as FallingItem;
          item.y += item.vy * dt;
          item.spin += item.spinRate * dt;

          // The catch test is a BAND, not a line: at 1200px/s an object moves
          // ~20px per frame, and a zero-height line would be stepped over on a
          // dropped frame — the visitor sees a catch that did not count.
          const inBand = item.y + item.r >= BASKET_Y && item.y - item.r <= BASKET_Y + 90;
          const inMouth = Math.abs(item.x - basketRef.current) <= mouthHalf;

          if (inBand && inMouth) {
            items.splice(i, 1);
            gained += POINTS[item.kind];
            liftRef.current = 1;

            if (item.kind === 'rock') {
              sfx.miss();
              burst(item.x, BASKET_Y, 'grey', 8);
              pushPop(popsRef, item.x, BASKET_Y, `${POINTS.rock}`, false);
            } else {
              caughtNow += 1;
              const golden = item.kind === 'golden';
              if (golden) sfx.golden();
              else sfx.catch();
              burst(item.x, BASKET_Y, golden ? 'gold' : 'orange', golden ? 26 : 12);
              pushPop(popsRef, item.x, BASKET_Y, `+${POINTS[item.kind]}`, golden);
            }
            continue;
          }

          // Off the bottom. A missed tangerine costs nothing — see the brief:
          // the game must not become frustrating, and a visitor whose photo is
          // generating is not here to be punished.
          if (item.y - item.r > FIELD_H) items.splice(i, 1);
        }

        if (gained !== 0 || caughtNow !== 0) {
          // Floor at zero: a negative JEJU POINTS total is a bad souvenir.
          scoreRef.current = Math.max(0, scoreRef.current + gained);
          setScore(scoreRef.current);
          if (caughtNow) setCaught((n) => n + caughtNow);
        }

        // Particles.
        const parts = particlesRef.current;
        for (let i = parts.length - 1; i >= 0; i -= 1) {
          const p = parts[i] as Particle;
          p.life -= dt;
          if (p.life <= 0) {
            parts.splice(i, 1);
            continue;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 1500 * dt;
        }

        // Score pops.
        const pops = popsRef.current;
        for (let i = pops.length - 1; i >= 0; i -= 1) {
          const pop = pops[i] as ScorePop;
          pop.life -= dt;
          if (pop.life <= 0) {
            pops.splice(i, 1);
            continue;
          }
          pop.y -= 170 * dt;
        }

        // ── Draw ──
        ctx.clearRect(0, 0, FIELD_W, FIELD_H);
        for (const item of items) drawItem(ctx, item);
        drawBasket(ctx, basketRef.current, liftRef.current);
        for (const p of parts) drawParticle(ctx, p);
        for (const pop of pops) drawScorePop(ctx, pop);
      },
      [burst, spawn],
    ),
    phase === 'playing',
  );

  // Note there is deliberately NO sfx cleanup here. Silencing on this
  // component's unmount would kill audio for the rest of the session — a return
  // to the card menu is an unmount too. The host owns that: it silences when the
  // whole game screen goes away, which is the only moment a scheduled cue could
  // land over the photo result. See JejuWaitingGames.

  return { phase, score, secondsLeft, caught, canvasRef, onPointer, begin, restart };
}

/** Push a floating "+10", dropping the oldest if the pool is full. */
function pushPop(
  ref: React.MutableRefObject<ScorePop[]>,
  x: number,
  y: number,
  text: string,
  golden: boolean,
): void {
  const pops = ref.current;
  if (pops.length >= MAX_POPS) pops.shift();
  pops.push({ x, y: y - 40, life: 0.9, maxLife: 0.9, text, golden });
}
