/**
 * KAC Jeju flight board place names arrive in Korean only (`arr_airport` /
 * `dep_airport`). Non-Korean kiosk languages show the English labels below;
 * filtering still keys off the Korean string from the feed.
 *
 * Unmapped places fall back to the Korean feed string so a new route never
 * blanks the dropdown.
 */
import type { Lang } from '@renderer/lib/i18n';

const PLACE_EN: Record<string, string> = {
  가오슝: 'Kaohsiung',
  광주: 'Gwangju',
  군산: 'Gunsan',
  '난징(남경)/난징': 'Nanjing',
  닝보: 'Ningbo',
  대구: 'Daegu',
  '도쿄/나리타': 'Tokyo/Narita',
  '베이징(다싱)/다싱': 'Beijing/Daxing',
  '베이징(서우두)/서우두': 'Beijing/Capital',
  '부산/김해': 'Busan/Gimhae',
  '상하이/푸동': 'Shanghai/Pudong',
  '서울/김포': 'Seoul/Gimpo',
  '심양/선양': 'Shenyang',
  '심천/선전': 'Shenzhen',
  '싱가폴/싱가포르': 'Singapore',
  양양: 'Yangyang',
  여수: 'Yeosu',
  '오사카/간사이': 'Osaka/Kansai',
  '우시(무석)/우시': 'Wuxi',
  울산: 'Ulsan',
  원주: 'Wonju',
  '위엔저우(온주)/원저우': 'Wenzhou',
  '진주/사천': 'Jinju/Sacheon',
  '정주/정저우': 'Zhengzhou',
  청주: 'Cheongju',
  '타이중/칭취안강': 'Taichung',
  '타이페이/타오위안': 'Taipei/Taoyuan',
  '포항/포항경주': 'Pohang/Gyeongju',
  '항조우/항저우': 'Hangzhou',
  홍콩: 'Hong Kong',
  후쿠오카: 'Fukuoka',
};

/** Display label for a feed place name. Korean stays as-is; every other lang uses English. */
export function flightPlaceLabel(placeKo: string, lang: Lang): string {
  const key = placeKo.trim();
  if (!key) return placeKo;
  if (lang === 'ko') return key;
  return PLACE_EN[key] ?? key;
}
