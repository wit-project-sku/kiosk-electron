/**
 * Shared 전국시장 / 전국 휴게소 list — Figma 7956:62204 (전국시장; the 오산 list
 * frame with region tabs, in [화성휴게소] main 1 #005AB4). Nationwide markets
 * from the bundled sheet, grouped by region tab, then the ㄱ–ㅎ row and the
 * cards in a scrolling window. Renders with HwaseongListScreen.module.css.
 */
import { useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useDetailStore } from '@renderer/store/detailStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { provinceLabel, useLang } from '@renderer/lib/i18n';
import { padImages } from '@renderer/lib/shops';
import { NATIONWIDE_MARKETS, type NationwideMarket } from '@renderer/data/nationwideMarkets.generated';
import { pickText } from '@renderer/data/types';
import { useFitText } from '@layouts/components/fitText';
import { HwaseongHeader } from './HwaseongHeader';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import { HwaseongPageBg } from './HwaseongPageBg';
import { InitialsRow, ListScrollControls, initialOf, useListScroll } from './HwaseongListParts';
import styles from './HwaseongListScreen.module.css';

/** One region tab: the sheet `province.ko` values it holds, and the Korean
 *  label when it differs from the first of them (서울 → 서울시). */
export interface RegionTab {
  provinces: string[];
  ko?: string;
}

interface Props {
  controller: KioskController;
  /** Header title id — also the 상세 page's title (e.g. '전국시장', '전국 휴게소'). */
  title: string;
  tabs: RegionTab[];
  /** The rows to list — 전국시장's markets (default) or 전국휴게소's service areas. */
  data?: readonly NationwideMarket[];
}

export function HwaseongMarketList({ controller, title, tabs, data = NATIONWIDE_MARKETS }: Props): JSX.Element {
  const lang = useLang();
  const setDetail = useDetailStore((s) => s.setItem);
  const [active, setActive] = useState(0);
  const [initial, setInitial] = useState('');

  const tabLabel = (tab: RegionTab): string =>
    lang === 'ko' && tab.ko ? tab.ko : provinceLabel(tab.provinces[0] ?? '', lang);

  /* Korean region names fit the 340px tab; other languages wrap inside it and
     the row shrinks together — "Other languages" in the CSS. */
  const wide = lang !== 'ko';
  const tabsRef = useRef<HTMLDivElement>(null);
  useFitText(tabsRef, styles.tab, wide, 0.72, tabs.map(tabLabel).join('|'));

  const visible = useMemo(() => {
    const provinces = new Set(tabs[active]?.provinces ?? []);
    return data.filter(
      (m) => provinces.has(m.province.ko.trim()) && (!initial || initialOf(m.name.ko ?? '') === initial),
    );
  }, [data, tabs, active, initial]);

  const { listRef, thumb, scrollBy, toTop } = useListScroll(visible);

  const noImg = hwaseongIconUrl('noimage');
  /* ♿ (전국시장 7956:61868): the 뭐사지 list's barrier-free order (.lowList). */
  const low = useAccessibilityStore((st) => st.lowReach);

  const openDetail = (m: NationwideMarket): void => {
    setDetail({
      from: 'market',
      title,
      name: pickText(m.name, lang),
      category: pickText(m.district, lang),
      photos: noImg ? [noImg] : [],
      address: pickText(m.address, lang),
      hours: pickText(m.openTime, lang),
      phone: m.tel,
      description: pickText(m.description, lang),
      tags: pickText(m.hashtag, lang),
      rating: '',
      instagram: '',
      blogReviews: m.naverLink,
    });
    controller.navigate('detail', `${title} 상세`);
  };

  return (
    <div className={low ? `${styles.root} ${styles.lowList}` : styles.root}>
      <HwaseongPageBg />

      <HwaseongHeader controller={controller} title={title} />

      <div className={styles.results}>
        <div ref={tabsRef} className={`${styles.tabs} ${tabs.length > 5 ? styles.tabsTwoRows : ''}`}>
          {tabs.map((tab, i) => (
            <button
              key={tab.provinces.join('|')}
              type="button"
              className={`${styles.tab} ${wide ? styles.tabLong : ''} ${i === active ? styles.tabSelected : ''}`}
              onClick={() => {
                setActive(i);
                toTop();
              }}
            >
              {tabLabel(tab)}
            </button>
          ))}
        </div>

        <InitialsRow
          value={initial}
          onPick={(c) => {
            setInitial((cur) => (cur === c ? '' : c));
            toTop();
          }}
        />

        <div ref={listRef} className={styles.list}>
          <div className={styles.cards}>
            {visible.map((m, i) => {
              const name = pickText(m.name, lang);
              const region = pickText(m.district, lang) || provinceLabel(m.province.ko.trim(), lang);
              return (
                <button type="button" key={`${m.name.ko}-${i}`} className={styles.card} onClick={() => openDetail(m)}>
                  <div className={styles.info}>
                    <div className={styles.nameRow}>
                      <span className={styles.name}>{name}</span>
                      {region && (
                        <span className={`${styles.cat} ${wide ? styles.catLong : ''}`}>
                          <span className={styles.dot} />
                          {region}
                        </span>
                      )}
                    </div>
                    <p className={styles.address}>{pickText(m.address, lang)}</p>
                    <p className={styles.desc}>{pickText(m.description, lang)}</p>
                  </div>
                  {/* The sheet carries no photos — both slots show the placeholder. */}
                  <div className={styles.photos}>
                    {padImages([], noImg, 2).slice(0, 2).map((src, j) => (
                      <div key={j} className={styles.thumb}>
                        {src && <img src={src} alt="" draggable={false} loading="lazy" />}
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ListScrollControls thumb={thumb} scrollBy={scrollBy} />

      <HwaseongLeftNav onHome={() => controller.navigate('home', 'Back')} />
    </div>
  );
}
