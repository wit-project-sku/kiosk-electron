/**
 * 여기는 롯데 — the 여기는 제주도 page: tabs over photo cards. Names and places come from the collected
 * list; introductions and photos are slots until the content arrives, and a tab with no content
 * says so instead of showing made-up places.
 */
import { useMemo, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useDetailStore } from '@renderer/store/detailStore';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { LottePageFrame } from './LottePageFrame';
import { LotteTabRow } from './LotteTabRow';
import { lotteAbout, type AboutItem, type AboutTab } from './lotteSample';
import c from './lotteContent.module.css';

const TITLE = '여기는 롯데';
const TABS: ReadonlyArray<{ id: AboutTab; label: string }> = [
  { id: 'facility', label: '시설 소개' },
  { id: 'sights', label: '볼거리' },
  { id: 'nearby', label: '주변 명소' },
];

export function LotteAbout({ controller }: { controller: KioskController }): JSX.Element {
  const [tab, setTab] = useState<AboutTab>('facility');
  const setDetail = useDetailStore((s) => s.setItem);
  const items = useMemo(
    () => lotteAbout(controller.kioskId).filter((a) => a.tab === tab),
    [controller.kioskId, tab],
  );
  const venue = getKioskLocation(controller.kioskId).name;
  const open = (a: AboutItem): void => {
    setDetail({
      from: 'about',
      title: TITLE,
      name: a.name,
      category: TABS.find((t) => t.id === tab)?.label ?? '',
      photos: [],
      address: a.place,
      hours: '',
      phone: '',
      description: '',
      tags: '',
      rating: '',
      instagram: '',
      blogReviews: '',
    });
    controller.navigate('detail', TITLE);
  };
  return (
    <LottePageFrame
      controller={controller}
      title={TITLE}
      subtitle="이곳의 시설과 볼거리를 소개합니다"
      showBanner={false}
    >
      <LotteTabRow tabs={TABS} value={tab} onChange={setTab} />
      <div className={`${c.body} ${c.bodyBelowTabs}`}>
        <div className={c.mapHold}>{venue} 지도 자리</div>
        <div className={c.scroll}>
          {items.length > 0 ? (
            <div className={c.grid3}>
              {items.map((a) => (
                <button key={a.name} type="button" className={c.card} onClick={() => open(a)}>
                  <span className={`${c.cardThumb} ${c.cardThumbSmall}`}>사진 자리</span>
                  <span className={c.cardBody}>
                    <span className={c.cardName}>{a.name}</span>
                    <span className={c.placeTag}>{a.place}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className={c.empty}>
              콘텐츠 준비 중입니다
              <small>{TABS.find((t) => t.id === tab)?.label} 정보를 받으면 이곳에 표시합니다</small>
            </div>
          )}
        </div>
      </div>
    </LottePageFrame>
  );
}
