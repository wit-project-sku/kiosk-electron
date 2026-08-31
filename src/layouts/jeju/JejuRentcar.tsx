/**
 * 제주공항 (W006) 렌트카 — Figma 6297:76578 / 6297:76391 (제주>하영=렌트카=공항-01).
 *
 * One scrolling column under the 700px header: `#렌터카하우스` tagged companies
 * first, then shuttle filter chips (전체 / 공항 셔틀 / 셔틀 없음), then the
 * filtered catalogue. Shuttle vs road comes from `route.guideType`.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { Shop } from '@shared/types/shop';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import { pick } from '@renderer/lib/i18n';
import {
  searchShops,
  shopAddress,
  shopHasHashtag,
  shopHasRentcarFerry,
  shopHasRentcarNoShuttle,
  shopHasRentcarRoad,
  shopHasRentcarShuttle,
  shopName,
  shopRentcarGuideDistanceKm,
  shopRentcarGuideModeLabel,
  shopSecondCategory,
  shopsForBase,
} from '@renderer/lib/shops';
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

const NO_DATA = {
  ko: '준비중입니다', en: 'Coming soon', ja: '準備中です', zh: '准备中',
  vi: 'Đang chuẩn bị', th: 'กำลังเตรียมการ', ru: 'Готовится', id: 'Segera hadir',
};

const NO_MATCH = {
  ko: '조건에 맞는 업체가 없습니다', en: 'No matching companies', ja: '該当する店舗がありません',
  zh: '没有符合条件的商户', vi: 'Không có công ty phù hợp', th: 'ไม่พบบริษัทที่ตรงเงื่อนไข',
  ru: 'Нет подходящих компаний', id: 'Tidak ada perusahaan yang cocok',
};

const SEARCH_PLACEHOLDER = {
  ko: '예약하신 업체명을 검색하세요',
  en: 'Search your reserved company',
  ja: '予約した会社名を検索してください',
  zh: '搜索您预约的公司名称',
  vi: 'Tìm kiếm tên công ty đã đặt',
  th: 'ค้นหาชื่อบริษัทที่จองไว้',
  ru: 'Найдите забронированную компанию',
  id: 'Cari nama perusahaan yang dipesan',
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

const DESK_BADGE = {
  ko: '공항 내 데스크',
  en: 'Airport desk',
  ja: '空港内デスク',
  zh: '机场内服务台',
  vi: 'Quầy trong sân bay',
  th: 'เคาน์เตอร์ในสนามบิน',
  ru: 'Стойка в аэропорту',
  id: 'Meja di bandara',
};

const FERRY_BADGE = {
  ko: '배편 이용',
  en: 'Ferry access',
  ja: 'フェリー利用',
  zh: '需乘渡轮',
  vi: 'Đi phà',
  th: 'ใช้เรือข้ามฟาก',
  ru: 'На пароме',
  id: 'Akses feri',
};

const FILTER_ALL = {
  ko: '전체', en: 'All', ja: 'すべて', zh: '全部', vi: 'Tất cả', th: 'ทั้งหมด', ru: 'Все', id: 'Semua',
};

const FILTER_SHUTTLE = {
  ko: '공항 셔틀',
  en: 'Airport shuttle',
  ja: '空港シャトル',
  zh: '机场班车',
  vi: 'Xe đưa sân bay',
  th: 'รถรับส่งสนามบิน',
  ru: 'Аэропортный шаттл',
  id: 'Antar-jemput bandara',
};

const FILTER_NO_SHUTTLE = {
  ko: '셔틀 없음',
  en: 'No shuttle',
  ja: 'シャトルなし',
  zh: '无班车',
  vi: 'Không có xe đưa',
  th: 'ไม่มีรถรับส่ง',
  ru: 'Без шаттла',
  id: 'Tanpa antar-jemput',
};

/** Fixed wayfinding line for `#렌터카하우스` cards — never the API km/time row. */
const RENTCAR_HOUSE_ROUTE = '1층 2번 게이트 → 렌터카하우스';

