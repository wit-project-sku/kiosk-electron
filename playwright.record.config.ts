import base from './playwright.config';

// Re-record tests/e2e/fixtures/api from stage (see tests/e2e/record.spec.ts).
process.env['RECORD'] = '1';

export default { ...base, testMatch: 'record.spec.ts', retries: 0 };
