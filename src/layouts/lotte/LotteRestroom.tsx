/**
 * 화장실 — 목록 (Figma A-05: W011 8723:3334 · W012 8723:3402 · W013 8723:3470).
 *
 *   1 건물 탭    월드몰 is split by building; a department store has one tab.
 *   2 층 선택    "1F  ㅣ  2F  ㅣ  3F" — the picked floor's plan.
 *   3 시설 종류  화장실 · 유아시설 …, 5 × 2. Only the picked kind goes on the plan.
 *   4 도면       the floor plan with the facilities marked (plans still to come from 롯데,
 *                so the frame's "<건물> 도면 자리" plate stands in).
 *
 * The rows are the 롯데 sheet's FacilityData (lotteFacilities.ts) — base 롯데 시설안내, the kind in
 * secondCategoryKr ('1-화장실' …), the building + floor in the address ("롯데월드몰 B1F"). Building
 * tabs come from every facility so they do not jump when the kind changes; the floors are the
 * picked kind's floors in the picked building.
 *
 * If the site has no facility rows at all, the plate points to the information desk instead.
 */
import { belowModeBar } from './lowReach';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { Fragment, useMemo, useRef, useState } from 'react';
import { useFitText } from '@layouts/components/fitText';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { Shop } from '@shared/types/shop';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useShopStore } from '@renderer/store/shopStore';
import { shopName, shopSecondCategory } from '@renderer/lib/shops';
import { LottePageFrame } from './LottePageFrame';
import { LOTTE_FACILITY, floorRank, lotteSite, shopFloor } from './lotteSample';
import { lt } from './lotteText';
import { placeName, tc, tcRow } from './lotteCopy';
import s from './LotteRestroom.module.css';

const desk = /고객상담|안내/;
const order = (group: string): number => parseInt(group, 10) || 999;
/** "롯데월드몰 B1F" → "롯데월드몰": the address without its trailing floor. */
const placeOf = (shop: Shop): string => shop.addressKr.replace(/\s*\S+$/, '').trim();

