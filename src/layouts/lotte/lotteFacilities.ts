/**
 * 롯데 시설안내 · 화장실 from the sheet's FacilityData_* tabs, as Shop rows so the 화장실 page and
 * the 시설안내 lists read them like any other catalogue row.
 *
 * Source order, like 제주's airport facilities (lib/airportFacilities): the copy synced at launch
 * (GoogleSheetsSyncTransport → content cache LOTTE_FACILITIES_KEY) when it is this site's, else
 * the copy bundled at build time (npm run sync:sheet -- --only=lotte).
 */
import type { Shop } from '@shared/types/shop';
import type { KioskId } from '@shared/types/kiosk';
import type { LotteFacility } from '@shared/types/lotteSheet';
import { LOTTE_FACILITIES_KEY } from '@shared/constants/lotteSheet';
import { LOTTE_FACILITIES } from '@renderer/data/lotteFacilities.generated';
import { useKioskStore } from '@renderer/store/kioskStore';
import { LOTTE_EAT, LOTTE_FACILITY, LOTTE_SHOP, lotteShopsFor } from './lotteSample';

const SITES = ['W012', 'W013', 'W014'] as const;
type Site = (typeof SITES)[number];
const isSite = (id: string): id is Site => (SITES as readonly string[]).includes(id);

/**
 * Ids clear of the server catalogue's (four digits today) and of each other site's, so a facility
 * can never open another row's 상세.
 */
const idFor = (site: Site, row: LotteFacility): number =>
  900_000 + (SITES.indexOf(site) + 11) * 1_000 + row.id;

/** The synced rows when they are this site's (a test-rig switch can leave another's). */
function syncedRows(site: Site): LotteFacility[] | null {
  const data = useKioskStore.getState().getContent(LOTTE_FACILITIES_KEY)?.data;
  const rows = data?.['rows'];
  return data?.['kioskId'] === site && Array.isArray(rows) && rows.length > 0
    ? (rows as LotteFacility[])
    : null;
}

export function lotteFacilityRows(kioskId: KioskId): LotteFacility[] {
  const site = isSite(kioskId) ? kioskId : 'W012';
  return syncedRows(site) ?? LOTTE_FACILITIES[site];
}

/** '1-화장실' + 'Restroom' → '1-Restroom': the list's tab, in each language, same order prefix. */
const second = (group: string, label: string): string => {
  const prefix = /^(\d+)-/.exec(group)?.[1];
  return prefix && label ? `${prefix}-${label}` : group;
};

export function toFacilityShop(site: Site, f: LotteFacility): Shop {
  const pick = (text: LotteFacility['name'], lang: keyof LotteFacility['name']): string =>
    text[lang] || text.ko;
  const lang = (code: keyof LotteFacility['name']) => ({
    name: pick(f.name, code),
    base: LOTTE_FACILITY,
    second: second(f.group, code === 'ko' ? f.group.replace(/^\d+-/, '') : pick(f.category, code)),
    address: pick(f.location, code),
    description: f.description[code] || f.description.ko,
  });
  const ko = lang('ko');
  const en = lang('en');
  const ja = lang('ja');
  const zh = lang('zh');
  const vi = lang('vi');
  const id = lang('id');
  const th = lang('th');
  const ru = lang('ru');
  return {
    id: idFor(site, f),
    no: f.no,
    kioskId: SITES.indexOf(site) + 11,
    shopNameKr: ko.name,
    baseCategoryKr: ko.base,
    secondCategoryKr: f.group,
    aiCategoryKr: null,
    addressKr: ko.address,
    hashTagKr: '',
    descriptionKr: ko.description,
    shopNameEn: en.name,
    baseCategoryEn: en.base,
    secondCategoryEn: en.second,
    addressEn: en.address,
    hashTagEn: '',
    descriptionEn: en.description,
    shopNameJp: ja.name,
    baseCategoryJp: ja.base,
    secondCategoryJp: ja.second,
    addressJp: ja.address,
    hashTagJp: '',
    descriptionJp: ja.description,
    shopNameCh: zh.name,
    baseCategoryCh: zh.base,
    secondCategoryCh: zh.second,
    addressCh: zh.address,
    hashTagCh: '',
    descriptionCh: zh.description,
    shopNameVn: vi.name,
    secondCategoryVn: vi.second,
    addressVn: vi.address,
    descriptionVn: vi.description,
    shopNameId: id.name,
    secondCategoryId: id.second,
    addressId: id.address,
    descriptionId: id.description,
    shopNameTh: th.name,
    secondCategoryTh: th.second,
    addressTh: th.address,
    descriptionTh: th.description,
    shopNameRu: ru.name,
    secondCategoryRu: ru.second,
    addressRu: ru.address,
    descriptionRu: ru.description,
    openTime: f.hours,
    tel: f.tel,
    images: [],
  } as unknown as Shop;
}

/** This site's 시설안내 rows as Shop rows. */
export function lotteFacilityShops(kioskId: KioskId): Shop[] {
  const site = isSite(kioskId) ? kioskId : 'W012';
  return lotteFacilityRows(kioskId).map((f) => toFacilityShop(site, f));
}

/**
 * The server catalogue (GET /api/shops/v2?region=LOTTE_*) with what it lacks filled in. The server
 * carries 뭐먹지 · 뭐사지 but no 시설안내 rows yet, and 화장실 (and the info desk it points to) is
 * built from those — so the 롯데 sheet's FacilityData tab (lotteFacilities) stands in until the
 * server has them. If the server catalogue has not arrived at all (offline first boot, a backend
 * without these regions), the collected 뭐먹지 · 뭐사지 rows stand in so the screens are not blank.
 * Returns the same array when nothing needs adding, so a store subscription can call it freely.
 */
export function withLotteFallback(shops: readonly Shop[], kioskId: KioskId): Shop[] {
  const has = (base: string): boolean => shops.some((s) => s.baseCategoryKr === base);
  const needCatalogue = !has(LOTTE_EAT) && !has(LOTTE_SHOP);
  const needFacility = !has(LOTTE_FACILITY);
  if (!needCatalogue && !needFacility) return shops as Shop[];
  return [
    ...shops,
    ...(needFacility ? lotteFacilityShops(kioskId) : []),
    // The collected list's own 시설안내 rows are superseded by the sheet's.
    ...(needCatalogue ? lotteShopsFor(kioskId).filter((s) => s.baseCategoryKr !== LOTTE_FACILITY) : []),
  ];
}
