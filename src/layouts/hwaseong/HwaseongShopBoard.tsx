/**
 * 화성휴게소 (W005) home board — Figma 화성 홈 7904:104580, board 7904:104707
 * and 상점 정보 더보기 group 7904:104690.
 *
 * The frame's board is the 오산 오늘의 상점 board carried over half-edited: its
 * title reads 도로교통상황 but its columns are still 상점명 / 카테고리 / 위치 /
 * 현황 with the 오산 sample row (을지상점 · 한정식 · 경기도 오산시 … · 영업중).
 * The columns decide what it is, so it shows one real '휴' shop a day, titled
 * 오늘의 상점 like 오산 — the board and 더보기 both open that shop's 상세.
 *
 * Positioned in HwaseongHome's frame coordinates (1 CSS px = 1 Figma px).
 */
import { useMemo } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { pick, type Lang } from '@renderer/lib/i18n';
import {
  pickDailyShop,
  shopAddress,
  shopCategoryLabel,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopOpenNow,
  shopSecondCategory,
} from '@renderer/lib/shops';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import type { KioskScreenId } from '@shared/types/kiosk';
import styles from './HwaseongShopBoard.module.css';

interface Props {
  controller: KioskController;
  lang: Lang;
  /** The home clock — re-picks at midnight and re-reads 현황 as it ticks. */
  now: Date;
  /** ♿ barrier-free home (7904:104975): the board sits inside the notice card. */
  low?: boolean;
}

/** witteria baseCategoryKr → the list screen it belongs to (its title heads 상세). */
const BASE_SCREENS: Record<string, { screen: KioskScreenId; title: string }> = {
  '휴 뭐먹지': { screen: 'food_court', title: "'휴' 뭐먹지" },
  '휴 뭐사지': { screen: 'shop', title: "'휴' 뭐사지" },
};

const TITLE = {
  ko: '오늘의 상점', en: "Today's Shop", ja: '今日のお店', zh: '今日店铺',
  vi: 'Cửa hàng hôm nay', th: 'ร้านค้าวันนี้', ru: 'Магазин дня', id: 'Toko Hari Ini',
};
const HEAD_NAME = {
  ko: '상점명', en: 'Shop', ja: '店名', zh: '店名',
  vi: 'Tên cửa hàng', th: 'ชื่อร้าน', ru: 'Название', id: 'Nama toko',
};
const HEAD_CATEGORY = {
  ko: '카테고리', en: 'Category', ja: 'カテゴリー', zh: '类别',
  vi: 'Danh mục', th: 'หมวดหมู่', ru: 'Категория', id: 'Kategori',
};
const HEAD_LOCATION = {
  ko: '위치', en: 'Location', ja: '場所', zh: '位置',
  vi: 'Vị trí', th: 'ที่ตั้ง', ru: 'Адрес', id: 'Lokasi',
};
const HEAD_STATUS = {
  ko: '현황', en: 'Status', ja: '状況', zh: '状态',
  vi: 'Trạng thái', th: 'สถานะ', ru: 'Статус', id: 'Status',
};
const OPEN = {
  ko: '영업중', en: 'Open', ja: '営業中', zh: '营业中',
  vi: 'Mở cửa', th: 'เปิดอยู่', ru: 'Открыто', id: 'Buka',
};
const CLOSED = {
  ko: '영업종료', en: 'Closed', ja: '営業時間外', zh: '已打烊',
  vi: 'Đóng cửa', th: 'ปิดแล้ว', ru: 'Закрыто', id: 'Tutup',
};
const MORE = {
  ko: '상점 정보 더보기', en: 'More shop info', ja: 'お店の情報をもっと見る', zh: '查看更多店铺信息',
  vi: 'Xem thêm thông tin cửa hàng', th: 'ดูข้อมูลร้านค้าเพิ่มเติม', ru: 'Подробнее о магазине',
  id: 'Info toko selengkapnya',
};

const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function HwaseongShopBoard({ controller, lang, now, low = false }: Props): JSX.Element {
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);

  const day = dayKey(now);
  const shop = useMemo(
    () => pickDailyShop(shops.filter((s) => BASE_SCREENS[s.baseCategoryKr ?? ''] && shopName(s, 'ko')), now),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-pick per DAY, not per clock tick
    [shops, day],
  );
  const open = shop ? shopOpenNow(shop.openTime, now) : null;

  // Same 상세 payload HwaseongListScreen builds, so the shop opens identically.
  const openDetail = (): void => {
    if (!shop) return;
    const base = BASE_SCREENS[shop.baseCategoryKr ?? ''];
    if (!base) return;
    const photos = shopImages(shop);
    const noImg = hwaseongIconUrl('noimage');
    setDetail({
      from: 'home',
      shopId: shop.id,
      title: base.title,
      name: shopName(shop, lang),
      category: shopSecondCategory(shop, lang),
      photos: photos.length ? photos : noImg ? [noImg] : [],
      address: shopAddress(shop, lang),
      hours: shop.openTime ?? '',
      phone: shop.tel ?? '',
      description: shopDescription(shop, lang),
      tags: shopHashtag(shop, lang),
      rating: shop.naverRating != null ? String(shop.naverRating) : '',
      instagram: '',
      blogReviews: shop.naverLink ?? '',
    });
    controller.navigate('detail', `${base.title} 상세`);
  };

  const wide = lang !== 'ko';
  const value = (text: string): string => text || '-';
  const moreArt = hwaseongIconUrl('home-more');

  return (
    <>
      <div
        className={`${styles.board} ${wide ? styles.boardWide : ''} ${low ? styles.boardLow : ''}`}
        role="button"
        aria-label={pick(TITLE, lang)}
        aria-disabled={!shop || undefined}
        onClick={openDetail}
      >
        <p className={styles.title}>{pick(TITLE, lang)}</p>
        <div className={styles.rule} />

        <span className={`${styles.head} ${styles.colName}`}>{pick(HEAD_NAME, lang)}</span>
        <span className={`${styles.head} ${styles.colCategory}`}>{pick(HEAD_CATEGORY, lang)}</span>
        <span className={`${styles.head} ${styles.colLocation}`}>{pick(HEAD_LOCATION, lang)}</span>
        <span className={`${styles.head} ${styles.colStatus}`}>{pick(HEAD_STATUS, lang)}</span>

        <span className={`${styles.value} ${styles.colName}`}>{value(shop ? shopName(shop, lang) : '')}</span>
        <span className={`${styles.value} ${styles.colCategory}`}>
          {value(shop ? shopCategoryLabel(shop, lang) : '')}
        </span>
        <span className={`${styles.value} ${styles.colLocation}`}>{value(shop ? shopAddress(shop, lang) : '')}</span>
        <span
          className={`${styles.value} ${styles.colStatus} ${
            open === true ? styles.statusOpen : open === false ? styles.statusClosed : ''
          }`}
        >
          {open === null ? '-' : pick(open ? OPEN : CLOSED, lang)}
        </span>
      </div>

      <button type="button" className={`${styles.more} ${low ? styles.moreLow : ''}`} onClick={openDetail} disabled={!shop}>
        <span className={styles.moreArrow}>
          {moreArt && <img src={moreArt} alt="" className={styles.moreArrowImg} draggable={false} />}
        </span>
        <span className={styles.moreText}>{pick(MORE, lang)}</span>
      </button>
    </>
  );
}
