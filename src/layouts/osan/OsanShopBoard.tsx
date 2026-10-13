/**
 * 오색시장 (W004) 오늘의 상점 board — Figma 오산>홈 7812:106458, frame
 * 7865:49269 (board) and group 7865:49252 (상점 정보 더보기).
 *
 * Takes the slot Jeju's 운항 정보 board has in the same frame: one row of 상점명 /
 * 카테고리 / 위치 / 현황 under a rule. The frame's own row (을지상점 · 한정식 ·
 * 오산로290번길 15 · 영업중) is sample copy; the kiosk shows a real shop instead —
 * ONE per day, picked deterministically from the 뭐먹지 / 뭐사지 catalogue so the
 * board stays put while a visitor reads it and changes overnight.
 *
 * 현황 is computed from the shop's `openTime` (shopOpenNow), which is why the
 * pick prefers shops whose hours can be read: a shop without them would have
 * nothing to show in that cell. The board and 더보기 both open the shop's 상세.
 *
 * Positioned in OsanHome's frame coordinates (1 CSS px = 1 Figma px).
 */
import { useMemo } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { pick, type Lang } from '@renderer/lib/i18n';
import { shopAddress, shopCategoryLabel, shopImages, shopName, shopOpenNow } from '@renderer/lib/shops';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import type { KioskScreenId } from '@shared/types/kiosk';
import type { Shop } from '@shared/types/shop';
import { osanShopDetail } from './osanShopDetail';
import styles from './OsanShopBoard.module.css';

interface Props {
  controller: KioskController;
  lang: Lang;
  /** The home clock — re-picks at midnight and re-reads 현황 as it ticks. */
  now: Date;
  /** Barrier-free home: the board moves down into the notice card (Figma 7894:57182). */
  low?: boolean;
}

/**
 * The catalogue the pick draws from, by witteria `baseCategoryKr`, and the list
 * screen each one belongs to — its title heads the 상세 page, exactly as when
 * the same shop is opened from that list. 정이 도와줘 (marts, banks, restrooms)
 * is left out: those are facilities, not shops to feature.
 */
const BASE_SCREENS: Record<string, { screen: KioskScreenId; title: string }> = {
  '정이 뭐먹지': { screen: 'eat', title: "'정이' 뭐먹지" },
  '정이 뭐사지': { screen: 'shop', title: "'정이' 뭐사지(식품)" },
  '정이 뭐사지2': { screen: 'lodging', title: "'정이' 뭐사지(물품)" },
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

/**
 * Today's shop: the richest tier that has any members — hours AND photos, then
 * hours, then anything — sorted by id so the pool is stable, and indexed by a
 * hash of the date so every kiosk restart on the same day lands on the same row.
 */
function pickTodayShop(shops: readonly Shop[], now: Date): Shop | null {
  const pool = shops
    .filter((s) => BASE_SCREENS[s.baseCategoryKr ?? ''] && shopName(s, 'ko'))
    .sort((a, b) => a.id - b.id);
  const withHours = pool.filter((s) => shopOpenNow(s.openTime, now) !== null);
  const withPhotos = withHours.filter((s) => shopImages(s).length > 0);
  const tier = [withPhotos, withHours, pool].find((list) => list.length > 0);
  if (!tier) return null;
  let hash = 0;
  for (const ch of dayKey(now)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return tier[hash % tier.length] ?? null;
}

export function OsanShopBoard({ controller, lang, now, low = false }: Props): JSX.Element {
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);

  const day = dayKey(now);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-pick per DAY, not per clock tick
  const shop = useMemo(() => pickTodayShop(shops, now), [shops, day]);
  const open = shop ? shopOpenNow(shop.openTime, now) : null;

  const openDetail = (): void => {
    if (!shop) return;
    const base = BASE_SCREENS[shop.baseCategoryKr ?? ''];
    if (!base) return;
    setDetail(osanShopDetail(shop, lang, 'home', base.title, osanIconUrl('noimage')));
    controller.navigate('detail', `${base.title} 상세`);
  };

  const wide = lang !== 'ko';
  const value = (text: string): string => text || '-';
  const moreArt = osanIconUrl('home-more');

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
