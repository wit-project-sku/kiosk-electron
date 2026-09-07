/**
 * 제주공항 (W006) 렌트카 — Figma 6297:76578 / 6297:76391 (제주>하영=렌트카=공항-01).
 *
 * Search + filter chips (전체 / 공항 내 / 공항 셔틀 / 셔틀 없음), then a
 * single filtered catalogue. `#렌터카하우스` shops are reached via 공항 내.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { Shop } from '@shared/types/shop';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import { pick, type Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import {
  searchShops,
  shopHasHashtag,
  shopHasRentcarFerry,
  shopHasRentcarNoShuttle,
  shopHasRentcarRoad,
  shopHasRentcarShuttle,
  shopRentcarAddress,
  shopRentcarGuideDistanceKm,
  shopRentcarGuideModeLabel,
  shopRentcarName,
  shopRentcarRouteMeta,
  shopRentcarSecondCategory,
  shopsForBase,
} from '@renderer/lib/shops';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { JejuPageFrame } from './JejuPageFrame';
import { JejuScrollHint } from './JejuScrollHint';
import { JejuShopCard } from './JejuShopCard';
import { FloatingKeyboard } from '../insadong/keyboard/FloatingKeyboard';
import { HangulComposer } from '../insadong/keyboard/hangul';
import type { KeyAction } from '../insadong/keyboard/VirtualKeyboard';
import styles from './JejuRentcar.module.css';

interface Props {
  controller: KioskController;
}

/** Header title id — localized by JejuHeader. */
const TITLE = '렌트카';

const BASE_CATEGORY = '렌트카';

const rentText = (key: string, lang: Lang, fallback: Partial<Record<Lang, string>>): string =>
  sheetText(key, lang, fallback);

const NO_DATA = {
  ko: '준비중입니다', en: 'Coming soon', ja: '準備中です', zh: '准备中',
  vi: 'Đang chuẩn bị', th: 'กำลังเตรียมการ', ru: 'Готовится', id: 'Segera hadir',
};

const NO_MATCH = {
  ko: '조건에 맞는 업체가 없습니다', en: 'No matching companies', ja: '該当する店舗がありません',
  zh: '没有符合条件的商户', vi: 'Không có công ty phù hợp', th: 'ไม่พบบริษัทที่ตรงเงื่อนไข',
  ru: 'Нет подходящих компаний', id: 'Tidak ada perusahaan yang cocok',
};

/** Fallback — sheet `RentCar_Search`. */
const SEARCH_PLACEHOLDER = {
  ko: '예약하신 업체명을 검색하세요',
  en: 'Search for the name of the company you booked with',
  ja: '予約した業者名を検索してください',
  zh: '搜索您预订的公司名称',
  vi: 'Tìm kiếm tên công ty bạn đã đặt trước',
  th: 'ค้นหาชื่อบริษัทที่คุณจองไว้',
  ru: 'Найдите название компании, в которой вы забронировали',
  id: 'Cari nama perusahaan yang Anda pesan',
};

const SEARCH_NO_RESULT = {
  ko: (q: string) => `'${q}' 검색 결과가 없습니다`,
  en: (q: string) => `No results for '${q}'`,
  ja: (q: string) => `「${q}」の検索結果がありません`,
  zh: (q: string) => `没有'${q}'的搜索结果`,
  vi: (q: string) => `Không có kết quả cho '${q}'`,
  th: (q: string) => `ไม่พบผลลัพธ์สำหรับ '${q}'`,
  ru: (q: string) => `Нет результатов по '${q}'`,
  id: (q: string) => `Tidak ada hasil untuk '${q}'`,
};

const RENTCAR_HOUSE_TAG = '렌터카하우스';

/** Fallback — sheet `RentCar_Category2` (chip + badge). */
const FILTER_INSIDE = {
  ko: '공항 내 데스크',
  en: 'Airport Desk',
  ja: '空港内デスク',
  zh: '机场内柜台',
  vi: 'Quầy trong sân bay',
  th: 'โต๊ะภายในสนามบิน',
  ru: 'Стойка в аэропорту',
  id: 'Meja di Bandara',
};

/** Fallback — sheet `RentCar_Category5`. */
const FERRY_BADGE = {
  ko: '배편 이용',
  en: 'By Ferry',
  ja: '船便利用',
  zh: '乘船',
  vi: 'Sử dụng phà',
  th: 'โดยเรือเฟอร์รี่',
  ru: 'На пароме',
  id: 'Menggunakan Feri',
};

