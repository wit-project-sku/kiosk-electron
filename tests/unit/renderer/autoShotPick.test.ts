import { describe, expect, it } from 'vitest';
import { pickAutoShot } from '../../../src/renderer/src/lib/autoShotPick';

const catalogue = {
  jeju: [{ code: '15.1', gender: 'female' as const }],
  'w=hannbok': [{ code: '1.1', gender: 'female' as const }],
  global: [{ code: '5.6', gender: undefined }],
};

describe('자동 촬영 — what it wears', () => {
  it('a 제주 outfit gets a random 배경 테마', () => {
    expect(pickAutoShot(catalogue, [1, 2, 3], () => 0)).toEqual({
      clothingKey: 'female|15.1',
      backgroundId: 1,
    });
  });

  it('any other outfit is shot without a background (the visitor rule)', () => {
    // 0.5 → the second of three outfits (w=hannbok 1.1); 0.99 → global 5.6, no gender.
    expect(pickAutoShot(catalogue, [1, 2, 3], () => 0.5)).toEqual({
      clothingKey: 'female|1.1',
      backgroundId: null,
    });
    expect(pickAutoShot(catalogue, [1, 2, 3], () => 0.99)).toEqual({
      clothingKey: '|5.6',
      backgroundId: null,
    });
  });

  it('a 제주 outfit with no backgrounds assigned is shot without one; an empty catalogue picks nothing', () => {
    expect(pickAutoShot(catalogue, [], () => 0)).toEqual({
      clothingKey: 'female|15.1',
      backgroundId: null,
    });
    expect(pickAutoShot({}, [1])).toBeNull();
  });
});
