/**
 * 화산석 피하기 — the engine.
 *
 * Same shape as the other two canvas games: entities in refs, drawn straight to
 * the canvas, and only the numbers a human reads (score, lives) in React state.
 *
 * ── The one rule that makes this game fair ────────────────────────────
 * A body-controlled dodger can be made impossible by accident. Two things stop
 * that here, and neither is optional:
 *
 *  1. INVULNERABILITY after a hit ({@link INVULN_MS}). Without it a single rock
 *     overlapping the player for four frames takes all three lives at once, and
 *     the visitor loses before they have understood they were hit.
 *  2. A collision radius SMALLER than the drawn figure. The player's sprite is
 *     ~110px wide and the hitbox is 0.62 of that, so a rock has to visibly
 *     strike them to count. Every near miss the visitor thinks they escaped,
 *     they did.
 *
 * Both err the same way on purpose: a public kiosk game that feels unfair gets
 * abandoned mid-run, and an abandoned run is worse than an easy one.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../../gameSound';
import { useGameLoop } from '../../useGameLoop';
import type { MotionPhase, PlayerTrackingState } from '../poseTypes';
import {
  FIELD_H,
  FIELD_W,
  PLAYER_R,
  PLAYER_Y,
  drawDodgePop,
  drawPlayer,
  drawRock,
  drawSmoke,
  type Rock,
  type Smoke,
} from './rocksRender';

export const MAX_LIVES = 3;
const POINTS_PER_DODGE = 10;

/** Pool ceilings — the kiosk runs for days. */
const MAX_ROCKS = 14;
const MAX_SMOKE = 40;
const MAX_POPS = 6;

/** How long the player cannot be hit again after a hit. */
const INVULN_MS = 1400;

/**
 * Fraction of the drawn figure that is actually solid. See the header — this is
 * what turns "I definitely dodged that" into a dodge.
 */
const HITBOX = 0.62;

/** Speed multiplier while the player is out of view. */
const STALL_SPEED = 0.2;

interface Level {
  /** Seconds from the start of the run at which this level takes over. */
  until: number;
  /** Seconds between spawns. */
  interval: number;
  speed: [number, number];
  radius: [number, number];
  /** Max sideways drift, px/s. 0 = straight down. */
  drift: number;
  concurrent: number;
}

/**
 * Five levels, as the brief lays them out: one slow rock, then two, then
 * several, then varied trajectories, then the storm. The run has no time limit
 * — it ends when the lives do — so the last level simply continues.
 */
const LEVELS: Level[] = [
  { until: 12, interval: 1.6, speed: [340, 420], radius: [55, 75], drift: 0, concurrent: 2 },
  { until: 24, interval: 1.15, speed: [420, 530], radius: [55, 85], drift: 0, concurrent: 3 },
  { until: 36, interval: 0.85, speed: [500, 640], radius: [50, 95], drift: 60, concurrent: 5 },
  { until: 50, interval: 0.66, speed: [580, 760], radius: [50, 105], drift: 130, concurrent: 7 },
  {
    until: Infinity,
    interval: 0.52,
    speed: [660, 880],
    radius: [45, 115],
    drift: 190,
    concurrent: 9,
  },
];

function levelAt(elapsed: number): { level: Level; index: number } {
  const index = LEVELS.findIndex((l) => elapsed < l.until);
  const i = index === -1 ? LEVELS.length - 1 : index;
  return { level: LEVELS[i] as Level, index: i };
}

export interface DodgeRocksApi {
  phase: MotionPhase;
  score: number;
  dodged: number;
  lives: number;
  /** 1-based, for the HUD. */
  level: number;
  stalled: boolean;
  /** The run's total, set once when it ends. Banked by Monitor 1. */
  finalScore: number | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  ready: () => void;
  begin: () => void;
  restart: () => void;
}

