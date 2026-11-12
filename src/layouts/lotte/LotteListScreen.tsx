/**
 * 롯데 뭐먹지 / 뭐사지 / 시설안내 (Figma 목록-W011~W013): the 인사 list — category chips, 초성, scrolling
 * rows. The categories come from this venue's own catalogue, so the chips differ by branch.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { KioskScreenId } from '@shared/types/kiosk';
import { useDetailStore } from '@renderer/store/detailStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useShopStore } from '@renderer/store/shopStore';
import { leadingChosung, type Chosung } from '@renderer/lib/chosung';
import { shopName, shopSecondCategory, shopsForBase } from '@renderer/lib/shops';
import { LotteChosungRow } from './LotteChosungRow';
import { LottePageFrame } from './LottePageFrame';
import { LotteShopRow } from './LotteShopRow';
import { shopDetail } from './lotteDetailItem';
import { LOTTE_EAT, LOTTE_FACILITY, LOTTE_SHOP, compareShops } from './lotteSample';
import c from './lotteContent.module.css';

export type LotteListScreenId = Extract<KioskScreenId, 'eat' | 'shop' | 'help'>;
const BASE: Record<LotteListScreenId, string> = {
  eat: LOTTE_EAT,
  shop: LOTTE_SHOP,
  help: LOTTE_FACILITY,
};
const TITLE: Record<LotteListScreenId, string> = {
  eat: "'롯데' 뭐먹지?",
  shop: "'롯데' 뭐사지?",
  help: '롯데 시설안내',
};
const SCROLL_STEP = 760;

export function LotteListScreen({
  screen,
  controller,
}: {
  screen: LotteListScreenId;
  controller: KioskController;
}): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const setDetail = useDetailStore((s) => s.setItem);
  const shops = useShopStore((s) => s.shops);
  const [category, setCategory] = useState<string | null>(null);
  const [jamo, setJamo] = useState<Chosung | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const title = TITLE[screen];
  const showChosung = lang === 'ko';

  useEffect(() => {
    if (!showChosung && jamo !== null) setJamo(null);
  }, [showChosung, jamo]);
  useEffect(() => {
    void window.api.kiosk.setScreen(category ? `${screen}_category` : screen);
  }, [category, screen]);

  const base = useMemo(() => shopsForBase(shops, BASE[screen]), [shops, screen]);
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of base)
      if (s.secondCategoryKr && !map.has(s.secondCategoryKr))
        map.set(s.secondCategoryKr, shopSecondCategory(s, lang));
    return [...map.entries()].sort(
      (a, b) => (parseInt(a[0], 10) || 999) - (parseInt(b[0], 10) || 999),
    );
  }, [base, lang]);
  /* The first category starts selected, as the frames draw it. */
  const active = category ?? categories[0]?.[0] ?? null;

  const visible = useMemo(() => {
    let list = active ? base.filter((s) => s.secondCategoryKr === active) : base;
    if (jamo) list = list.filter((s) => leadingChosung(shopName(s, 'ko')) === jamo);
    return [...list].sort(compareShops);
  }, [base, active, jamo]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [active, jamo]);

  const scrollBy = (delta: number): void =>
    scrollRef.current?.scrollBy({ top: delta, behavior: 'smooth' });
  const en = lang !== 'ko';

  return (
    <LottePageFrame
      controller={controller}
      title={title}
      subtitle={en ? 'Filter by category.' : '종류를 골라 찾아보세요'}
      showBanner={false}
    >
      <div className={`${c.body} ${c.bodyFull}`}>
        <div className={c.catGrid}>
          {categories.map(([kr, label]) => (
            <button
              key={kr}
              type="button"
              className={`${c.cat} ${active === kr ? c.catOn : ''}`}
              aria-pressed={active === kr}
              onClick={() => setCategory(kr)}
            >
              {label.replace(/^\d+-/, '')}
            </button>
          ))}
        </div>
        {showChosung && <LotteChosungRow value={jamo} onChange={setJamo} />}
        <div className={c.listWrap}>
          {visible.length > 0 ? (
            <div className={c.list1col} ref={scrollRef}>
              {visible.map((shop) => (
                <LotteShopRow
                  key={shop.id}
                  shop={shop}
                  lang={lang}
                  onClick={() => {
                    setDetail(shopDetail(shop, screen, title, lang));
                    controller.navigate('detail', BASE[screen]);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className={c.empty}>
              {en ? 'No matching shops.' : '조건에 맞는 상점이 없습니다'}
            </div>
          )}
        </div>
      </div>
      <div className={c.scrollBtns}>
        <button
          type="button"
          className={c.scrollBtn}
          aria-label="위로"
          onClick={() => scrollBy(-SCROLL_STEP)}
        >
          ▲
        </button>
        <button
          type="button"
          className={c.scrollBtn}
          aria-label="아래로"
          onClick={() => scrollBy(SCROLL_STEP)}
        >
          ▼
        </button>
      </div>
    </LottePageFrame>
  );
}