/** Fallback — sheet `RentCar_Category1`. */
const FILTER_ALL = {
  ko: '전체', en: 'All', ja: '全体', zh: '全部', vi: 'Tất cả', th: 'ทั้งหมด', ru: 'Все', id: 'Semua',
};

/** Fallback — sheet `RentCar_Category3`. */
const FILTER_SHUTTLE = {
  ko: '공항 셔틀',
  en: 'Airport Shuttle',
  ja: '空港シャトル',
  zh: '机场班车',
  vi: 'Xe buýt đưa đón sân bay',
  th: 'รถรับส่งสนามบิน',
  ru: 'Трансфер из аэропорта',
  id: 'Antar-Jemput Bandara',
};

/** Fallback — sheet `RentCar_Category4`. */
const FILTER_NO_SHUTTLE = {
  ko: '셔틀 없음',
  en: 'No Shuttle',
  ja: 'シャトルなし',
  zh: '无班车',
  vi: 'Không có xe đưa đón',
  th: 'ไม่มีรถรับส่ง',
  ru: 'Нет трансфера',
  id: 'Tidak Ada Antar-Jemput',
};

/** Fixed wayfinding line for `#렌터카하우스` cards — never the API km/time row. */
const RENTCAR_HOUSE_ROUTE = {
  ko: '1층 2번 게이트 → 렌터카하우스',
  en: '1F Gate 2 → Rent-a-Car House',
  ja: '1階2番ゲート → レンタカーハウス',
  zh: '1层2号门 → 租车之家',
  vi: 'Cổng số 2 tầng 1 → Rent-a-Car House',
  th: 'ประตู 2 ชั้น 1 → Rent-a-Car House',
  ru: 'Выход 2, 1-й этаж → Rent-a-Car House',
  id: 'Gerbang 2 Lantai 1 → Rent-a-Car House',
};

type RentcarFilter = 'all' | 'inside' | 'shuttle' | 'noShuttle';

const RENTCAR_FILTERS: RentcarFilter[] = ['all', 'inside', 'shuttle', 'noShuttle'];

const FILTER_SHEET_KEYS: Record<RentcarFilter, string> = {
  all: 'RentCar_Category1',
  inside: 'RentCar_Category2',
  shuttle: 'RentCar_Category3',
  noShuttle: 'RentCar_Category4',
};

const FILTER_LABELS: Record<RentcarFilter, Partial<Record<Lang, string>>> = {
  all: FILTER_ALL,
  inside: FILTER_INSIDE,
  shuttle: FILTER_SHUTTLE,
  noShuttle: FILTER_NO_SHUTTLE,
};

type RentcarBadgeVariant = 'primary' | 'shuttle' | 'noShuttle' | 'ferry';

/** Compact card pitch: 384 card + 60 gap. */
const SCROLL_STEP = 444;

/** Low-reach list top — under mode bar + header (Figma 6561:80628 template). */
const LIST_TOP_LOW = 837;
/** Gap between the list bottom edge and the pinned controls block. */
const LOW_CONTROLS_GAP = 100;
/** Breathing room under the filter chips (♿ foot controls). */
const CONTROLS_BOTTOM_PAD = 200;
/** List viewport height — one filter row at the foot (same as JejuListScreen lodging). */
const LOW_LIST_HEIGHT = 2501 - CONTROLS_BOTTOM_PAD;
const LOW_CONTROLS_TOP = LIST_TOP_LOW + LOW_LIST_HEIGHT + LOW_CONTROLS_GAP;

const KEYBOARD_HEIGHT = 1000;
/** Standard: search row ends ~y882 under the 700px header. */
const KEYBOARD_TOP = 882;
/** Low-reach: lift above the pinned search/filter row (not flush against it). */
const KEYBOARD_GAP_LOW = 200;
const KEYBOARD_TOP_LOW = LOW_CONTROLS_TOP - KEYBOARD_HEIGHT - KEYBOARD_GAP_LOW;

