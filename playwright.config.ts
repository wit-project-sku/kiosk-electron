import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests: the real Electron app (built `out/`) against the fake backend.
 * Build first — `npm run test:e2e` does it. One worker: the app holds a
 * single-instance lock, so two kiosks cannot run side by side.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: 'test-results',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
