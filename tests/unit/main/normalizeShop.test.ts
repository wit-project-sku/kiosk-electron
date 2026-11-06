import { describe, expect, it, vi } from 'vitest';

// The real logger pulls in electron-log/main + electron, which only exist inside Electron.
const warn = vi.fn();
vi.mock('@main/core/logger', () => ({
  createLogger: () => ({ warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const { normalizeShops } = await import('@main/services/normalizeShop');

const base = {
  id: 1,
  no: '1',
  shopNameKr: '가게',
  addressKr: '서울',
  hashTagKr: '',
  descriptionKr: '',
  images: [],
};

describe('normalizeShops', () => {
  it('replaces null text fields with empty strings so render-time .trim() cannot throw', () => {
    const { shops, report } = normalizeShops(
      [{ ...base, addressKr: null, shopNameEn: null }],
      'test',
    );
    expect(shops[0]?.addressKr).toBe('');
    expect(shops[0]?.shopNameEn).toBe('');
    expect(report.repaired).toBe(1);
    expect(report.fields).toMatchObject({ addressKr: 1, shopNameEn: 1 });
  });

  it('leaves absent optional languages absent (Korean fallback still works)', () => {
    const { shops } = normalizeShops([base], 'test');
    expect('shopNameVn' in (shops[0] as object)).toBe(false);
  });

  it('keeps nullable category fields null — filters compare against null', () => {
    const { shops, report } = normalizeShops([{ ...base, baseCategoryKr: null }], 'test');
    expect(shops[0]?.baseCategoryKr).toBeNull();
    expect(report.repaired).toBe(0);
  });

  it('drops rows without a numeric id and non-object rows', () => {
    const { shops, report } = normalizeShops([{ ...base, id: '7' }, null, 'x', base], 'test');
    expect(shops).toHaveLength(1);
    expect(report.dropped).toBe(3);
  });

  it('coerces no to string', () => {
    const { shops } = normalizeShops(
      [
        { ...base, no: 12 },
        { ...base, id: 2, no: null },
      ],
      'test',
    );
    expect(shops.map((s) => s.no)).toEqual(['12', '']);
  });

  it('turns a non-array images into [] and removes blank/invalid image entries', () => {
    const { shops } = normalizeShops(
      [
        { ...base, images: null },
        {
          ...base,
          id: 2,
          images: [
            { id: 5, imageUrl: 'https://x/a.webp', sortOrder: 1 },
            { id: 6, imageUrl: '' },
            null,
            { imageUrl: 'https://x/b.webp', sortOrder: Number.NaN },
          ],
        },
      ],
      'test',
    );
    expect(shops[0]?.images).toEqual([]);
    expect(shops[1]?.images).toEqual([
      { id: 5, imageUrl: 'https://x/a.webp', sortOrder: 1 },
      { id: 0, imageUrl: 'https://x/b.webp', sortOrder: 0 },
    ]);
  });

  it('warns once per payload only when something was repaired, and stays quiet on request', () => {
    warn.mockClear();
    normalizeShops([base], 'clean');
    expect(warn).not.toHaveBeenCalled();
    normalizeShops([{ ...base, addressKr: null }], 'dirty');
    expect(warn).toHaveBeenCalledTimes(1);
    normalizeShops([{ ...base, addressKr: null }], 'cache', true);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
