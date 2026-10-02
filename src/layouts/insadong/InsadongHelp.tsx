import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useDetailStore } from '@renderer/store/detailStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useShopStore } from '@renderer/store/shopStore';
import { facilityLabel, useLang } from '@renderer/lib/i18n';
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
import styles from './InsadongHelp.module.css';

const BASE_CATEGORY = '인사 도와줘';
const HEADER_TITLE = "도와줘 '인사'";

/** Fixed Figma tabs (7567:63383), 2×5. The Korean string is the id: it matches
 *  the shop secondCategory's bare name and the restroom deep-link. */
const CATEGORY_IDS = [
  '안내소', '편의점', '병원', '약국', '은행',
  '환전소', '종교', '화장실', '흡연실', '기타',
] as const;

/** The frame draws this tab as 흡연장소. Shop rows still say 흡연실, so the
 *  filter accepts either and the Korean tab shows the frame's word when the
 *  sheet has no label of its own. */
const TAB_LABEL_KO: Partial<Record<(typeof CATEGORY_IDS)[number], string>> = {
  흡연실: '흡연장소',
};

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

function tabIdOf(secondKr: string): string {
  const bare = stripPrefix(secondKr);
  if (bare.includes('흡연')) return '흡연실';
  return bare;
}

interface InsadongHelpProps {
  controller: KioskController;
  debug?: boolean;
  /** Category to open on first render (e.g. 화장실 when arriving from the home tile). */
  initialTab?: string;
}

/** 도와줘 '인사' — facility list (7567:63279). Cards open the shared 상세 (7567:63384). */
export function InsadongHelp({ controller, initialTab }: InsadongHelpProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLang();
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const wide = lang !== 'ko';
  const catsRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const [active, setActive] = useState(
    initialTab && (CATEGORY_IDS as readonly string[]).includes(initialTab) ? initialTab : '안내소',
  );
  const [initial, setInitial] = useState('');

  /* 초성 index is Korean-only: an alphabet index only works for the alphabet
     the names are written in, and every card shows its name in the visitor's
     own language. Same call InsadongAbout and JejuAbout already make. */
  const showInitials = lang === 'ko';

  /* Leaving Korean must also drop an ACTIVE filter, not just the control.
     Otherwise a visitor who taps ㅅ and then switches to English is left on a
     narrowed list with no visible reason and no way to clear it. */
  useEffect(() => {
    if (!showInitials && initial !== '') setInitial('');
  }, [showInitials, initial]);


  const baseShops = useMemo(() => shopsForBase(shops, BASE_CATEGORY), [shops]);

  const catLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of baseShops) {
      const id = tabIdOf(s.secondCategoryKr ?? '');
      if (id && !map.has(id)) map.set(id, shopSecondCategory(s, lang));
    }
    return map;
  }, [baseShops, lang]);

  const labelOf = (id: (typeof CATEGORY_IDS)[number]): string =>
    catLabels.get(id) || (lang === 'ko' ? TAB_LABEL_KO[id] : undefined) || facilityLabel(id, lang);

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
    void window.api.kiosk.setScreen('help_category');
  }, [active]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [active, initial]);

  useFitText(catsRef, list.tab, wide, 0.72, CATEGORY_IDS.map((id) => labelOf(id)).join('|'));

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
    controller.navigate('detail', '도와줘 인사 상세');
  };

  return (
    <>
      {iconUrl('bg') && <img className={list.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title={HEADER_TITLE} onHome={goHome} />

      <div className={lowReach ? `${list.results} ${list.resultsLow}` : list.results}>
        <div ref={catsRef} className={list.tabs}>
          {CATEGORY_IDS.map((id) => (
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
