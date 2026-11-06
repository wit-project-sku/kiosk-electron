import { afterEach, describe, expect, it } from 'vitest';
import { resolveUpdateChannel } from '@main/updater/updateChannel';
import { resolveUpdateSchedule } from '@main/updater/updateSchedule';

const saved = process.env['UPDATE_CHANNEL'];
afterEach(() => {
  if (saved === undefined) delete process.env['UPDATE_CHANNEL'];
  else process.env['UPDATE_CHANNEL'] = saved;
});

describe('update channel', () => {
  it.each([
    ['beta', 'beta'],
    ['kdh', 'kdh'],
    [' KDH ', 'kdh'],
    ['latest', 'latest'],
    ['', 'latest'],
    ['nonsense', 'latest'],
  ])('UPDATE_CHANNEL=%j → %s', (raw, want) => {
    process.env['UPDATE_CHANNEL'] = raw;
    expect(resolveUpdateChannel()).toBe(want);
  });

  it('kdh checks as often as beta (practice lane), latest keeps its weekly window', () => {
    expect(resolveUpdateSchedule('kdh')).toEqual(resolveUpdateSchedule('beta'));
    expect(resolveUpdateSchedule('latest')).not.toEqual(resolveUpdateSchedule('beta'));
  });
});
