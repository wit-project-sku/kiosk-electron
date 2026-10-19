import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/core/logger', () => ({
  createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const { InsaCourseService } = await import('@main/services/InsaCourseService');

/** Only what the service asks of the kiosk: its region (and, for the old route, its config). */
const kiosk = (region: string | null, kioskId = 'W004') =>
  ({
    region: () => region,
    kioskNum: () => 4,
    getConfig: () => ({ kioskId }),
  }) as never;

const spot = (extra: Record<string, unknown>) => ({
  shopId: 1,
  order: 1,
  dwellMinutes: 30,
  arriveAt: '13:05',
  leaveAt: '13:35',
  walkMinutes: 0,
  walkMeters: 0,
  secondCategory: '2-역사/유적',
  hoursMethod: 'range',
  ...extra,
});

const answer = (spots: unknown[], transport?: string) => ({
  success: true,
  data: {
    duration: '2-4',
    numberOfPeople: 2,
    ...(transport ? { transport } : {}),
    realtime: {
      available: true,
      startAt: '13:00',
      endAt: '15:00',
      totalSpots: spots.length,
      totalMinutes: 120,
      totalWalkMeters: 0,
      unmetInterests: [],
      spots,
    },
    general: {
      totalSpots: 0,
      totalMinutes: 0,
      totalWalkMeters: 0,
      unmetInterests: [],
      sameAsRealtime: false,
      spots: [],
    },
  },
});

const query = {
  interests: ['2-역사/유적'],
  duration: '2-4' as const,
  numberOfPeople: 2,
  startAt: '2026-10-19T13:00:00',
};

afterEach(() => vi.unstubAllGlobals());

describe('지점 코스 — 이동수단 (오색시장)', () => {
  it('sends the chosen transport and keeps each leg’s mode, minutes and meters', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () =>
        answer([spot({ moveMode: 'CAR', moveMinutes: 5, moveMeters: 1352 })], 'CAR'),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const set = await new InsaCourseService(kiosk('OSAEK')).recommend({
      ...query,
      transport: 'CAR',
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body,
    );
    expect(body).toMatchObject({ region: 'OSAEK', transport: 'CAR' });
    const leg = set.realtime.spots[0]!;
    expect(leg).toMatchObject({
      moveMode: 'CAR',
      moveMinutes: 5,
      moveMeters: 1352,
      walkMinutes: 0,
    });
  });

  it('omits transport when the screen did not choose one (인사동), and the legs carry no mode', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => answer([spot({ walkMinutes: 4, walkMeters: 260 })]),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const set = await new InsaCourseService(kiosk('INSADONG_NORTH', 'W001')).recommend(query);

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body,
    );
    expect(body).not.toHaveProperty('transport');
    expect(set.realtime.spots[0]).toMatchObject({
      moveMode: null,
      moveMinutes: null,
      moveMeters: null,
      walkMinutes: 4,
    });
  });

  it('ignores a mode it does not know', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => answer([spot({ moveMode: 'SHIP', moveMinutes: 9 })]),
      })),
    );
    const set = await new InsaCourseService(kiosk('OSAEK')).recommend({
      ...query,
      transport: 'WALK',
    });
    expect(set.realtime.spots[0]!.moveMode).toBeNull();
  });
});
