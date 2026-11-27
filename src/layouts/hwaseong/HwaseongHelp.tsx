/**
 * 도와줘 '휴' — Figma 7956:75860 (list) and 7956:75640 (상세, drawn by
 * HwaseongDetail). The frames are the 오산 list frame (named 오산>정이 뭐먹지-01)
 * in 화성 main 1, so the page renders with HwaseongListScreen.module.css:
 *
 *   700   two rows of five 340×170 facility tabs, 35 apart
 *   1125  the list window — 1820×390 cards, 50 apart: name · category, 위치,
 *         phone, and one 382×213 photo on the right
 *
 * No ㄱ–ㅎ row and no banner. The facilities are the witteria shops under base
 * "휴 도와줘"; the API gives them no second category, so each is bucketed into
 * a tab by its Korean name.
 */
import { useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { Shop } from '@shared/types/shop';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useDetailStore } from '@renderer/store/detailStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useShopStore } from '@renderer/store/shopStore';
import { facilityLabel, useLang } from '@renderer/lib/i18n';
import { useFitText } from '@layouts/components/fitText';
import {
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopsForBase,
} from '@renderer/lib/shops';
import { HwaseongHeader } from './HwaseongHeader';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import { HwaseongPageBg } from './HwaseongPageBg';
import { ListScrollControls, useListScroll } from './HwaseongListParts';
import styles from './HwaseongListScreen.module.css';
import help from './HwaseongHelp.module.css';

/** witteria API base category for the 도와줘 '휴' facility finder (kioskId=5). */
const BASE_CATEGORY = '휴 도와줘';

/** The frame's facility tabs, two rows of five. 상인회 = "all". */
const TABS = ['상인회', '편의점', '병원', '약국', '은행', '환전소', '종교', '화장실', '흡연실', '기타'];
const ALL_TAB = '상인회';

/** Map a facility's Korean name to its tab. */
function facilityCategory(nameKr: string): string {
  if (nameKr.includes('화장실')) return '화장실';
  if (nameKr.includes('편의점')) return '편의점';
  if (nameKr.includes('흡연')) return '흡연실';
  if (nameKr.includes('약국')) return '약국';
  if (nameKr.includes('병원') || nameKr.includes('의원')) return '병원';
  if (nameKr.includes('은행') || nameKr.includes('ATM')) return '은행';
  if (nameKr.includes('환전')) return '환전소';
  if (nameKr.includes('교회') || nameKr.includes('성당') || nameKr.includes('사찰')) return '종교';
  return '기타';
}

interface Props {
  controller: KioskController;
  /** When '화장실', open filtered to the restrooms (화장실 tile). */
  defaultTab?: string;
}

export function HwaseongHelp({ controller, defaultTab }: Props): JSX.Element {
  const lang = useLang();
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const [activeTab, setActiveTab] = useState(defaultTab ?? ALL_TAB);
  const goHome = (): void => controller.navigate('home', 'Back');
  /* ♿ (7956:77417): the list comes first (846 → 3036) and the two tab rows drop
     to the foot (3213 → 3588); there is no ㄱ–ㅎ row under them. */
  const low = useAccessibilityStore((st) => st.lowReach);

  const wide = lang !== 'ko';
  const tabsRef = useRef<HTMLDivElement>(null);
  useFitText(tabsRef, styles.tab, wide, 0.72, TABS.map((c) => facilityLabel(c, lang)).join('|'));

  const baseShops = useMemo(() => shopsForBase(shops, BASE_CATEGORY), [shops]);
  const visible = useMemo(
    () =>
      activeTab === ALL_TAB
        ? baseShops
        : baseShops.filter((s) => facilityCategory(s.shopNameKr) === activeTab),
    [baseShops, activeTab],
  );

  const { listRef, thumb, scrollBy, toTop } = useListScroll(visible);
  const pickTab = (cat: string): void => {
    setActiveTab(cat);
    toTop();
  };

  const noImg = hwaseongIconUrl('noimage');

  function openDetail(shop: Shop): void {
    const imgs = shopImages(shop);
    setDetail({
      from: controller.screen,
      shopId: shop.id,
      title: "도와줘 '휴'",
      name: shopName(shop, lang),
      category: facilityLabel(facilityCategory(shop.shopNameKr), lang),
      photos: imgs.length ? imgs : noImg ? [noImg] : [],
      address: shopAddress(shop, lang),
      hours: shop.openTime ?? '',
      phone: shop.tel ?? '',
      description: shopDescription(shop, lang),
      tags: shopHashtag(shop, lang),
      rating: shop.naverRating != null ? String(shop.naverRating) : '',
      instagram: '',
      blogReviews: shop.naverLink ?? '',
    });
    controller.navigate('detail', `도와줘 '휴' 상세`);
  }

  return (
    <div className={low ? `${styles.root} ${styles.lowList} ${styles.lowNoInitials}` : styles.root}>
      <HwaseongPageBg />

      <HwaseongHeader controller={controller} title="도와줘 '휴'" onHome={goHome} />

      <div className={styles.results}>
        <div ref={tabsRef} className={`${styles.tabs} ${styles.tabsTwoRows}`}>
          {TABS.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`${styles.tab} ${wide ? styles.tabLong : ''} ${cat === activeTab ? styles.tabSelected : ''}`}
              onClick={() => pickTab(cat)}
            >
              {facilityLabel(cat, lang)}
            </button>
          ))}
        </div>

        <div ref={listRef} className={styles.list}>
          <div className={`${styles.cards} ${help.cards}`}>
            {visible.map((shop) => {
              const photo = shopImages(shop)[0] ?? noImg;
              return (
                <button type="button" key={shop.id} className={styles.card} onClick={() => openDetail(shop)}>
                  <div className={styles.info}>
                    <div className={styles.nameRow}>
                      <span className={styles.name}>{shopName(shop, lang)}</span>
                      <span className={`${styles.cat} ${wide ? styles.catLong : ''}`}>
                        <span className={styles.dot} />
                        {facilityLabel(facilityCategory(shop.shopNameKr), lang)}
                      </span>
                    </div>
                    <p className={styles.address}>{shopAddress(shop, lang)}</p>
                    <p className={styles.address}>{shop.tel ?? ''}</p>
                  </div>
                  <div className={help.photo}>
                    {photo && <img src={photo} alt="" draggable={false} loading="lazy" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ListScrollControls thumb={thumb} scrollBy={scrollBy} />

      <HwaseongLeftNav onHome={goHome} />
    </div>
  );
}
