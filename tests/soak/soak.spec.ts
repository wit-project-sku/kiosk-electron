// Long-run memory check — the failure mode behind the October 2026 field shutdowns:
// display videos stream through the main process (`media://`), its memory climbs
// with uptime, and after 16–22 h the main process dies with
// "Array buffer allocation failed".
//
//   npm run test:soak                    (30 min, W004 오색시장)
//   SOAK_MINUTES=120 SOAK_SITE=W001 npm run test:soak
//
// Needs ffmpeg on PATH (test videos are generated once into test-results/soak-videos).
// Not part of CI — it is long by design. Run it before a release that touches video,
// media://, the display window or anything that holds data in the main process.
import { execFileSync } from 'node:child_process';
import { existsSync, linkSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { getKioskRegion } from '@shared/config/kioskLocations';
import { FIXTURE_DIR, startFakeApi } from '../e2e/support/fake-api';
import { REPO_ROOT, findWindow, launchKiosk, type Site } from '../e2e/support/launch';

const MINUTES = Number(process.env['SOAK_MINUTES'] ?? 30);
const SITE = (process.env['SOAK_SITE'] ?? 'W004') as Site;
const MAX_MB_PER_HOUR = Number(process.env['SOAK_MAX_MB_PER_HOUR'] ?? 100);
const SAMPLE_MS = 15_000;
const TAP_EVERY_MS = 60_000;

interface Sample {
  t: number;
  mainRssMb: number;
  heapMb: number;
  externalMb: number;
  arrayBuffersMb: number;
  rendererMb: number;
  gpuMb: number;
}

/** Video names the site's subtitle rows reference (`osaek/J-1=Default-1` → that path + .mp4). */
function videoNames(site: Site): string[] {
  const key = `GET /api/kiosks/${getKioskRegion(site)}/subtitles/v2`;
  for (const f of readdirSync(FIXTURE_DIR)) {
    const raw = readFileSync(join(FIXTURE_DIR, f), 'utf8');
    if (!raw.includes(`"key":"${key}"`)) continue;
    return [
      ...new Set([...raw.matchAll(/"videoFileName":"([^"]+)"/g)].map((m) => m[1] ?? '')),
    ].filter(Boolean);
  }
  return [];
}

/** 6 distinct 1080p ~4 Mbps clips, hard-linked under every name the site expects. */
function prepareVideos(names: string[]): string {
  const dir = join(REPO_ROOT, 'test-results', 'soak-videos');
  const src = join(dir, '_src');
  mkdirSync(src, { recursive: true });
  for (let i = 0; i < 6; i++) {
    const out = join(src, `clip${i}.mp4`);
    if (existsSync(out)) continue;
    execFileSync('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      `testsrc2=size=1920x1080:rate=30,hue=h=${i * 60}`,
      '-t',
      '20',
      '-c:v',
      'libx264',
      '-b:v',
      '4M',
      '-pix_fmt',
      'yuv420p',
      out,
    ]);
  }
  names.forEach((name, i) => {
    const target = join(dir, `${name}.mp4`);
    mkdirSync(dirname(target), { recursive: true });
    if (!existsSync(target)) linkSync(join(src, `clip${i % 6}.mp4`), target);
  });
  return dir;
}

/** Least-squares slope in MB per hour over the given samples. */
function slopeMbPerHour(samples: Sample[]): number {
  const n = samples.length;
  if (n < 2) return 0;
  const xs = samples.map((s) => s.t / 3_600_000);
  const ys = samples.map((s) => s.mainRssMb);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += ((xs[i] ?? 0) - mx) * ((ys[i] ?? 0) - my);
    den += ((xs[i] ?? 0) - mx) ** 2;
  }
  return den ? num / den : 0;
}