export function useDodgeRocks(player: React.RefObject<PlayerTrackingState>): DodgeRocksApi {
  const [phase, setPhase] = useState<MotionPhase>('calibrating');
  const [score, setScore] = useState(0);
  const [dodged, setDodged] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [level, setLevel] = useState(1);
  const [stalled, setStalled] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rocksRef = useRef<Rock[]>([]);
  const smokeRef = useRef<Smoke[]>([]);
  const popsRef = useRef<{ x: number; y: number; life: number; maxLife: number }[]>([]);
  const playerXRef = useRef(FIELD_W / 2);
  const elapsedRef = useRef(0);
  const spawnRef = useRef(0);
  const nextIdRef = useRef(1);
  const scoreRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  /** performance.now() until which the player cannot be hit. */
  const invulnUntilRef = useRef(0);
  const flashRef = useRef(0);
  const doneRef = useRef(false);
  const stalledRef = useRef(false);

  const reset = useCallback(() => {
    rocksRef.current = [];
    smokeRef.current = [];
    popsRef.current = [];
    playerXRef.current = FIELD_W / 2;
    elapsedRef.current = 0;
    spawnRef.current = 0;
    scoreRef.current = 0;
    livesRef.current = MAX_LIVES;
    invulnUntilRef.current = 0;
    flashRef.current = 0;
    doneRef.current = false;
    stalledRef.current = false;
    setScore(0);
    setDodged(0);
    setLives(MAX_LIVES);
    setLevel(1);
    setStalled(false);
    setFinalScore(null);
  }, []);

  const ready = useCallback(() => {
    reset();
    setPhase('countdown');
  }, [reset]);

  const begin = useCallback(() => setPhase('playing'), []);

  const restart = useCallback(() => {
    reset();
    setPhase('calibrating');
  }, [reset]);

  // The run's final score, published once. Monitor 1 banks it into JEJU POINTS
  // off the broadcast — this screen has no store of its own.
  useEffect(() => {
    if (phase !== 'result' || doneRef.current) return;
    doneRef.current = true;
    sfx.lose();
    setFinalScore(scoreRef.current);
  }, [phase]);

  useGameLoop(
    useCallback(
      (dt: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const tracked = player.current;
        const lost = !tracked.detected;
        if (lost !== stalledRef.current) {
          stalledRef.current = lost;
          setStalled(lost);
        }

        if (!lost) {
          // The body IS the controller. Already smoothed, mirrored and
          // range-expanded upstream, so this is a plain map onto the field.
          playerXRef.current =
            Math.max(0, Math.min(1, tracked.centerX)) * (FIELD_W - PLAYER_R * 2) + PLAYER_R;
        }

        const speedScale = lost ? STALL_SPEED : 1;
        if (!lost) elapsedRef.current += dt;
        const { level: lv, index } = levelAt(elapsedRef.current);
        if (index + 1 !== level) setLevel(index + 1);

        // ── Spawn ──
        if (!lost) {
          spawnRef.current += dt;
          if (spawnRef.current >= lv.interval && rocksRef.current.length < lv.concurrent) {
            spawnRef.current = 0;
            const rocks = rocksRef.current;
            if (rocks.length >= MAX_ROCKS) rocks.shift();
            const [rlo, rhi] = lv.radius;
            const r = rlo + Math.random() * (rhi - rlo);
            const [slo, shi] = lv.speed;
            rocks.push({
              id: nextIdRef.current++,
              x: r + Math.random() * (FIELD_W - r * 2),
              y: -r,
              vy: slo + Math.random() * (shi - slo),
              vx: (Math.random() * 2 - 1) * lv.drift,
              r,
              spin: Math.random() * Math.PI * 2,
              spinRate: (Math.random() - 0.5) * 2.2,
              seed: Math.floor(Math.random() * 1000),
              scored: false,
            });
          }
        }

        // ── Move, collide, score ──
        const now = performance.now();
        const invulnerable = now < invulnUntilRef.current;
        flashRef.current = Math.max(0, flashRef.current - dt * 1.4);

        const rocks = rocksRef.current;
        let dodgedNow = 0;
        let gained = 0;
        let hit = false;

        for (let i = rocks.length - 1; i >= 0; i -= 1) {
          const rock = rocks[i] as Rock;
          rock.y += rock.vy * dt * speedScale;
          rock.x += rock.vx * dt * speedScale;
          rock.spin += rock.spinRate * dt * speedScale;

          // Bounce off the walls rather than drifting off-screen — a rock that
          // leaves sideways is a spawn the player never had to deal with.
          if (rock.x < rock.r) {
            rock.x = rock.r;
            rock.vx = Math.abs(rock.vx);
          } else if (rock.x > FIELD_W - rock.r) {
            rock.x = FIELD_W - rock.r;
            rock.vx = -Math.abs(rock.vx);
          }

          // Circle-circle, the cheap test the brief asks for.
          if (!lost && !invulnerable && !hit) {
            const dx = rock.x - playerXRef.current;
            const dy = rock.y - PLAYER_Y;
            const reach = rock.r + PLAYER_R * HITBOX;
            if (dx * dx + dy * dy < reach * reach) {
              rocks.splice(i, 1);
              hit = true;
              // Smoke where it struck, so the hit has a physical cause on screen.
              const smoke = smokeRef.current;
              for (let s = 0; s < 12; s += 1) {
                if (smoke.length >= MAX_SMOKE) smoke.shift();
                const a = Math.random() * Math.PI * 2;
                const sp = 120 + Math.random() * 300;
                smoke.push({
                  x: rock.x,
                  y: rock.y,
                  vx: Math.cos(a) * sp,
                  vy: Math.sin(a) * sp - 120,
                  life: 0.7,
                  maxLife: 0.7,
                  r: 18 + Math.random() * 26,
                });
              }
              continue;
            }
          }

          // Past the player and still whole — that is a dodge.
          if (!rock.scored && rock.y > PLAYER_Y + PLAYER_R) {
            rock.scored = true;
            dodgedNow += 1;
            gained += POINTS_PER_DODGE;
            const pops = popsRef.current;
            if (pops.length >= MAX_POPS) pops.shift();
            pops.push({ x: rock.x, y: PLAYER_Y - 60, life: 0.8, maxLife: 0.8 });
          }

          if (rock.y - rock.r > FIELD_H) rocks.splice(i, 1);
        }

        if (hit) {
          invulnUntilRef.current = now + INVULN_MS;
          flashRef.current = 1;
          sfx.miss();
          livesRef.current -= 1;
          setLives(livesRef.current);
          if (livesRef.current <= 0) setPhase('result');
        }

        if (gained > 0) {
          scoreRef.current += gained;
          setScore(scoreRef.current);
          setDodged((n) => n + dodgedNow);
        }

        // ── Smoke + pops ──
        const smoke = smokeRef.current;
        for (let i = smoke.length - 1; i >= 0; i -= 1) {
          const s = smoke[i] as Smoke;
          s.life -= dt;
          if (s.life <= 0) {
            smoke.splice(i, 1);
            continue;
          }
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.vy += 260 * dt;
        }

        const pops = popsRef.current;
        for (let i = pops.length - 1; i >= 0; i -= 1) {
          const p = pops[i]!;
          p.life -= dt;
          if (p.life <= 0) {
            pops.splice(i, 1);
            continue;
          }
          p.y -= 150 * dt;
        }

        // ── Draw ──
        ctx.clearRect(0, 0, FIELD_W, FIELD_H);
        ctx.globalAlpha = lost ? 0.4 : 1;
        for (const s of smoke) drawSmoke(ctx, s);
        for (const rock of rocks) drawRock(ctx, rock);
        // Blink through the invulnerability window, so its length is legible.
        const blink = invulnerable && Math.floor(now / 110) % 2 === 0;
        if (!blink) drawPlayer(ctx, playerXRef.current, flashRef.current);
        ctx.globalAlpha = 1;
        for (const p of pops) drawDodgePop(ctx, p.x, p.y, p.life, p.maxLife);
      },
      [player, level],
    ),
    phase === 'playing',
  );

  return {
    phase,
    score,
    dodged,
    lives,
    level,
    stalled,
    finalScore,
    canvasRef,
    ready,
    begin,
    restart,
  };
}
