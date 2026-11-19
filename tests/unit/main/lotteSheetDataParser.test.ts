import { describe, expect, it } from 'vitest';
import { parseLotteFacilities } from '@main/services/sync/google/LotteSheetDataParser';
import { LOTTE_FACILITIES } from '../../../src/renderer/src/data/lotteFacilities.generated';

const HEADER = [
  'ShopID', 'NO',
  'ShopName_Kr', 'ShopName_En', 'ShopName_Jp', 'ShopName_Ch', 'ShopName_Vn', 'ShopName_Th', 'ShopName_Ru', 'ShopName_Id',
  'BaseCategory_Kr', 'BaseCategory_En',
  'Location_Kr', 'Location_En',
  'OpeningHours_Kr', 'PhoneNumber_Kr',
  'Description_Kr', 'Description_En',
];
const ROW = [
  '1', '롯데월드몰=1-화장실=01',
  '화장실', 'Restroom', 'トイレ', '洗手间', 'Nhà vệ sinh', 'ห้องน้ำ', 'Туалет', 'Toilet',
  '화장실', 'Restroom',
  '롯데월드몰 B1F', 'LOTTE WORLD MALL B1F',
  '10:30~22:00', '',
  '', '',
];

describe('parseLotteFacilities', () => {
  it('reads the Sheets API layout: a title row above the header, then the Default row', () => {
    const rows = parseLotteFacilities([
      ['롯데월드몰=데이터(시설안내·화장실)'],
      HEADER,
      ['', '', 'Default', 'Default'],
      ROW,
      ['', '', '', ''],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 1,
      no: '롯데월드몰=1-화장실=01',
      group: '1-화장실',
      hours: '10:30~22:00',
      name: { ko: '화장실', en: 'Restroom', th: 'ห้องน้ำ', id: 'Toilet' },
      location: { ko: '롯데월드몰 B1F', ja: '' },
    });
  });

  it('reads the gviz layout, whose ShopID header comes back blank', () => {
    expect(parseLotteFacilities([['', ...HEADER.slice(1)], ROW])).toHaveLength(1);
  });

  it('returns nothing for a tab without the header, so the last good copy stays', () => {
    expect(parseLotteFacilities([['ShopData'], ['a', 'b']])).toEqual([]);
  });
});

describe('bundled 롯데 facilities', () => {
  it('has every site, and a restroom row on the 월드몰 floor list', () => {
    expect(Object.keys(LOTTE_FACILITIES).sort()).toEqual(['W011', 'W012', 'W013']);
    for (const rows of Object.values(LOTTE_FACILITIES)) expect(rows.length).toBeGreaterThan(0);
    expect(LOTTE_FACILITIES.W011.some((r) => r.group.endsWith('화장실') && /F$/.test(r.location.ko))).toBe(true);
  });
});
