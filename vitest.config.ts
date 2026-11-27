import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests — pure logic only (no Electron, no DOM). They live in tests/unit and import
 * from src through the same aliases as electron.vite.config.ts.
 * Runtime tests that launch the Electron app belong in tests/e2e (separate runner).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@main': resolve('src/main'),
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src'),
      '@layouts': resolve('src/layouts'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