const HOUSE_HEADING = {
  ko: (n: number) => `공항 안에서 바로 ・ 렌터카하우스 ${n}곳`,
  en: (n: number) => `Directly in the airport ・ Rent-a-Car House ${n} locations`,
  ja: (n: number) => `空港内ですぐ ・ レンタカーハウス ${n}件`,
  zh: (n: number) => `机场内直达 ・ 租车之家 ${n}家`,
  vi: (n: number) => `Ngay trong sân bay ・ Rent-a-Car House ${n} địa điểm`,
  th: (n: number) => `ในสนามบินเลย ・ Rent-a-Car House ${n} แห่ง`,
  ru: (n: number) => `Прямо в аэропорту ・ Rent-a-Car House — ${n} точек`,
  id: (n: number) => `Langsung di bandara ・ Rent-a-Car House ${n} lokasi`,
};

type ShuttleFilter = 'all' | 'shuttle' | 'noShuttle';

const SHUTTLE_FILTERS: ShuttleFilter[] = ['all', 'shuttle', 'noShuttle'];

const FILTER_LABELS: Record<ShuttleFilter, Record<string, string>> = {
  all: FILTER_ALL,
  shuttle: FILTER_SHUTTLE,
  noShuttle: FILTER_NO_SHUTTLE,
};

type RentcarBadgeVariant = 'primary' | 'shuttle' | 'noShuttle' | 'ferry';

/** Compact card pitch: 300 card + 60 gap. */
const SCROLL_STEP = 360;

