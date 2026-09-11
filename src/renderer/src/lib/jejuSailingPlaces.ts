/**
 * Terminal-board place / route strings arrive in Korean only. Non-Korean
 * boards map them below; unmapped segments keep the feed text so a new port
 * never blanks the cell.
 */
import type { Lang } from '@renderer/lib/i18n';

const PLACE_EN: Record<string, string> = {
  연안터미널: 'Coastal ',
  국제터미널: 'Intl.',
};

/** Port / berth tokens that appear in `FPORT` / `TPORT` (and thus in `route`). */
const PORT_EN: Record<string, string> = {
  제주도: 'Jeju',
  제주국제: "Jeju Int'l",
  완도: 'Wando',
  목포: 'Mokpo',
  진도: 'Jindo',
  하추자도: 'Ha Chuja',
  상추자도: 'Sang Chuja',
  녹동: 'Nokdong',
  삼천포: 'Samcheonpo',
  삼천포신항: 'Samcheonpo New Port',
  여수: 'Yeosu',
  부산: 'Busan',
  인천: 'Incheon',
  울릉도: 'Ulleung',
};

/** Common vessel names on the Jeju terminal board (feed is Korean-only). */
const SHIP_EN: Record<string, string> = {
  산타모니카: 'Santa Monica',
  골드스텔라: 'Gold Stella',
  송림블루오션: 'Songrim Blue Ocean',
  퀸제누비아2: 'Queen Genuvia 2',
  오션비스타제주: 'Ocean Vista Jeju',
  실버클라우드: 'Silver Cloud',
  아리온제주: 'Arion Jeju',
  퀸메리: 'Queen Mary',
};

/** 출발장소 / 도착장소 cell. */
export function sailingPlaceLabel(placeKo: string, lang: Lang): string {
  const key = placeKo.trim();
  if (!key) return placeKo;
  if (lang === 'ko') return key;
  return PLACE_EN[key] ?? key;
}

/** 항로 cell — `출발지-도착지`, each side mapped independently. */
export function sailingRouteLabel(routeKo: string, lang: Lang): string {
  const raw = routeKo.trim();
  if (!raw) return routeKo;
  if (lang === 'ko') return raw;
  return raw
    .split('-')
    .map((part) => {
      const key = part.trim();
      return PORT_EN[key] ?? key;
    })
    .join('-');
}

/** 선박명 cell. */
export function sailingShipLabel(shipKo: string, lang: Lang): string {
  const key = shipKo.trim();
  if (!key) return shipKo;
  if (lang === 'ko') return key;
  return SHIP_EN[key] ?? key;
}
