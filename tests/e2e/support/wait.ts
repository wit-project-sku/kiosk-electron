import type { FakeApi } from './fake-api';

/** Resolve once no new request arrived for `quietMs` (bounded by `maxMs`). */
export async function waitForQuiet(api: FakeApi, quietMs: number, maxMs: number): Promise<void> {
  const start = Date.now();
  let seen = api.requests.length;
  let lastChange = Date.now();
  while (Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 500));
    if (api.requests.length !== seen) {
      seen = api.requests.length;
      lastChange = Date.now();
    } else if (Date.now() - lastChange >= quietMs) {
      return;
    }
  }
}
