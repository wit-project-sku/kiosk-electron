/**
 * 제주공항 (W006) 렌트카 — Figma 6297:76578 / 6297:76391 (제주>하영=렌트카=공항-01).
 *
 * The same screen as JejuListScreen with the second-category chip grid left
 * out: the frame draws the identical 초성 index over the identical
 * `R>리스트-사진4개` card at the identical 590 pitch, so the shared
 * `JejuChosungRow`, `JejuShopCard` and shop→detail path are reused verbatim.
 *
 * ★ 2026-08-24: the free-text search field this screen used to carry is GONE
 * from the design — the redraw indexes the 112 rental companies by the leading
 * consonant of their name instead, exactly like 뭐먹지 / 뭐사지 / 숙박안내. The
 * old node (6217:95726) was deleted from the Figma file rather than edited.
 * That took the on-screen keyboard with it; nothing else about the screen moved.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { Shop } from '@shared/types/shop';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { leadingChosung, type Chosung } from '@renderer/lib/chosung';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import { pick } from '@renderer/lib/i18n';
import {
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopSecondCategory,
  shopsForBase,
} from '@renderer/lib/shops';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { JejuChosungRow } from './JejuChosungRow';
import { JejuPageFrame } from './JejuPageFrame';
import { JejuShopCard } from './JejuShopCard';
import styles from './JejuRentcar.module.css';

interface Props {
  controller: KioskController;
}

/** Header title id — localized by JejuHeader. */
const TITLE = '렌트카';

/**
 * Base category (witteria `baseCategoryKr`).
 *
 * ★ It is the bare '렌트카' — NOT '제주 렌트카'. This screen guessed the prefixed
 * form for as long as the category did not exist, reasoning from 제주's other
 * four (제주 뭐하지 / 제주 뭐먹지 / 제주 뭐사지 / 숙박안내) that it keys on the
 * location prefix. The rows have since been published and they do not: verified
 * 2026-08-14 against `/api/shops?kioskId=7`, stage carries **112 rows under
 * '렌트카'**. Note 숙박안내 is unprefixed too, so the prefix was never the rule.
 *
 * The guess is why this page showed 준비중입니다 with the data sitting in the
 * cache the whole time — `shopsForBase` matched nothing.
 *
 * ── On the API's new `baseCategoryKr` query parameter ─────────────────
 * Deliberately NOT used. Measured on 2026-08-14: passing it changes nothing on
 * either environment — `&baseCategoryKr=렌트카` and `&baseCategoryKr=zzzz` both
 * return the identical full catalogue (422 rows on stage, 310 on prod), so the
 * server is ignoring it, exactly like the outfit endpoint ignores
 * `categoryName`. Even once it works, this screen would gain nothing: the whole
 * catalogue is already cached in SQLite for offline use, so filtering it here is
 * instant and works with the network down, while a per-screen request would be
 * slower and would blank the page on an airport network hiccup.
 *
 * ★ PROD HAS NO 렌트카 ROWS YET (310 rows, four categories) — only stage does.
 * Nothing more is needed on this side when they land: the catalogue refresh
 * already runs on launch and nightly, so the page fills itself. Until then a
 * production kiosk keeps showing 준비중입니다 (NO_DATA), which is correct.
 */
const BASE_CATEGORY = '렌트카';

const NO_DATA = {
  ko: '준비중입니다', en: 'Coming soon', ja: '準備中です', zh: '准备中',
  vi: 'Đang chuẩn bị', th: 'กำลังเตรียมการ', ru: 'Готовится', id: 'Segera hadir',
};

const NO_MATCH = {
  ko: '검색 결과가 없습니다', en: 'No results', ja: '検索結果がありません', zh: '没有搜索结果',
  vi: 'Không có kết quả', th: 'ไม่พบผลลัพธ์', ru: 'Ничего не найдено', id: 'Tidak ada hasil',
};

/**
 * 14 × 124.57 = 1744, this frame's x208–1952 for the ㄱ…ㅎ run (6297:76742).
 * Wider than the 1686 the standard list screens use — and identical to their
 * low-reach frames — because the row is the only thing in this column and is
 * drawn at the full content width.
 */
const CHOSUNG_CELL = 1744 / 14;

/**
 * How far one ▲▼ press moves: exactly one card. 530 card + 60 gap = the same 590
 * pitch JejuListScreen steps by, because both frames draw the same
 * `R>리스트-사진4개` card — so a press lands the next row where the last one was
 * rather than part-way through a card.
 */
const SCROLL_STEP = 590;

