/**
 * KAC Jeju flight-status returns `airline` in Korean only — no
 * `airlineEnglish` on B551178. Non-Korean boards map the Korean name, then
 * fall back to the IATA prefix of `flightNo` (e.g. KE1114 → Korean Air).
 *
 * Unmapped carriers keep the Korean feed string so a new airline never blanks.
 */
import type { Lang } from '@renderer/lib/i18n';

/** Korean feed name → English display. */
const AIRLINE_EN: Record<string, string> = {
  대한항공: 'Korean Air',
  아시아나항공: 'Asiana Airlines',
  제주항공: 'Jeju Air',
  진에어: 'Jin Air',
  티웨이항공: "T'way Air",
  /** Live CJU feed has used this label on TW flights. */
  트리니티항공: "T'way Air",
  이스타항공: 'Eastar Jet',
  에어부산: 'Air Busan',
  에어서울: 'Air Seoul',
  에어로케이: 'Aero K',
  춘추항공: 'Spring Airlines',
  준야오항공: 'Juneyao Airlines',
  중국국제항공: 'Air China',
  중국동방항공: 'China Eastern Airlines',
  '타이거에어 타이완': 'Tigerair Taiwan',
  파라타항공: 'Parata Air',
  홍콩익스프레스: 'HK Express',
  캐세이퍼시픽항공: 'Cathay Pacific',
  '스쿠트 항공': 'Scoot',
  스쿠트항공: 'Scoot',
  일본항공: 'Japan Airlines',
  심천항공: 'Shenzhen Airlines',
  룽에어: 'Loong Air',
  북경수도항공: 'Beijing Capital Airlines',
};

/** IATA airline code (from 편명) → English, when the Korean map misses. */
const IATA_EN: Record<string, string> = {
  KE: 'Korean Air',
  OZ: 'Asiana Airlines',
  '7C': 'Jeju Air',
  LJ: 'Jin Air',
  TW: "T'way Air",
  ZE: 'Eastar Jet',
  BX: 'Air Busan',
  RS: 'Air Seoul',
  RF: 'Aero K',
  '9C': 'Spring Airlines',
  HO: 'Juneyao Airlines',
  CA: 'Air China',
  MU: 'China Eastern Airlines',
  IT: 'Tigerair Taiwan',
  WE: 'Parata Air',
  UO: 'HK Express',
  CX: 'Cathay Pacific',
  TR: 'Scoot',
  JL: 'Japan Airlines',
  ZH: 'Shenzhen Airlines',
  GJ: 'Loong Air',
  JD: 'Beijing Capital Airlines',
};

function iataFromFlightNo(flightNo: string): string | undefined {
  const m = flightNo.trim().toUpperCase().match(/^([A-Z0-9]{2})/);
  return m?.[1];
}

/** Display airline for the board. Korean stays as-is; other langs use English. */
export function flightAirlineLabel(airlineKo: string, flightNo: string, lang: Lang): string {
  const name = airlineKo.trim();
  if (lang === 'ko') return name || airlineKo;
  if (name && AIRLINE_EN[name]) return AIRLINE_EN[name];
  const code = iataFromFlightNo(flightNo);
  if (code && IATA_EN[code]) return IATA_EN[code];
  return name || airlineKo;
}