export function JejuRentcar({ controller }: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const setDetail = useDetailStore((s) => s.setItem);
  const shops = useShopStore((s) => s.shops);

  const composer = useRef(new HangulComposer());
  const scrollRef = useRef<HTMLDivElement>(null);
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [rentcarFilter, setRentcarFilter] = useState<RentcarFilter>('all');
  const [canScroll, setCanScroll] = useState(false);

  const scrollBy = (delta: number): void =>
    scrollRef.current?.scrollBy({ top: delta, behavior: 'smooth' });

  const resetScroll = (): void => scrollRef.current?.scrollTo({ top: 0 });

  const baseShops = useMemo(() => shopsForBase(shops, BASE_CATEGORY), [shops]);

  const catalogShops = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return baseShops;
    return searchShops(baseShops, trimmed, lang, 999, { rentcar: true });
  }, [baseShops, query, lang]);

  const isInsideAirport = (shop: Shop): boolean => shopHasHashtag(shop, RENTCAR_HOUSE_TAG);

  const filterCounts = useMemo(
    () => ({
      all: catalogShops.length,
      inside: catalogShops.filter(isInsideAirport).length,
      shuttle: catalogShops.filter((s) => shopHasRentcarShuttle(s) && !isInsideAirport(s)).length,
      noShuttle: catalogShops.filter(shopHasRentcarNoShuttle).length,
    }),
    [catalogShops],
  );

  const visibleShops = useMemo(() => {
    switch (rentcarFilter) {
      case 'inside':
        return catalogShops.filter(isInsideAirport);
      case 'shuttle':
        return catalogShops.filter((s) => shopHasRentcarShuttle(s) && !isInsideAirport(s));
      case 'noShuttle':
        return catalogShops.filter(shopHasRentcarNoShuttle);
      default: {
        const inside = catalogShops.filter(isInsideAirport);
        const rest = catalogShops.filter((s) => !isInsideAirport(s));
        return [...inside, ...rest];
      }
    }
  }, [catalogShops, rentcarFilter]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    setCanScroll(!!el && el.scrollHeight > el.clientHeight + 1);
  }, [visibleShops.length, lang, rentcarFilter, query, lowReach]);

  const applyKey = (action: KeyAction): void => {
    const c = composer.current;
    switch (action.type) {
      case 'jamo':
        c.inputJamo(action.value);
        break;
      case 'literal':
        c.inputLiteral(action.value);
        break;
      case 'space':
        c.inputLiteral(' ');
        break;
      case 'backspace':
        c.backspace();
        break;
      case 'enter':
        setFocused(false);
        setQuery(c.value);
        resetScroll();
        return;
    }
    setQuery(c.value);
  };

  const cardBadge = (shop: Shop): { label: string; variant: RentcarBadgeVariant } | null => {
    if (isInsideAirport(shop)) {
      return {
        label: rentText('RentCar_Category2', lang, FILTER_INSIDE),
        variant: 'primary',
      };
    }
    if (shopHasRentcarFerry(shop)) {
      return {
        label: rentText('RentCar_Category5', lang, FERRY_BADGE),
        variant: 'ferry',
      };
    }
    if (shopHasRentcarShuttle(shop)) {
      return {
        label: rentText('RentCar_Category3', lang, FILTER_SHUTTLE),
        variant: 'shuttle',
      };
    }
    if (shopHasRentcarRoad(shop)) {
      return {
        label: rentText('RentCar_Category4', lang, FILTER_NO_SHUTTLE),
        variant: 'noShuttle',
      };
    }
    return null;
  };

  const openDetail = (shop: Shop): void => {
    const inside = isInsideAirport(shop);
    const badge = cardBadge(shop);
    setDetail({
      from: 'rentcar',
      shopId: shop.id,
      title: TITLE,
      name: shopRentcarName(shop, lang),
      category: shopRentcarSecondCategory(shop, lang),
      photos: [],
      address: shopRentcarAddress(shop, lang),
      hours: shop.openTime ?? '',
      phone: shop.tel ?? '',
      description: '',
      tags: '',
      rating: '',
      instagram: '',
      blogReviews: shop.naverLink ?? '',
      rentcarGuide: {
        modeLabel: shopRentcarGuideModeLabel(shop, lang),
        distanceKm: shopRentcarGuideDistanceKm(shop),
        isShuttle: shopHasRentcarShuttle(shop),
        isFerry: shopHasRentcarFerry(shop),
      },
      rentcarRoute: shop.route ?? null,
      rentcarHouse: inside,
      rentcarBadge: inside ? badge?.label : undefined,
    });
    controller.navigate('detail', TITLE);
  };

  const cardRouteLine = (shop: Shop): string | undefined => {
    if (isInsideAirport(shop)) return pick(RENTCAR_HOUSE_ROUTE, lang);
    const meta = shopRentcarRouteMeta(shop, lang);
    return meta || undefined;
  };

  const cardFooterLine = (shop: Shop): string => shop.tel?.trim() ?? '';

  const renderCards = (list: Shop[]): JSX.Element => (
    <div className={styles.list}>
      {list.map((shop) => {
        const badge = cardBadge(shop);
        const routeLine = cardRouteLine(shop);
        const footerLine = cardFooterLine(shop);
        return (
          <JejuShopCard
            key={shop.id}
            shop={shop}
            lang={lang}
            query={query}
            compact
            rentcarApi
            badge={badge?.label}
            badgeVariant={badge?.variant}
            routeLine={routeLine}
            footerLine={footerLine}
            onClick={() => openDetail(shop)}
          />
        );
      })}
    </div>
  );

  const searchControl = (
    <div className={styles.searchRow}>
      <div className={styles.searchField} role="button" onClick={() => setFocused(true)}>
        <span className={`${styles.searchText} ${query ? styles.searchValue : ''}`}>
          {query || rentText('RentCar_Search', lang, SEARCH_PLACEHOLDER)}
          {focused && <span className={styles.caret} />}
        </span>
        {jejuIconUrl('ico-search') && (
          <img src={jejuIconUrl('ico-search')} alt="" className={styles.searchIcon} draggable={false} />
        )}
      </div>
    </div>
  );

  const filterControls =
    baseShops.length > 0 ? (
      <div className={styles.filters}>
        {RENTCAR_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`${styles.chip} ${filter === rentcarFilter ? styles.chipActive : ''}`}
            onClick={() => {
              setRentcarFilter(filter);
              resetScroll();
            }}
          >
            <span className={styles.chipLabel}>
              {rentText(FILTER_SHEET_KEYS[filter], lang, FILTER_LABELS[filter])}
            </span>
            {filter !== 'all' && (
              <span className={styles.chipCount}>({filterCounts[filter]})</span>
            )}
          </button>
        ))}
      </div>
    ) : null;

  const controls = (
    <>
      {searchControl}
      {filterControls}
    </>
  );

  const catalogBody =
    baseShops.length === 0 ? (
      <p className={styles.empty}>{pick(NO_DATA, lang)}</p>
    ) : catalogShops.length === 0 ? (
      <p className={styles.empty}>{pick(SEARCH_NO_RESULT, lang)(query.trim())}</p>
    ) : (
      <>
        {!lowReach && filterControls}

        {visibleShops.length > 0 ? (
          renderCards(visibleShops)
        ) : (
          <p className={styles.empty}>{pick(NO_MATCH, lang)}</p>
        )}
      </>
    );

  return (
    /* No banner. ♿ follows the 2026-08-26 mode-bar revision (6561:80628): bar at
       the top, header at y113; search + shuttle filters pin to the foot. */
    <JejuPageFrame
      controller={controller}
      title={TITLE}
      showBanner={false}
      lowReachModeBar
      lowReachShift={113}
    >
      <div
        className={`${styles.scroll} ${lowReach ? styles.scrollLow : ''}`}
        style={lowReach ? { height: LOW_LIST_HEIGHT } : undefined}
        ref={scrollRef}
      >
        {!lowReach && searchControl}
        {catalogBody}
      </div>

      {lowReach && (
        <div className={styles.controlsLow} style={{ top: LOW_CONTROLS_TOP }}>
          {controls}
        </div>
      )}

      {canScroll && (
        <>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollUp} ${lowReach ? styles.scrollUpLow : ''}`}
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
            className={`${styles.scrollBtn} ${styles.scrollDown} ${lowReach ? styles.scrollDownLow : ''}`}
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

      {!lowReach && (
        <JejuScrollHint onUp={() => scrollBy(-SCROLL_STEP)} onDown={() => scrollBy(SCROLL_STEP)} />
      )}

      <FloatingKeyboard
        open={focused}
        onKey={applyKey}
        onClose={() => setFocused(false)}
        lang={lang}
        top={lowReach ? KEYBOARD_TOP_LOW : KEYBOARD_TOP}
      />
    </JejuPageFrame>
  );
}
