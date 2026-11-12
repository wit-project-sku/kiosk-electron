/**
 * 화장실 (Figma 화장실-목록-W011~W013): building tabs, floors and the floor plan. 롯데월드몰 publishes its
 * restrooms floor by floor; the department stores' official pages do not, so those two point to the
 * information desk instead of guessing a location. The plans themselves are not settled yet.
 */
import { useMemo, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { Shop } from '@shared/types/shop';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useShopStore } from '@renderer/store/shopStore';
import { shopName } from '@renderer/lib/shops';
import { LottePageFrame } from './LottePageFrame';
import { floorRank, lotteSite, shopFloor } from './lotteSample';
import c from './lotteContent.module.css';

const isRestroom = (second: string | null): boolean => !!second && second.endsWith('화장실');
const desk = /고객상담|안내/;

export function LotteRestroom({ controller }: { controller: KioskController }): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const shops = useShopStore((s) => s.shops);
  const en = lang !== 'ko';
  const site = lotteSite(controller.kioskId);
  const buildingOf = (s: Shop): string =>
    s.addressKr.includes('에비뉴엘')
      ? '에비뉴엘'
      : s.addressKr.includes('타워')
        ? '타워'
        : site.branch;

  const rooms = useMemo(() => shops.filter((s) => isRestroom(s.secondCategoryKr)), [shops]);
  const buildings = useMemo(() => {
    const names = [...new Set(rooms.map(buildingOf))];
    return names.length > 0 ? names.sort((a) => (a === site.branch ? -1 : 0)) : [site.branch];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, site.branch]);
  const [building, setBuilding] = useState<string | null>(null);
  const activeBuilding = building ?? buildings[0]!;
  const inBuilding = rooms.filter((s) => buildingOf(s) === activeBuilding);
  const floors = [...new Set(inBuilding.map(shopFloor))].sort(
    (a, b) => floorRank(a) - floorRank(b),
  );
  const [floor, setFloor] = useState<string | null>(null);
  const activeFloor = floor && floors.includes(floor) ? floor : (floors[0] ?? null);
  const names = inBuilding
    .filter((s) => shopFloor(s) === activeFloor)
    .map((s) => shopName(s, lang));
  const deskShop = useMemo(() => shops.find((s) => desk.test(s.shopNameKr)), [shops]);

  return (
    <LottePageFrame
      controller={controller}
      title={en ? 'Restroom' : '화장실'}
      subtitle={en ? 'Restrooms by floor.' : '층별 화장실을 확인하세요'}
      showBanner={false}
    >
      <div className={`${c.body} ${c.bodyFull}`}>
        <div className={c.wcTabs}>
          {buildings.map((b) => (
            <button
              key={b}
              type="button"
              className={`${c.wcTab} ${b === activeBuilding ? c.wcTabOn : ''}`}
              onClick={() => setBuilding(b)}
            >
              {b}
            </button>
          ))}
        </div>
        {floors.length > 0 && (
          <div className={c.wcFloors}>
            {floors.map((f) => (
              <button
                key={f}
                type="button"
                className={`${c.wcFloor} ${f === activeFloor ? c.wcFloorOn : ''}`}
                onClick={() => setFloor(f)}
              >
                {f}
              </button>
            ))}
          </div>
        )}
        {names.length > 0 && (
          <div className={c.wcNames}>
            {names.map((n, i) => (
              <span key={`${n}${i}`} className={c.tag}>
                {n}
              </span>
            ))}
          </div>
        )}
        <div className={c.wcPlate}>
          {rooms.length > 0 ? (
            `${activeBuilding} ${activeFloor ?? ''} 도면 자리`
          ) : (
            <>
              {en ? 'Restroom locations are being prepared.' : '층별 화장실 위치를 준비 중입니다'}
              <small>
                {deskShop
                  ? `${shopName(deskShop, lang)} ${shopFloor(deskShop)}${deskShop.tel ? ` · ${deskShop.tel}` : ''}에 문의해 주세요`
                  : '가까운 직원에게 문의해 주세요'}
              </small>
            </>
          )}
        </div>
      </div>
    </LottePageFrame>
  );
}