test.describe('soak', () => {
  test.skip(!process.env['SOAK'], 'run `npm run test:soak`');
  test.setTimeout((MINUTES + 10) * 60_000);

  // eslint-disable-next-line no-empty-pattern -- Playwright requires the fixture object pattern
  test(`${SITE} main-process memory stays flat for ${MINUTES} min`, async ({}, testInfo) => {
    const names = videoNames(SITE);
    expect(names.length, 'subtitle fixture lists videos for this site').toBeGreaterThan(0);
    const videosDir = prepareVideos(names);

    const api = await startFakeApi();
    const kiosk = await launchKiosk({
      site: SITE,
      apiBase: api.url,
      displayWindow: true,
      env: { KIOSK_VIDEOS_DIR: videosDir },
    });
    const samples: Sample[] = [];
    try {
      const display = await findWindow(kiosk.app, 'display.html');
      // The run is only meaningful if the display really plays video through media://.
      await expect
        .poll(
          () =>
            display.evaluate(() =>
              [...document.querySelectorAll('video')].some((v) => v.currentTime > 0 && !v.paused),
            ),
          { timeout: 120_000, message: 'display window never started a video' },
        )
        .toBe(true);

      const start = Date.now();
      let nextTap = start + TAP_EVERY_MS;
      while (Date.now() - start < MINUTES * 60_000) {
        const m = await kiosk.app.evaluate(({ app }) => ({
          metrics: app.getAppMetrics().map((p) => ({ type: p.type, kb: p.memory.workingSetSize })),
          mem: process.memoryUsage(),
        }));
        const mb = (b: number) => Math.round((b / 1048576) * 10) / 10;
        const kbSum = (type: string) =>
          Math.round(
            m.metrics.filter((p) => p.type === type).reduce((a, p) => a + p.kb, 0) / 102.4,
          ) / 10;
        samples.push({
          t: Date.now() - start,
          mainRssMb: mb(m.mem.rss),
          heapMb: mb(m.mem.heapUsed),
          externalMb: mb(m.mem.external),
          arrayBuffersMb: mb(m.mem.arrayBuffers),
          rendererMb: kbSum('Tab'),
          gpuMb: kbSum('GPU'),
        });

        if (Date.now() >= nextTap) {
          nextTap += TAP_EVERY_MS;
          // Like a visitor: open a tile, come back home.
          const tiles = kiosk.main
            .getByRole('button', { name: /뭐먹지|뭐사지|환율|이벤트/ })
            .locator('visible=true');
          const count = await tiles.count();
          if (count) {
            await tiles
              .nth(Math.floor(Math.random() * count))
              .click()
              .catch(() => undefined);
            await kiosk.main.waitForTimeout(3_000);
            await kiosk.main
              .getByRole('button', { name: /^(홈|홈으로)$/ })
              .locator('visible=true')
              .first()
              .click()
              .catch(() => undefined);
          }
        }
        await kiosk.main.waitForTimeout(SAMPLE_MS);
      }
    } finally {
      await kiosk.close();
      await api.close();
      const csv = ['t_min,main_rss_mb,heap_mb,external_mb,array_buffers_mb,renderer_mb,gpu_mb']
        .concat(
          samples.map((s) =>
            [
              (s.t / 60_000).toFixed(2),
              s.mainRssMb,
              s.heapMb,
              s.externalMb,
              s.arrayBuffersMb,
              s.rendererMb,
              s.gpuMb,
            ].join(','),
          ),
        )
        .join('\n');
      const file = testInfo.outputPath(`soak-${SITE}.csv`);
      writeFileSync(file, csv + '\n');
      await testInfo.attach(`soak-${SITE}.csv`, { path: file, contentType: 'text/csv' });
    }

    // Judge the second half only — startup caches and the first video loads settle first.
    const tail = samples.slice(Math.floor(samples.length / 2));
    const slope = slopeMbPerHour(tail);
    const first = samples[0]?.mainRssMb ?? 0;
    const last = samples[samples.length - 1]?.mainRssMb ?? 0;
    testInfo.annotations.push({
      type: 'soak',
      description: `main RSS ${first} → ${last} MB over ${MINUTES} min; second-half slope ${slope.toFixed(1)} MB/h (limit ${MAX_MB_PER_HOUR})`,
    });
    console.warn(testInfo.annotations.at(-1)?.description);
    expect(slope, 'main-process RSS growth (MB/hour, second half)').toBeLessThan(MAX_MB_PER_HOUR);
  });
});