export function JejuRentcar({ controller }: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const setDetail = useDetailStore((s) => s.setItem);
  const shops = useShopStore((s) => s.shops);

  const composer = useRef(new HangulComposer());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [shuttleFilter, setShuttleFilter] = useState<ShuttleFilter>('all');
  const [canScroll, setCanScroll] = useState(false);

  const scrollBy = (delta: number): void =>
    scrollRef.current?.scrollBy({ top: delta, behavior: 'smooth' });

  const resetScroll = (): void => scrollRef.current?.scrollTo({ top: 0 });

  const baseShops = useMemo(() => shopsForBase(shops, BASE_CATEGORY), [shops]);

  const catalogShops = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return baseShops;
    return searchShops(baseShops, trimmed, lang, 999);
  }, [baseShops, query, lang]);

  const houseShops = useMemo(
    () => catalogShops.filter((s) => shopHasHashtag(s, RENTCAR_HOUSE_TAG)),
    [catalogShops],
  );

  const houseIds = useMemo(() => new Set(houseShops.map((s) => s.id)), [houseShops]);

  const otherShops = useMemo(
    () => catalogShops.filter((s) => !houseIds.has(s.id)),
    [catalogShops, houseIds],
  );

  const visibleOthers = useMemo(() => {
    if (shuttleFilter === 'all') return otherShops;
    if (shuttleFilter === 'shuttle') return otherShops.filter(shopHasRentcarShuttle);
    return otherShops.filter(shopHasRentcarNoShuttle);
  }, [otherShops, shuttleFilter]);

  const filterCounts = useMemo(
    () => ({
      all: otherShops.length,
      shuttle: otherShops.filter(shopHasRentcarShuttle).length,
      noShuttle: otherShops.filter(shopHasRentcarNoShuttle).length,
    }),
    [otherShops],
  );

  useLayoutEffect(() => {
    const el = scrollRef.current;
    setCanScroll(!!el && el.scrollHeight > el.clientHeight + 1);
  }, [houseShops.length, visibleOthers.length, lang, shuttleFilter, query]);

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

  const openDetail = (shop: Shop): void => {
    setDetail({
      from: 'rentcar',
      title: TITLE,
      name: shopName(shop, lang),
      category: shopSecondCategory(shop, lang),
      photos: [],
      address: shopAddress(shop, lang),
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
      },
      rentcarRoute: shop.route ?? null,
    });
    controller.navigate('detail', TITLE);
  };

  const cardBadge = (
    shop: Shop,
    forceDesk = false,
  ): { label: string; variant: RentcarBadgeVariant } | null => {
    if (forceDesk || shopHasHashtag(shop, RENTCAR_HOUSE_TAG)) {
      return { label: pick(DESK_BADGE, lang), variant: 'primary' };
    }
    if (shopHasRentcarFerry(shop)) {
      return { label: pick(FERRY_BADGE, lang), variant: 'ferry' };
    }
    if (shopHasRentcarShuttle(shop)) {
      return { label: pick(FILTER_SHUTTLE, lang), variant: 'shuttle' };
    }
    if (shopHasRentcarRoad(shop)) {
      return { label: pick(FILTER_NO_SHUTTLE, lang), variant: 'noShuttle' };
    }
    return null;
  };

  const renderCards = (
    list: Shop[],
    {
      forceDeskBadge = false,
      routeLine,
      house = false,
    }: { forceDeskBadge?: boolean; routeLine?: string; house?: boolean } = {},
  ): JSX.Element => (
    <div className={styles.list}>
      {list.map((shop) => {
        const badge = cardBadge(shop, forceDeskBadge);
        return (
          <JejuShopCard
            key={shop.id}
            shop={shop}
            lang={lang}
            query={query}
            compact
            house={house}
            badge={badge?.label}
            badgeVariant={badge?.variant}
            routeLine={routeLine}
            onClick={() => openDetail(shop)}
          />
        );
      })}
    </div>
  );

  return (
    <JejuPageFrame controller={controller} title={TITLE} showBanner={false}>
      <div className={styles.scroll} ref={scrollRef}>
        <div className={styles.searchRow}>
          <div className={styles.searchField} role="button" onClick={() => setFocused(true)}>
            <span className={`${styles.searchText} ${query ? styles.searchValue : ''}`}>
              {query || pick(SEARCH_PLACEHOLDER, lang)}
              {focused && <span className={styles.caret} />}
            </span>
            {jejuIconUrl('ico-search') && (
              <img src={jejuIconUrl('ico-search')} alt="" className={styles.searchIcon} draggable={false} />
            )}
          </div>
        </div>

        {baseShops.length === 0 ? (
          <p className={styles.empty}>{pick(NO_DATA, lang)}</p>
        ) : catalogShops.length === 0 ? (
          <p className={styles.empty}>{pick(SEARCH_NO_RESULT, lang)(query.trim())}</p>
        ) : (
          <>
            {houseShops.length > 0 && (
              <div className={styles.houseSection}>
                <p className={styles.houseHeading}>{pick(HOUSE_HEADING, lang)(houseShops.length)}</p>
                {renderCards(houseShops, {
                  forceDeskBadge: true,
                  routeLine: RENTCAR_HOUSE_ROUTE,
                  house: true,
                })}
              </div>
            )}

            {otherShops.length > 0 && (
              <div className={styles.filters}>
                {SHUTTLE_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={`${styles.chip} ${filter === shuttleFilter ? styles.chipActive : ''}`}
                    onClick={() => {
                      setShuttleFilter(filter);
                      resetScroll();
                    }}
                  >
                    <span className={styles.chipLabel}>{pick(FILTER_LABELS[filter], lang)}</span>
                    <span className={styles.chipCount}>{filterCounts[filter]}</span>
                  </button>
                ))}
              </div>
            )}

            {visibleOthers.length > 0 ? (
              renderCards(visibleOthers)
            ) : otherShops.length > 0 ? (
              <p className={styles.empty}>{pick(NO_MATCH, lang)}</p>
            ) : null}
          </>
        )}
      </div>

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

      <JejuScrollHint onUp={() => scrollBy(-SCROLL_STEP)} onDown={() => scrollBy(SCROLL_STEP)} />

      <FloatingKeyboard
        open={focused}
        onKey={applyKey}
        onClose={() => setFocused(false)}
        lang={lang}
        top={882}
      />
    </JejuPageFrame>
  );
}
