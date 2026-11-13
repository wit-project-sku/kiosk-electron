import base from './playwright.config';

// 촬영 기록 장애 훈련 (tests/faults). Not in CI — run on demand: npm run test:faults.
export default {
  ...base,
  testDir: 'tests/faults',
  testMatch: '*.spec.ts',
  retries: 0,
  timeout: 15 * 60_000,
};
