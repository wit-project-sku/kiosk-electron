/**
 * 몸으로 감귤 받기 — the engine.
 *
 * The camera-controlled sibling of `tangerine-catch/useTangerineCatch`. It
 * REUSES that game's renderer wholesale (`catchRender`) — same basket, same
 * fruit, same particles — so the two catch games are visibly the same game with
 * two different controllers, which is exactly what they are.
 *
 * What it does NOT reuse is the tuning, and that is deliberate. A finger and a
 * torso are not the same input device:
 *
 *   · A finger crosses the field in a fifth of a second. A body takes a stride,
 *     and the player has to decide, shift their weight and arrive. Everything
 *     here falls more slowly and spawns further apart.
 *   · A finger lands exactly where it is pointed. A torso centre wobbles by a
 *     few percent even when its owner is standing still, so the catch band is
 *     wider — see CATCH_PAD.
 *   · A finger never disappears. A body does, constantly — see the stall.
 *
 * Copying the touch tuning across would produce a game that looks identical and
 * is unplayable.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../../gameSound';
import { useGameLoop } from '../../useGameLoop';
import type { FallingItem, Particle, ScorePop } from '../../gameTypes';
import {
  BASKET_W,
  RADIUS,
  drawBasket,
  drawItem,
  drawParticle,
  drawScorePop,
} from '../../tangerine-catch/catchRender';

/**
 * The play field, in artboard px.
 *
 * NOT the touch game's 1900×2060. This one renders on the customer display,
 * where MotionStage gives the game nearly the whole 2160×3840 board — there is
 * no header, banner or button row to share it with. The extra height is the
 * point: a body is a slower controller than a finger, and a longer drop is what
 * gives the player time to actually walk under a falling tangerine.
 */
export const FIELD_W = 1980;
export const FIELD_H = 3120;
/** Mouth line of the basket, well clear of the bottom edge. */
const BASKET_Y = FIELD_H - 420;
import type { MotionPhase, PlayerTrackingState } from '../poseTypes';

export const GAME_SECONDS = 30;

const POINTS = { normal: 10, golden: 50, rock: -10 } as const;

/** Pool ceilings — the kiosk runs for days. Same discipline as the touch game. */
const MAX_ITEMS = 12;
const MAX_PARTICLES = 90;
const MAX_POPS = 8;

/**
 * Extra half-width added to the basket's mouth for collision only.
 *
 * The brief asks for a forgiving zone and it is not a nicety: the tracked torso
 * centre drifts by a few percent of frame width from breathing and shoulder
 * roll alone, so a pixel-exact mouth would drop fruit the player was visibly
 * under. 70px on a 1900px field is roughly that drift, which makes the
 * difference invisible to a player and decisive for the ones they nearly miss.
 */
const CATCH_PAD = 70;

/** How much of normal speed things move while the player is out of view. */
const STALL_SPEED = 0.22;

interface Tier {
  interval: number;
  speed: [number, number];
  golden: number;
  rock: number;
  concurrent: number;
}

/**
 * Three tiers over 30s, as the brief specifies. Slower and sparser throughout
 * than the touch game's — see the header.
 */
const TIERS: { until: number; tier: Tier }[] = [
  // 0–10s. One thing at a time, drifting down. The visitor is still working out
  // that their body is the controller; nothing here should punish that.
  { until: 10, tier: { interval: 1.15, speed: [380, 470], golden: 0.08, rock: 0, concurrent: 3 } },
  // 10–20s. They have it now.
  {
    until: 20,
    tier: { interval: 0.85, speed: [500, 640], golden: 0.11, rock: 0.12, concurrent: 5 },
  },
  // 20–30s. The finish, with goldens worth chasing across the field.
  {
    until: Infinity,
    tier: { interval: 0.62, speed: [640, 820], golden: 0.16, rock: 0.16, concurrent: 7 },
  },
];

