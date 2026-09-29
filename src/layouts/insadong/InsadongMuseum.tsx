import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useDetailStore } from '@renderer/store/detailStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useShopStore } from '@renderer/store/shopStore';
import { catLabel, useLang } from '@renderer/lib/i18n';
import { useFitText } from '@layouts/components/fitText';
import {
  padImages,
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopSecondCategory,
  shopsForBase,
  stripPrefix,
} from '@renderer/lib/shops';
import { InsadongHeader } from './InsadongHeader';
import { InsadongLeftNav } from './InsadongLeftNav';
import list from './InsadongListScreen.module.css';
import styles from './InsadongMuseum.module.css';

const BASE_CATEGORY = '인사동 미술관';
/** Sheet key id. The header resolves it to MainButton_ToGallery ("인사동 미술관"). */
const HEADER_TITLE = '인사 미술관';

/** Figma 7550:5786 — five on the first row, 기타 alone on the second. */
const CATEGORY_IDS = ['고미술', '화랑', '표구', '전시관', '역사유적지', '기타'] as const;

const INITIALS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'] as const;
const CHOSEONG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const CHOSEONG_FOLD: Record<string, string> = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' };
const SCROLL_STEP = 450;

function shopInitial(name: string): string {
  const code = name.trim().charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return '';
  const cho = CHOSEONG[Math.floor((code - 0xac00) / 588)] ?? '';
  return CHOSEONG_FOLD[cho] ?? cho;
}

/** Shop rows are numbered ("1-고미술") and sometimes longer than the tab
 *  ("표구·액자"). Fold those onto the frame's tab; anything else stays its own tab. */
function tabIdOf(secondKr: string): string {
  const bare = stripPrefix(secondKr);
  const hit = CATEGORY_IDS.find((id) => id !== '기타' && (bare === id || bare.startsWith(id)));
  if (hit) return hit;
  return bare;
}

interface InsadongMuseumProps {
  controller: KioskController;
  debug?: boolean;
}

/** 인사동 미술관 — category list (7550:5682). Cards open the shared 상세 (7552:5877). */
export function InsadongMuseum({ controller }: InsadongMuseumProps): JSX.Element {
  const lang = useLang();
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const wide = lang !== 'ko';
  const goHome = (): void => controller.navigate('home', 'Back');
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const tabsRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string>(CATEGORY_IDS[0]);
  const [initial, setInitial] = useState('');

  const baseShops = useMemo(() => shopsForBase(shops, BASE_CATEGORY), [shops]);

  const catLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of baseShops) {
      const id = tabIdOf(s.secondCategoryKr ?? '');
      if (id && !map.has(id)) map.set(id, shopSecondCategory(s, lang));
    }
    return map;
  }, [baseShops, lang]);

  const tabIds = useMemo(() => {
    const extra = [...catLabels.keys()].filter(
      (id) => id && !(CATEGORY_IDS as readonly string[]).includes(id),
    );
    return [...CATEGORY_IDS, ...extra];
  }, [catLabels]);

  const labelOf = (id: string): string => catLabels.get(id) || catLabel(id, lang);

  const visible = useMemo(() => {
    const filtered = baseShops.filter((s) => {
      if (tabIdOf(s.secondCategoryKr ?? '') !== active) return false;
      if (initial && shopInitial(s.shopNameKr ?? '') !== initial) return false;
      return true;
    });
    return [...filtered].sort(
      (a, b) => (shopImages(b).length > 0 ? 1 : 0) - (shopImages(a).length > 0 ? 1 : 0),
    );
  }, [baseShops, active, initial]);

  useEffect(() => {
    void window.api.kiosk.setScreen('museum_category');
  }, [active]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [active, initial]);

  useFitText(tabsRef, list.tab, wide, 0.72, tabIds.map((id) => labelOf(id)).join('|'));

  const noImg = iconUrl('noimage');
  const withFallback = (urls: string[]): string[] => (urls.length > 0 ? urls : noImg ? [noImg] : []);

  const openDetail = (shop: (typeof shops)[number]): void => {
    setDetail({
      from: controller.screen,
      shopId: shop.id,
      title: HEADER_TITLE,
      name: shopName(shop, lang),
      category: shopSecondCategory(shop, lang),
      photos: withFallback(shopImages(shop)),
      address: shopAddress(shop, lang),
      hours: shop.openTime ?? '',
      phone: shop.tel ?? '',
      description: shopDescription(shop, lang),
      tags: shopHashtag(shop, lang),
      rating: shop.naverRating != null ? String(shop.naverRating) : '',
      instagram: '',
      blogReviews: shop.naverLink ?? '',
      route: shop.route ?? null,
    });
    controller.navigate('detail', '인사 미술관 상세');
  };

  return (
    <>
      {iconUrl('bg') && <img className={list.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title={HEADER_TITLE} onHome={goHome} />

      <div className={lowReach ? `${list.results} ${list.resultsLow}` : list.results}>
        <div ref={tabsRef} className={list.tabs}>
          {tabIds.map((id) => (
            <button
              key={id}
              type="button"
              className={`${list.tab} ${wide ? list.tabLong : ''} ${active === id ? list.tabSelected : ''}`}
              onClick={() => {
                setActive(id);
                setInitial('');
              }}
            >
              {labelOf(id)}
            </button>
          ))}
        </div>

        <div className={styles.initials}>
          {INITIALS.map((letter) => (
            <button
              key={letter}
              type="button"
              className={`${styles.initial} ${letter === initial ? styles.initialOn : ''}`}
              onClick={() => setInitial((cur) => (cur === letter ? '' : letter))}
            >
              {letter}
            </button>
          ))}
        </div>

        <div ref={listRef} className={list.listScroll}>
          <div className={list.list}>
            {visible.map((shop) => {
              const imgs = padImages(shopImages(shop), noImg, 2);
              return (
                <button type="button" key={shop.id} className={list.card} onClick={() => openDetail(shop)}>
                  <div className={list.info}>
                    <div className={list.nameRow}>
                      <span className={list.name}>{shopName(shop, lang)}</span>
                      <span className={`${list.cat} ${wide ? list.catLong : ''}`}>
                        <span className={list.dot} />
                        {shopSecondCategory(shop, lang)}
                      </span>
                    </div>
                    <p className={list.address}>{shopAddress(shop, lang)}</p>
                    <p className={list.desc}>{shopDescription(shop, lang)}</p>
                  </div>
                  <div className={list.photos}>
                    {imgs.map((src, j) => (
                      <div key={j} className={list.thumb}>
                        <img src={src} alt="" draggable={false} loading="lazy" />
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {visible.length > 0 && (
        <>
          <button
            type="button"
            className={`${list.scrollBtn} ${list.scrollUp}`}
            onClick={() => listRef.current?.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' })}
            aria-label="위로"
          >
            {iconUrl('scroll-arrow') && (
              <img src={iconUrl('scroll-arrow')} alt="" className={list.scrollBtnImg} draggable={false} />
            )}
          </button>
          <button
            type="button"
            className={`${list.scrollBtn} ${list.scrollDown}`}
            onClick={() => listRef.current?.scrollBy({ top: SCROLL_STEP, behavior: 'smooth' })}
            aria-label="아래로"
          >
            {iconUrl('scroll-arrow') && (
              <img src={iconUrl('scroll-arrow')} alt="" className={list.scrollBtnImg} draggable={false} />
            )}
          </button>
        </>
      )}

      <InsadongLeftNav onHome={goHome} />
    </>
  );
}
