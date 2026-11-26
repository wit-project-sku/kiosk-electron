import { afterEach, describe, expect, it } from 'vitest';
import type { Shop } from '@shared/types/shop';
import { useKioskStore } from '@renderer/store/kioskStore';
import { lotteShopLink, shopDetail } from '@layouts/lotte/lotteDetailItem';

const initial = useKioskStore.getState();
const asKiosk = (kioskId: string): void =>
  useKioskStore.setState({ config: { ...initial.config, kioskId, layout: 'LOTTE' } as typeof initial.config });
const shop = (over: Partial<Shop>): Shop => ({ id: 1, shopNameKr: '편백집', naverLink: null, ...over }) as Shop;

afterEach(() => useKioskStore.setState(initial, true));

describe('롯데 상세 QR link', () => {
  it("uses the shop's own Naver link when the server has one", () => {
    asKiosk('W012');
    expect(lotteShopLink(shop({ naverLink: 'https://naver.me/abc' }))).toBe('https://naver.me/abc');
  });

  it('falls back to a Naver Map search for this venue and shop, like 제주 rows', () => {
    asKiosk('W013');
    const url = lotteShopLink(shop({ naverLink: '' }));
    expect(url.startsWith('https://map.naver.com/p/search/')).toBe(true);
    expect(decodeURIComponent(url)).toContain('롯데백화점 청량리점 편백집');
  });

  it('puts the link and a homepage on the detail item', () => {
    asKiosk('W012');
    const item = shopDetail(shop({ homepage: 'https://example.com' }), 'eat', '뭐먹지', 'ko');
    expect(item.blogReviews).toMatch(/^https:\/\/map\.naver\.com/);
    expect(item.homepageUrl).toBe('https://example.com');
    expect(shopDetail(shop({ homepage: '' }), 'eat', '뭐먹지', 'ko').homepageUrl).toBeUndefined();
  });
});

describe('롯데 목록 order', () => {
  it('puts association members, then shops with photos, before the rest', async () => {
    const { compareListShops } = await import('@layouts/lotte/lotteSample');
    const img = (n: number) => Array.from({ length: n }, (_, i) => ({ imageUrl: `u${i}`, sortOrder: i }));
    const mk = (id: number, n: number, extra: Partial<Shop> = {}): Shop =>
      ({ id, shopNameKr: `가게${id}`, addressKr: '서울 1F', images: img(n), ...extra }) as unknown as Shop;
    const order = [mk(1, 0), mk(2, 1), mk(3, 3), mk(4, 0, { fromAssociation: true }), mk(5, 2)]
      .sort(compareListShops)
      .map((s) => s.id);
    // 3 and 5 both show two photos, so they tie on photos and fall back to the name order.
    expect(order).toEqual([4, 3, 5, 2, 1]);
  });
});
