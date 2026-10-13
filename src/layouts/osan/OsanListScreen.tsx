import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import { useLang } from '@renderer/lib/i18n';
import { ui } from '@renderer/lib/uiText';
import {
  shopAddress,
  shopDescription,
  shopImages,
  shopName,
  shopSecondCategory,
  shopsForBase,
  padImages,
  stripPrefix,
} from '@renderer/lib/shops';
import type { KioskScreenId } from '@shared/types/kiosk';
import { useFitText } from '@layouts/components/fitText';
import { OsanHeader } from './OsanHeader';
import { OsanLeftNav } from './OsanLeftNav';
import { osanShopDetail } from './osanShopDetail';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import styles from './OsanListScreen.module.css';

/** Osan screen → witteria API `baseCategoryKr` (exact match, kioskId=4 data). */
const OSAN_BASE_CATEGORY: Partial<Record<KioskScreenId, string>> = {
  eat: '정이 뭐먹지',
  shop: '정이 뭐사지', // 식품
  lodging: '정이 뭐사지2', // 물품
  help: '정이 도와줘',
  restroom: '정이 도와줘', // the 화장실 tile, opened on 화장실
};

/** 7838:115935 — the ㄱ–ㅎ row; a tap keeps the shops whose Korean name starts
    with that consonant (tense ㄲ/ㄸ/ㅃ/ㅆ/ㅉ count as their plain letter). */
const INITIALS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const PLAIN: Record<string, string> = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' };

/** First consonant of a name's first Hangul syllable ('' for "CU", "1층…"). */
function initialOf(name: string): string {
  const code = name.trim().charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return '';
  const c = CHOSEONG[Math.floor(code / 588)]!;
  return PLAIN[c] ?? c;
}

/** One card (390) + the 60 gap — what ▲/▼ move the list by. */
const CARD_PITCH = 450;

interface OsanListScreenProps {
  title: string;
  controller: KioskController;
  /** The ㄱ–ㅎ row — 도와줘 '정이' (7865:47290) draws none. */
  initials?: boolean;
  /** Category to open on, by its bare name (e.g. 화장실 from the restroom tile). */
  initialTab?: string;
}

/**
 * Reusable list screen for '정이' 뭐먹지 / 뭐사지(식품) / 뭐사지(물품) — Figma
 * 오산>정이 뭐먹지-01 (7838:115928) — and 도와줘 '정이' (7865:47290), the same
 * list without the ㄱ–ㅎ row. Category tabs and the ㄱ–ㅎ row stay put;
 * the shop cards scroll in the window under them (▲/▼ + the edge pill).
 * Tapping a card navigates to 상세.
 */