export function LotteRestroom({ controller }: { controller: KioskController }): JSX.Element {
  const lang = useLanguageStore((st) => st.currentLanguage);
  const shops = useShopStore((st) => st.shops);
  const lowReach = useAccessibilityStore((st) => st.lowReach);
  const en = lang !== 'ko';
  const site = lotteSite(controller.kioskId);
  const buildingOf = (shop: Shop): string =>
    shop.addressKr.includes('에비뉴엘')
      ? '에비뉴엘'
      : shop.addressKr.includes('타워')
        ? '타워'
        : site.branch;

  const facilities = useMemo(() => shops.filter((x) => x.baseCategoryKr === LOTTE_FACILITY), [shops]);

  /* 3 — the kinds, in the sheet's numbered order, 화장실 picked first as the frame draws it. */
  const kinds = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of facilities)
      if (f.secondCategoryKr && !map.has(f.secondCategoryKr))
        map.set(f.secondCategoryKr, shopSecondCategory(f, lang).replace(/^\d+-/, ''));
    return [...map.entries()].sort((a, b) => order(a[0]) - order(b[0]));
  }, [facilities, lang]);
  const [kind, setKind] = useState<string | null>(null);
  const activeKind =
    kind ?? kinds.find(([k]) => k.endsWith('화장실'))?.[0] ?? kinds[0]?.[0] ?? null;

  /* 1 — buildings over every facility, the kiosk's own building first. */
  const buildings = useMemo(() => {
    const names = [...new Set(facilities.map(buildingOf))];
    return names.length > 0 ? names.sort((a) => (a === site.branch ? -1 : 0)) : [site.branch];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilities, site.branch]);
  const [building, setBuilding] = useState<string | null>(null);
  const activeBuilding = building && buildings.includes(building) ? building : buildings[0]!;

  /* 2 — the picked kind's floors in the picked building. */
  const here = facilities.filter(
    (f) => buildingOf(f) === activeBuilding && f.secondCategoryKr === activeKind,
  );
  const floors = [...new Set(here.map(shopFloor))].sort((a, b) => floorRank(a) - floorRank(b));
  const [floor, setFloor] = useState<string | null>(null);
  const activeFloor = floor && floors.includes(floor) ? floor : (floors[0] ?? null);

  /* 4 — the plate names the building in full, as the frame does ("롯데월드몰 도면 자리"). */
  /** A tab's building named in full in the visitor's language ("타워" → "LOTTE WORLD TOWER"). */
  const tabLabel = (b: string): string => {
    if (lang === 'ko') return b;
    const f = facilities.find((x) => buildingOf(x) === b);
    return f ? placeName(placeOf(f), controller.kioskId, lang) : b;
  };
  const tabsRef = useRef<HTMLDivElement>(null);
  useFitText(tabsRef, s.tab, en, 0.6, `${lang}|${buildings.join(',')}`, 'ink');
  const place =
    placeOf(facilities.find((f) => buildingOf(f) === activeBuilding) ?? ({ addressKr: '' } as Shop)) ||
    activeBuilding;
  /* Long kind names ("Repair·After-sales", "修理・アフターサービス") wrap, then the row shrinks as one. */
  const kindsRef = useRef<HTMLDivElement>(null);
  useFitText(kindsRef, s.kind, en, 0.6, `${lang}|${kinds.map(([k]) => k).join(',')}`, 'ink');
  const deskShop = useMemo(() => shops.find((x) => desk.test(x.shopNameKr)), [shops]);

  return (
    <LottePageFrame
      controller={controller}
      title={lt('MainButton_WC', lang, { ko: '화장실', en: 'Restroom' })}
      subtitle={tc('WC_Subtitle', lang)}
      showBanner={false}
      /* ♿: header under the bar, the body follows it down by the bar's height. */
      lowReachModeBar
      lowReachShift={belowModeBar()}
    >
      <div className={`${s.body} ${lowReach ? s.bodyLow : ''}`}>
        <div className={s.top}>
          <div className={s.tabs} ref={tabsRef} lang={lang}>
            {buildings.map((b) => (
              <button
                key={b}
                type="button"
                className={`${s.tab} ${b === activeBuilding ? s.tabOn : ''}`}
                aria-pressed={b === activeBuilding}
                onClick={() => {
                  setBuilding(b);
                  setFloor(null);
                }}
              >
                {tabLabel(b)}
              </button>
            ))}
          </div>
          <div className={s.floors}>
            {floors.map((f, i) => (
              <Fragment key={f}>
                {i > 0 && <span className={s.floorRule}>{'        ㅣ          '}</span>}
                <button
                  type="button"
                  className={`${s.floor} ${f === activeFloor ? s.floorOn : ''}`}
                  aria-pressed={f === activeFloor}
                  onClick={() => setFloor(f)}
                >
                  {f}
                </button>
              </Fragment>
            ))}
          </div>
        </div>

        {kinds.length > 0 && (
          <div className={s.kinds} ref={kindsRef} lang={lang}>
            {kinds.map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`${s.kind} ${k === activeKind ? s.kindOn : ''}`}
                aria-pressed={k === activeKind}
                onClick={() => {
                  setKind(k);
                  setFloor(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className={s.plan}>
          {facilities.length > 0 ? (
            <span>{tcRow('WC_Map_Soon', 'WC_Plan_Slot', lang, { place: placeName(place, controller.kioskId, lang) })}</span>
          ) : (
            <>
              <span>{tc('WC_Preparing', lang)}</span>
              <small>
                {deskShop
                  ? tc('WC_AskDesk', lang, {
                      place: `${shopName(deskShop, lang)} ${shopFloor(deskShop)}${deskShop.tel ? ` · ${deskShop.tel}` : ''}`,
                    })
                  : tc('WC_AskStaff', lang)}
              </small>
            </>
          )}
        </div>
      </div>
    </LottePageFrame>
  );
}
