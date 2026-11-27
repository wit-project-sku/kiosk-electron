import base from './playwright.config';

// Long-run memory check (tests/soak). Not in CI — see tests/soak/soak.spec.ts.
process.env['SOAK'] = '1';

export default {
  ...base,
  testDir: 'tests/soak',
  testMatch: 'soak.spec.ts',
  retries: 0,
  timeout: 0,
};