export function JejuRentcar({ controller }: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const setDetail = useDetailStore((s) => s.setItem);
  const shops = useShopStore((s) => s.shops);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [jamo, setJamo] = useState<Chosung | null>(null);

  const scrollBy = (delta: number): void =>
    scrollRef.current?.scrollBy({ top: delta, behavior: 'smooth' });

  /**
   * The ▲▼ pair appears only when the list actually overflows.
   *
   * JejuListScreen draws its pair unconditionally, which is fine there — its
   * chip filters always leave a long list. This screen's single 초성 filter
   * routinely narrows 112 rows to one or none, and a round button that visibly
   * does nothing on a kiosk gets pressed repeatedly and reads as a frozen
   * machine. Same rule, and the same reasoning, as JejuAbout.
   *
   * `useLayoutEffect` so the decision is made from the measured DOM in the same
   * frame the list changes in — a `useEffect` shows the buttons for one frame
   * after a filter empties the list.
   */
  const [canScroll, setCanScroll] = useState(false);

  const baseShops = useMemo(() => shopsForBase(shops, BASE_CATEGORY), [shops]);

  const visible = useMemo(() => {
    // The 초성 row indexes the shop NAME, and always the Korean one: the buckets
    // are Korean consonants, so filtering a translated name would empty the list
    // for every non-Korean visitor.
    if (!jamo) return baseShops;
    return baseShops.filter((s) => leadingChosung(shopName(s, 'ko')) === jamo);
  }, [baseShops, jamo]);

  // Re-measure whenever the list length changes (a filter) or the language does
  // (translated names wrap differently, so the same rows can be a different height).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    setCanScroll(!!el && el.scrollHeight > el.clientHeight + 1);
  }, [visible.length, lang]);

  const openDetail = (shop: Shop): void => {
    setDetail({
      from: 'rentcar',
      title: TITLE,
      name: shopName(shop, lang),
      category: shopSecondCategory(shop, lang),
      photos: shopImages(shop),
      address: shopAddress(shop, lang),
      hours: shop.openTime ?? '',
      phone: shop.tel ?? '',
      description: shopDescription(shop, lang),
      tags: shopHashtag(shop, lang),
      rating: shop.naverRating != null ? String(shop.naverRating) : '',
      instagram: '',
      blogReviews: shop.naverLink ?? '',
    });
    controller.navigate('detail', TITLE);
  };

  const chosungRow = (
    <JejuChosungRow
      className={`${styles.chosung} ${lowReach ? styles.chosungLow : ''}`}
      cellWidth={CHOSUNG_CELL}
      value={jamo}
      onChange={(next) => {
        setJamo(next);
        // Re-filtering leaves the view scrolled into rows that no longer exist.
        scrollRef.current?.scrollTo({ top: 0 });
      }}
    />
  );

  return (
    // No banner: the card list runs to the bottom of the artboard in this frame.
    <JejuPageFrame controller={controller} title={TITLE} showBanner={false}>
      {/* The 초성 row scrolls with the cards normally; in low-reach it is pulled
          out of the column and pinned to the foot — see .chosungLow. */}
      {lowReach && chosungRow}

      <div
        className={`${styles.scroll} ${lowReach ? styles.scrollLow : ''}`}
        ref={scrollRef}
      >
        {!lowReach && chosungRow}

        {visible.length > 0 ? (
          <div className={styles.list}>
            {visible.map((shop) => (
              <JejuShopCard
                key={shop.id}
                shop={shop}
                lang={lang}
                onClick={() => openDetail(shop)}
              />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>
            {pick(baseShops.length === 0 ? NO_DATA : NO_MATCH, lang)}
          </p>
        )}
      </div>

      {/* Right-margin ▲▼ pair, outside the scrolling region so it stays put
          while the list moves under it — the same control, at the same
          coordinates, as JejuListScreen and JejuSearch. */}
      {canScroll && (
        <>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollUp}`}
            onClick={() => scrollBy(-SCROLL_STEP)}
            aria-label="위로"
          >
            {jejuIconUrl('scroll-arrow') && (
              <img
                src={jejuIconUrl('scroll-arrow')}
                alt=""
                className={styles.scrollBtnImg}
                draggable={false}
              />
            )}
          </button>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollDown}`}
            onClick={() => scrollBy(SCROLL_STEP)}
            aria-label="아래로"
          >
            {jejuIconUrl('scroll-arrow') && (
              <img
                src={jejuIconUrl('scroll-arrow')}
                alt=""
                className={styles.scrollBtnImg}
                draggable={false}
              />
            )}
          </button>
        </>
      )}

      {/* Bottom-right scroll hint (Group 1707482775, x2040 y3543) — the same
          bare pair of triangles the list frames draw, and only visible here
          because this frame carries no banner. */}
      {jejuIconUrl('scroll-hint') && (
        <img src={jejuIconUrl('scroll-hint')} alt="" className={styles.scrollHint} draggable={false} />
      )}
    </JejuPageFrame>
  );
}
