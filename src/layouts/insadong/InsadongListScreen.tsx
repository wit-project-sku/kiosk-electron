import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useDetailStore } from '@renderer/store/detailStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useShopStore } from '@renderer/store/shopStore';
import { useLang } from '@renderer/lib/i18n';
import {
  SCREEN_BASE_CATEGORY,
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopSecondCategory,
  shopsForBase,
  padImages,
} from '@renderer/lib/shops';
import { useFitText } from '@layouts/components/fitText';
import { InsadongHeader } from './InsadongHeader';
import { InsadongLeftNav } from './InsadongLeftNav';
import styles from './InsadongListScreen.module.css';

interface InsadongListScreenProps {
  /** Header title (Korean id; localized by the header). */
  title: string;
  controller: KioskController;
}

/** Korean initial-consonant index (Figma 7525:77716). Doubled initials fold
 *  onto the single letter the row actually draws (ㄲ→ㄱ, ㄸ→ㄷ, …). */
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

/**
 * Reusable list screen (category pills + result cards) for 뭐먹지 / 뭐사지 / 숙박.
 * Data comes from the witteria shops API (cached), filtered by the screen's base
 * category and the selected second-category tab.
 */
export function InsadongListScreen({ title, controller }: InsadongListScreenProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLang();
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const [selected, setSelected] = useState('');
  const [initial, setInitial] = useState('');

  /* 초성 index is Korean-only: an alphabet index only works for the alphabet
     the names are written in, and every card shows its name in the visitor's
     own language. Same call InsadongAbout and JejuAbout already make.
     숙박안내 drops the index entirely. */
  const showInitials = lang === 'ko' && controller.screen !== 'lodging';

  /* Leaving Korean must also drop an ACTIVE filter, not just the control.
     Otherwise a visitor who taps ㅅ and then switches to English is left on a
     narrowed list with no visible reason and no way to clear it. */
  useEffect(() => {
    if (!showInitials && initial !== '') setInitial('');
  }, [showInitials, initial]);

  const listRef = useRef<HTMLDivElement>(null);

  const baseKr = SCREEN_BASE_CATEGORY[controller.screen] ?? '';
  const baseShops = useMemo(() => shopsForBase(shops, baseKr), [shops, baseKr]);

  // Tabs derived from the shops' second categories (localized labels).
  const tabs = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of baseShops) {
      const kr = s.secondCategoryKr;
      if (kr && !map.has(kr)) map.set(kr, shopSecondCategory(s, lang));
    }
    return [...map.entries()]
      .map(([kr, label]) => ({ kr, label }))
      .sort((a, b) => (parseInt(a.kr, 10) || 999) - (parseInt(b.kr, 10) || 999));
  }, [baseShops, lang]);

  const activeKr = selected || tabs[0]?.kr || '';

  useEffect(() => {
    if (activeKr) void window.api.kiosk.setScreen(`${controller.screen}_category`);
  }, [activeKr, controller.screen]);

  const visible = useMemo(() => {
    const filtered = baseShops.filter((s) => {
      if (s.secondCategoryKr !== activeKr) return false;
      if (initial && shopInitial(s.shopNameKr ?? '') !== initial) return false;
      return true;
    });
    // Show in random order, but float shops that HAVE photos to the top.
    // Fisher–Yates shuffle, then a stable sort by "has images" keeps the
    // random order within both the with-images and no-image groups.
    const shuffled = [...filtered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled.sort(
      (a, b) => (shopImages(b).length > 0 ? 1 : 0) - (shopImages(a).length > 0 ? 1 : 0),
    );
  }, [baseShops, activeKr, initial]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [activeKr, initial]);

  const noImg = iconUrl('noimage');
  const withFallback = (urls: string[]): string[] => (urls.length > 0 ? urls : noImg ? [noImg] : []);

  const openDetail = (shop: (typeof shops)[number]): void => {
    setDetail({
      from: controller.screen,
      shopId: shop.id,
      title,
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
      /* Drives the 거리 + 도보 pair the 인사동 리뉴얼 상세 draws (7516:74320 /
         74334). The other three 상세 entry points (검색 / 도와줘 / 박물관) already
         pass it; this screen dropped it, so 뭐먹지 / 뭐사지 / 숙박 rows carrying a
         route showed no distance at all. */
      route: shop.route ?? null,
    });
    controller.navigate('detail', `${title} 상세`);
  };

  const fewTabs = tabs.length <= 5;

  /* Korean category names are 2–3 glyphs and fit the 340px tab on one line; the
     other languages run to "Товары для художников". In those, the tab label
     wraps and the row shrinks together if it still overflows — see the
     "Other languages" block in the CSS. */
  const wide = lang !== 'ko';
  const tabsRef = useRef<HTMLDivElement>(null);
  useFitText(tabsRef, styles.tab, wide, 0.72, tabs.map((x) => x.label).join('|'));

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title={title} onHome={goHome} />

      <div className={lowReach ? `${styles.results} ${styles.resultsLow}` : styles.results}>
        <div ref={tabsRef} className={fewTabs ? `${styles.tabs} ${styles.tabsRow}` : styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.kr}
              type="button"
              className={`${styles.tab} ${wide ? styles.tabLong : ''} ${fewTabs ? styles.tabWide : ''} ${tab.kr === activeKr ? styles.tabSelected : ''}`}
              onClick={() => {
                setSelected(tab.kr);
                setInitial('');
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {showInitials && (
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
        )}

        <div ref={listRef} className={styles.listScroll}>
          <div className={styles.list}>
            {visible.map((shop) => {
              const imgs = padImages(shopImages(shop), noImg, 2);
              return (
                <button type="button" key={shop.id} className={styles.card} onClick={() => openDetail(shop)}>
                  <div className={styles.info}>
                    <div className={styles.nameRow}>
                      <span className={styles.name}>{shopName(shop, lang)}</span>
                      <span className={`${styles.cat} ${wide ? styles.catLong : ''}`}>
                        <span className={styles.dot} />
                        {shopSecondCategory(shop, lang)}
                      </span>
                    </div>
                    <p className={styles.address}>{shopAddress(shop, lang)}</p>
                    <p className={styles.desc}>{shopDescription(shop, lang)}</p>
                  </div>
                  <div className={styles.photos}>
                    {imgs.map((src, j) => (
                      <div key={j} className={styles.thumb}>
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
            className={`${styles.scrollBtn} ${styles.scrollUp}`}
            onClick={() => listRef.current?.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' })}
            aria-label="위로"
          >
            {iconUrl('scroll-arrow') && (
              <img src={iconUrl('scroll-arrow')} alt="" className={styles.scrollBtnImg} draggable={false} />
            )}
          </button>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollDown}`}
            onClick={() => listRef.current?.scrollBy({ top: SCROLL_STEP, behavior: 'smooth' })}
            aria-label="아래로"
          >
            {iconUrl('scroll-arrow') && (
              <img src={iconUrl('scroll-arrow')} alt="" className={styles.scrollBtnImg} draggable={false} />
            )}
          </button>
        </>
      )}

      <InsadongLeftNav onHome={goHome} />

    </>
  );
}
