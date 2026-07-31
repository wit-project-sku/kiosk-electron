#!/usr/bin/env node
/**
 * Re-vendor the compiled NestJS payment agent into `payment-agent/dist/`.
 *
 * The kiosk embeds the agent (source: Desktop/work/node-payment-agent) and runs
 * it as an isolated Node child (see src/main/core/PaymentAgentManager.ts). Only
 * the COMPILED `dist/` is vendored — its runtime deps (serialport,
 * better-sqlite3, @nestjs/*) live in the kiosk's own package.json so they get
 * ABI-rebuilt for Electron with the rest of the app.
 *
 * This script exists because the vendored copy silently drifted from the live
 * agent once already (an old build shipped while the standalone process ran the
 * new code). Run it whenever the agent changes so the embed can't go stale.
 *
 * What it does:
 *   1. (default) rebuild the agent from source: `npm install --ignore-scripts`
 *      then `npx nest build`. Pass --no-build to copy the existing dist as-is.
 *   2. wipe payment-agent/dist and copy every compiled `.js` across, preserving
 *      the tree. Strips `.map` / `.d.ts` / `*.tsbuildinfo` — runtime doesn't
 *      need them and they bloat the asar.
 *   3. write `payment-agent/dist/package.json` = {"type":"commonjs"}. REQUIRED:
 *      the kiosk package.json is `"type":"module"`, so without this Node loads
 *      the agent's CommonJS .js as ESM and crashes (`exports is not defined`).
 *
 * Usage:
 *   node scripts/vendor-payment-agent.mjs [--agent <path>] [--no-build]
 *   AGENT_DIR=../work/node-payment-agent node scripts/vendor-payment-agent.mjs
 *
 * Default agent path: ../work/node-payment-agent relative to this repo root
 * (i.e. Desktop/work/node-payment-agent when the kiosk is at Desktop/kiosk-app).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { build: true, agent: process.env.AGENT_DIR ?? null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--no-build') args.build = false;
    else if (argv[i] === '--agent') args.agent = argv[++i];
  }
  return args;
}

function log(msg) {
  process.stdout.write(`[vendor-payment-agent] ${msg}\n`);
}

const args = parseArgs(process.argv.slice(2));
const agentDir = resolve(repoRoot, args.agent ?? join('..', 'work', 'node-payment-agent'));
const srcDist = join(agentDir, 'dist');
const destDist = join(repoRoot, 'payment-agent', 'dist');

if (!existsSync(agentDir)) {
  console.error(`[vendor-payment-agent] agent dir not found: ${agentDir}\n` +
    `Pass --agent <path> or set AGENT_DIR.`);
  process.exit(1);
}

// 1. Build the agent from source (unless --no-build).
if (args.build) {
  log(`building agent in ${agentDir} …`);
  const win = process.platform === 'win32';
  const npm = win ? 'npm.cmd' : 'npm';
  const npx = win ? 'npx.cmd' : 'npx';
  // Node >=18.20 refuses to spawn .cmd shims without shell:true (CVE-2024-27980).
  const opts = { cwd: agentDir, stdio: 'inherit', shell: win };
  execFileSync(npm, ['install', '--ignore-scripts'], opts);
  execFileSync(npx, ['nest', 'build'], opts);
}

if (!existsSync(srcDist)) {
  console.error(`[vendor-payment-agent] built dist not found: ${srcDist}`);
  process.exit(1);
}

// 2. Wipe and re-copy, keeping only runtime .js.
log(`wiping ${relative(repoRoot, destDist)}`);
rmSync(destDist, { recursive: true, force: true });
mkdirSync(destDist, { recursive: true });

const SKIP = (name) =>
  name.endsWith('.map') || name.endsWith('.d.ts') || name.endsWith('.tsbuildinfo');

let copied = 0;
function copyTree(from, to) {
  for (const entry of readdirSync(from)) {
    const src = join(from, entry);
    const dst = join(to, entry);
    if (statSync(src).isDirectory()) {
      copyTree(src, dst);
    } else if (!SKIP(entry)) {
      mkdirSync(dirname(dst), { recursive: true });
      cpSync(src, dst);
      copied++;
    }
  }
}
copyTree(srcDist, destDist);
log(`copied ${copied} files`);

// 3. Mark the vendored subtree CommonJS (kiosk package.json is type:module).
writeFileSync(join(destDist, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
log('wrote dist/package.json {"type":"commonjs"}');
log('done');