function tierAt(elapsed: number): Tier {
  return (TIERS.find((t) => elapsed < t.until) ?? TIERS[TIERS.length - 1])?.tier ?? TIERS[0]!.tier;
}

export interface BodyCatchApi {
  phase: MotionPhase;
  score: number;
  caught: number;
  secondsLeft: number;
  /** True while the player is out of view and the game is coasting. */
  stalled: boolean;
  /** The run's total, set once when it ends. Banked by Monitor 1. */
  finalScore: number | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** The calibration gate locked a player — run the 3·2·1. */
  ready: () => void;
  /** The countdown finished — the clock starts now. */
  begin: () => void;
  /** Back to the gate, everything cleared. */
  restart: () => void;
}

export function useBodyCatch(player: React.RefObject<PlayerTrackingState>): BodyCatchApi {
  const [phase, setPhase] = useState<MotionPhase>('calibrating');
  const [score, setScore] = useState(0);
  const [caught, setCaught] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(GAME_SECONDS);
  const [stalled, setStalled] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const itemsRef = useRef<FallingItem[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const popsRef = useRef<ScorePop[]>([]);
  const basketRef = useRef(FIELD_W / 2);
  const liftRef = useRef(0);
  const elapsedRef = useRef(0);
  const spawnRef = useRef(0);
  const nextIdRef = useRef(1);
  const scoreRef = useRef(0);
  const doneRef = useRef(false);
  /** Mirrors `stalled` for the clock, which must not read React state. */
  const stalledRef = useRef(false);

  const reset = useCallback(() => {
    itemsRef.current = [];
    particlesRef.current = [];
    popsRef.current = [];
    basketRef.current = FIELD_W / 2;
    liftRef.current = 0;
    elapsedRef.current = 0;
    spawnRef.current = 0;
    scoreRef.current = 0;
    doneRef.current = false;
    stalledRef.current = false;
    setScore(0);
    setCaught(0);
    setStalled(false);
    setSecondsLeft(GAME_SECONDS);
  }, []);

  /** Gate → countdown. Resets here so the 3·2·1 counts into a clean board. */
  const ready = useCallback(() => {
    reset();
    setPhase('countdown');
  }, [reset]);

  const begin = useCallback(() => setPhase('playing'), []);

  const restart = useCallback(() => {
    reset();
    setPhase('calibrating');
  }, [reset]);

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
        vy: Math.sin(angle) * speed - 220,
        life,
        maxLife: life,
        hue,
        size: 8 + Math.random() * 14,
      });
    }
  }, []);

  // ── The clock ─────────────────────────────────────────────────────────
  // Pauses while stalled. A visitor who stepped out of frame did not get to
  // play those seconds, and charging them for it would make a tracking dropout
  // — which is our problem, not theirs — cost them the game.
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => {
      if (stalledRef.current) return;
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

  // The run's final score, published once. Monitor 1 banks it into JEJU POINTS
  // off the broadcast — this screen has no store of its own.
  useEffect(() => {
    if (phase !== 'result' || doneRef.current) return;
    doneRef.current = true;
    sfx.finish();
    setFinalScore(scoreRef.current);
  }, [phase]);

  // ── Frame ─────────────────────────────────────────────────────────────
  useGameLoop(
    useCallback(
      (dt: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const tracked = player.current;
        // The tracker already holds the last known position through its own
        // grace window, so by the time `detected` is false the player really is
        // gone — no extra debounce needed here.
        const lost = !tracked.detected;
        if (lost !== stalledRef.current) {
          stalledRef.current = lost;
          setStalled(lost);
        }

        // The body IS the controller. `centerX` is already smoothed, mirrored
        // and range-expanded by the tracking layer, so this is a plain map onto
        // the field — any further filtering here would only add lag.
        if (!lost) {
          basketRef.current =
            Math.max(0, Math.min(1, tracked.centerX)) * (FIELD_W - BASKET_W) + BASKET_W / 2;
        }

        const speedScale = lost ? STALL_SPEED : 1;
        if (!lost) elapsedRef.current += dt;
        const tier = tierAt(elapsedRef.current);

        // Nothing new falls while the player cannot see themselves play.
        if (!lost) {
          spawnRef.current += dt;
          if (spawnRef.current >= tier.interval && itemsRef.current.length < tier.concurrent) {
            spawnRef.current = 0;
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
              x: r + Math.random() * (FIELD_W - r * 2),
              y: -r,
              vy: lo + Math.random() * (hi - lo),
              r,
              spin: Math.random() * Math.PI * 2,
              spinRate: (Math.random() - 0.5) * 2.4,
            });
          }
        }

        liftRef.current = Math.max(0, liftRef.current - dt * 3.4);

        const mouthHalf = BASKET_W / 2 + CATCH_PAD;
        const items = itemsRef.current;
        let gained = 0;
        let caughtNow = 0;

        for (let i = items.length - 1; i >= 0; i -= 1) {
          const item = items[i] as FallingItem;
          item.y += item.vy * dt * speedScale;
          item.spin += item.spinRate * dt * speedScale;

          // A band, not a line: at speed an object moves tens of px per frame,
          // and a zero-height test is stepped over on a dropped frame.
          const inBand = item.y + item.r >= BASKET_Y && item.y - item.r <= BASKET_Y + 110;
          const inMouth = Math.abs(item.x - basketRef.current) <= mouthHalf;

          // Nothing can be caught while the player is not there — otherwise a
          // stalled game would score for them in their absence.
          if (!lost && inBand && inMouth) {
            items.splice(i, 1);
            gained += POINTS[item.kind];
            liftRef.current = 1;
            if (item.kind === 'rock') {
              sfx.miss();
              burst(item.x, BASKET_Y, 'grey', 8);
              pushPop(popsRef, item.x, `${POINTS.rock}`, false);
            } else {
              caughtNow += 1;
              const golden = item.kind === 'golden';
              if (golden) sfx.golden();
              else sfx.catch();
              burst(item.x, BASKET_Y, golden ? 'gold' : 'orange', golden ? 26 : 12);
              pushPop(popsRef, item.x, `+${POINTS[item.kind]}`, golden);
            }
            continue;
          }

          if (item.y - item.r > FIELD_H) items.splice(i, 1);
        }

        if (gained !== 0 || caughtNow !== 0) {
          scoreRef.current = Math.max(0, scoreRef.current + gained);
          setScore(scoreRef.current);
          if (caughtNow) setCaught((n) => n + caughtNow);
        }

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

        ctx.clearRect(0, 0, FIELD_W, FIELD_H);
        // The FALLING objects dim while the player is out of view, so the reason
        // the game went quiet is visible at a glance. The BASKET never does: it
        // is the thing the visitor is looking for to understand what the game
        // wants from them, and a faded basket over a faded field is what
        // "nothing here catches the fruit" looks like from the floor.
        ctx.globalAlpha = lost ? 0.35 : 1;
        for (const item of items) drawItem(ctx, item);
        ctx.globalAlpha = 1;
        drawBasket(ctx, basketRef.current, liftRef.current, BASKET_Y);
        for (const p of parts) drawParticle(ctx, p);
        for (const pop of pops) drawScorePop(ctx, pop);
      },
      [burst, player],
    ),
    phase === 'playing',
  );

  return {
    phase,
    score,
    caught,
    secondsLeft,
    stalled,
    finalScore,
    canvasRef,
    ready,
    begin,
    restart,
  };
}

function pushPop(
  ref: React.MutableRefObject<ScorePop[]>,
  x: number,
  text: string,
  golden: boolean,
): void {
  const pops = ref.current;
  if (pops.length >= MAX_POPS) pops.shift();
  pops.push({ x, y: BASKET_Y - 40, life: 0.9, maxLife: 0.9, text, golden });
}