export function OsanListScreen({
  title,
  controller,
  initials: showInitials = true,
  initialTab,
}: OsanListScreenProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLang();
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const [selected, setSelected] = useState('');
  const [initial, setInitial] = useState('');

  const baseKr = OSAN_BASE_CATEGORY[controller.screen] ?? '';
  const baseShops = useMemo(() => shopsForBase(shops, baseKr), [shops, baseKr]);

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

  const initialKr = initialTab ? tabs.find((t) => stripPrefix(t.kr) === initialTab)?.kr : undefined;
  const activeKr = selected || initialKr || tabs[0]?.kr || '';

  /* Korean category names fit the 340px tab on one line; the other languages run
     to "Товары для художников". There the label wraps and the row shrinks
     together if it still overflows — see "Other languages" in the CSS. */
  const wide = lang !== 'ko';
  const tabsRef = useRef<HTMLDivElement>(null);
  useFitText(tabsRef, styles.tab, wide, 0.72, tabs.map((x) => x.label).join('|'));

  useEffect(() => {
    // The 화장실 tile opens this list but must keep the customer display on the
    // 'restroom' clip navigate() already set; only the real screens advance it.
    if (controller.screen === 'restroom') return;
    if (activeKr) void window.api.kiosk.setScreen(`${controller.screen}_category`);
  }, [activeKr, controller.screen]);

  const visible = useMemo(() => {
    const filtered = baseShops.filter(
      (s) => s.secondCategoryKr === activeKr && (!initial || initialOf(s.shopNameKr) === initial),
    );
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

  /* 7838:116027 — the scroll position as a 34px pill on the artboard's right
     edge; null (and no ▲/▼) when the list fits. */
  const listRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ top: number; size: number } | null>(null);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;
    const sync = (): void => {
      const range = el.scrollHeight - el.clientHeight;
      if (range <= 1) return setThumb(null);
      const size = Math.min(1, el.clientHeight / el.scrollHeight);
      setThumb({ size, top: (el.scrollTop / range) * (1 - size) });
    };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', sync);
      ro.disconnect();
    };
  }, [visible]);
  const scrollBy = (dy: number): void => listRef.current?.scrollBy({ top: dy, behavior: 'smooth' });
  const arrow = osanIconUrl('scroll-arrow');

  const pickTab = (kr: string): void => {
    setSelected(kr);
    listRef.current?.scrollTo({ top: 0 });
  };
  const pickInitial = (c: string): void => {
    setInitial((cur) => (cur === c ? '' : c));
    listRef.current?.scrollTo({ top: 0 });
  };

  const noImg = osanIconUrl('noimage');
  /* ♿ B오산>정이 뭐먹지-01 (7887:49244): the page keeps OsanKiosk's shift, but the
     category tabs and ㄱ–ㅎ drop under the list, to the foot of the screen. */
  const low = useAccessibilityStore((s) => s.lowReach);

  const openDetail = (shop: (typeof shops)[number]): void => {
    setDetail(osanShopDetail(shop, lang, controller.screen, title, noImg));
    controller.navigate('detail', `${title} 상세`);
  };

  return (
    <div
      className={low ? `${styles.lowList} ${tabs.length > 5 ? styles.lowListRows : ''}` : undefined}
      style={{ display: 'contents' }}
    >
      {osanIconUrl('page-bg') && (
        <img className={styles.bg} src={osanIconUrl('page-bg')} alt="" draggable={false} />
      )}

      <OsanHeader title={title} onHome={goHome} />

      <div className={styles.results}>
        <div ref={tabsRef} className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.kr}
              type="button"
              className={`${styles.tab} ${wide ? styles.tabLong : ''} ${tab.kr === activeKr ? styles.tabSelected : ''}`}
              onClick={() => pickTab(tab.kr)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {showInitials && (
        <p className={styles.initials}>
          {INITIALS.map((c, i) => (
            <Fragment key={c}>
              <button
                type="button"
                className={`${styles.initial} ${c === initial ? styles.initialSelected : ''}`}
                onClick={() => pickInitial(c)}
              >
                {c}
              </button>
              {i < INITIALS.length - 1 && ' '}
            </Fragment>
          ))}
        </p>
        )}

        <div ref={listRef} className={styles.list}>
          <div className={styles.cards}>
            {visible.map((shop) => (
              <button
                type="button"
                key={shop.id}
                className={styles.card}
                onClick={() => openDetail(shop)}
              >
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
                  {padImages(shopImages(shop), noImg, 2).map((src, j) => (
                    <div key={j} className={styles.thumb}>
                      <img src={src} alt="" draggable={false} loading="lazy" />
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
          {visible.length === 0 && initial && <p className={styles.empty}>{ui('noShopsForInitial', lang)}</p>}
        </div>
      </div>

      {thumb && (
        <>
          <div className={styles.track} aria-hidden>
            <span
              className={styles.trackThumb}
              style={{ top: `${thumb.top * 100}%`, height: `${thumb.size * 100}%` }}
            />
          </div>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollUp}`}
            onClick={() => scrollBy(-CARD_PITCH)}
            aria-label="위로"
          >
            {arrow && <img src={arrow} alt="" className={styles.scrollBtnImg} draggable={false} />}
          </button>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollDown}`}
            onClick={() => scrollBy(CARD_PITCH)}
            aria-label="아래로"
          >
            {arrow && <img src={arrow} alt="" className={styles.scrollBtnImg} draggable={false} />}
          </button>
        </>
      )}

      <OsanLeftNav onHome={goHome} />
    </div>
  );
}
