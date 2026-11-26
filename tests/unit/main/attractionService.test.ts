import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/core/logger', () => ({
  createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const { AttractionService } = await import('@main/services/AttractionService');

const cache = () => {
  const store = new Map<string, Record<string, unknown>>();
  return {
    get: (k: string) => (store.has(k) ? { data: store.get(k) } : null),
    upsert: (k: string, data: Record<string, unknown>) => void store.set(k, data),
  };
};
const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, code: 200, data }), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('AttractionService', () => {
  it('reads the one 관광명소 path every site uses, by region', async () => {
    vi.stubEnv('WITTERIA_API_BASE', 'https://api.test');
    vi.stubEnv('JEJU_ATTRACTIONS_API_URL', '');
    const fetch = vi.fn().mockResolvedValue(ok([{ id: 1, kioskId: 11, shopNameKr: '석촌호수' }]));
    vi.stubGlobal('fetch', fetch);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = new AttractionService(cache() as any, { region: () => 'LOTTE_WORLD_MALL' } as any);
    expect(await s.refresh()).toBe(1);
    expect(String(fetch.mock.calls[0]![0])).toBe('https://api.test/api/sights?region=LOTTE_WORLD_MALL');
    expect(s.list().map((a) => a.id)).toEqual([1]);

    await s.listByInitial('ㅅ');
    expect(String(fetch.mock.calls[1]![0])).toBe(
      `https://api.test/api/sights?region=LOTTE_WORLD_MALL&initial=${encodeURIComponent('ㅅ')}`,
    );
  });
});
