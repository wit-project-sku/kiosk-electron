/**
 * PUBLISHING STAGE (2026-11-18): 롯데 미션 rows as the M-01~M-04 frames show them (기획서 v1.1).
 *
 * The kiosk is only the discovery channel: it lists missions and shows a QR that opens one in the
 * WITS app. Joining, store-QR verification, points and rewards all live in the app. Replace
 * `lotteMissions` with the mission API once it exists; the list counts come from it too.
 */
import type { KioskId } from '@shared/types/kiosk';

export type MissionStatus = 'open' | 'ended' | 'paused';

export interface MissionPlace {
  /** A · B · C … */
  letter: string;
  /** Stamp caption ('푸드코트') and its floor ('B1'). */
  short: string;
  floor: string;
  /** Row title ("푸드코트 '롯데 미식관'") and where its store QR is ('지하 1층 · 계산대 옆 QR'). */
  name: string;
  where: string;
}

export interface Mission {
  id: string;
  title: string;
  /** Hero line under the title. */
  summary: string;
  /** List line: where · period ('롯데시네마 월드타워 · 5층  ·  ~ 12.31'). */
  listLine: string;
  /** Short period for the 다른 미션 rows ('~ 12.31'). */
  until: string;
  points: number;
  status: MissionStatus;
  /** Single-place missions — the 상세 정보 rows. */
  info?: { place: string; period: string; condition: string; qrSpot: string };
  /** Multi-place missions — the stamp route and 참여 장소. */
  places?: readonly MissionPlace[];
  /** Hero tail after the points ('1인 1회' / '3곳 완료 시 한 번에 · 1인 1회'). */
  pointsNote: string;
  /** M-04 hero line for a finished/paused mission. */
  closedLine?: string;
  imageUrl?: string;
}

export const isMulti = (m: Mission): boolean => (m.places?.length ?? 0) > 1;

/** Type pill on the list and hero: '한 곳 방문' / '여러 곳 · 3곳'. */
export const typeLabel = (m: Mission, long = false): string =>
  isMulti(m) ? `${long ? '여러 곳 방문' : '여러 곳'} · ${m.places!.length}곳` : '한 곳 방문';

const W011: readonly Mission[] = [
  {
    id: 'm1',
    title: '롯데시네마 월드타워 라운지 방문',
    summary: '월드타워 5층 라운지에 들러 매장 QR 을 찍으면 바로 포인트가 쌓여요.',
    listLine: '롯데시네마 월드타워 · 5층  ·  ~ 12.31',
    until: '~ 12.31',
    points: 100,
    status: 'open',
    pointsNote: '1인 1회',
    info: {
      place: '롯데시네마 월드타워 5층 · 라운지 카운터',
      period: '2026.11.20 ~ 12.31',
      condition: '누구나 · 1인 1회',
      qrSpot: "카운터 옆 '롯데 미션' 스탠드",
    },
  },
  {
    id: 'm2',
    title: '롯데월드몰 미식 투어',
    summary: '푸드코트 · 카페 · 디저트 매장 3곳에서 매장 QR 을 찍어 스탬프를 모아요.',
    listLine: '푸드코트 · 카페 · 디저트 매장  ·  ~ 12.31',
    until: '~ 12.31',
    points: 300,
    status: 'open',
    pointsNote: '3곳 완료 시 한 번에 · 1인 1회',
    places: [
      { letter: 'A', short: '푸드코트', floor: 'B1', name: "푸드코트 '롯데 미식관'", where: '지하 1층 · 계산대 옆 QR' },
      { letter: 'B', short: '카페', floor: '1F', name: "카페 '라운지 커피'", where: '1층 · 픽업대 옆 QR' },
      { letter: 'C', short: '디저트', floor: '2F', name: "디저트 '스위트 갤러리'", where: '2층 · 입구 QR' },
    ],
  },
  {
    id: 'm3',
    title: '서울스카이 전망대 인증',
    summary: '서울스카이 117층 전망대에서 매장 QR 을 찍으면 바로 포인트가 쌓여요.',
    listLine: '롯데월드타워 · 117층  ·  ~ 01.15',
    until: '~ 01.15',
    points: 200,
    status: 'open',
    pointsNote: '1인 1회',
    info: {
      place: '롯데월드타워 117층 · 서울스카이',
      period: '2026.11.20 ~ 2027.01.15',
      condition: '서울스카이 입장객 · 1인 1회',
      qrSpot: "117층 출구 옆 '롯데 미션' 스탠드",
    },
  },
  {
    id: 'm4',
    title: '겨울 시즌 쇼핑 스탬프 투어',
    summary: '지하 1층부터 5층까지 매장 5곳에서 매장 QR 을 찍어 스탬프를 모아요.',
    listLine: '롯데월드몰 지하 1층 ~ 5층  ·  12.01 ~ 12.25',
    until: '12.01 ~ 12.25',
    points: 500,
    status: 'open',
    pointsNote: '5곳 완료 시 한 번에 · 1인 1회',
    places: [
      { letter: 'A', short: '식품관', floor: 'B1', name: '예시 식품관', where: '지하 1층 · 입구 QR' },
      { letter: 'B', short: '잡화', floor: '1F', name: '예시 잡화 매장', where: '1층 · 계산대 옆 QR' },
      { letter: 'C', short: '패션', floor: '2F', name: '예시 패션 매장', where: '2층 · 입구 QR' },
      { letter: 'D', short: '리빙', floor: '4F', name: '예시 리빙 매장', where: '4층 · 계산대 옆 QR' },
      { letter: 'E', short: '키즈', floor: '5F', name: '예시 키즈 매장', where: '5층 · 입구 QR' },
    ],
  },
  {
    id: 'm5',
    title: '가을 영화 주간 굿즈 라운지',
    summary: '',
    listLine: '롯데시네마 월드타워  ·  10.01 ~ 10.31',
    until: '10.01 ~ 10.31',
    points: 100,
    status: 'ended',
    pointsNote: '1인 1회',
    closedLine: '2026.10.01 ~ 10.31 · 한 곳 방문 · +100P',
  },
];

/* The frames only draw 월드몰's list; the department stores get the same shape with their names. */
const store = (site: string, cinema: string): readonly Mission[] => [
  {
    id: 's1',
    title: `롯데시네마 ${cinema} 방문`,
    summary: `롯데시네마 ${cinema} 매표소에서 매장 QR 을 찍으면 바로 포인트가 쌓여요.`,
    listLine: `롯데시네마 ${cinema}  ·  ~ 12.31`,
    until: '~ 12.31',
    points: 100,
    status: 'open',
    pointsNote: '1인 1회',
    info: {
      place: `롯데시네마 ${cinema} · 매표소`,
      period: '2026.11.20 ~ 12.31',
      condition: '누구나 · 1인 1회',
      qrSpot: "매표소 옆 '롯데 미션' 스탠드",
    },
  },
  {
    id: 's2',
    title: `${site} 미식 투어`,
    summary: '식당가 · 카페 · 디저트 매장 3곳에서 매장 QR 을 찍어 스탬프를 모아요.',
    listLine: '식당가 · 카페 · 디저트 매장  ·  ~ 12.31',
    until: '~ 12.31',
    points: 300,
    status: 'open',
    pointsNote: '3곳 완료 시 한 번에 · 1인 1회',
    places: [
      { letter: 'A', short: '식당가', floor: 'B1', name: '예시 식당', where: '지하 1층 · 계산대 옆 QR' },
      { letter: 'B', short: '카페', floor: '1F', name: '예시 카페', where: '1층 · 픽업대 옆 QR' },
      { letter: 'C', short: '디저트', floor: 'B1', name: '예시 디저트', where: '지하 1층 · 입구 QR' },
    ],
  },
];

const MISSIONS: Record<string, readonly Mission[]> = {
  W011,
  W012: store('청량리점', '청량리'),
  W013: store('건대스타시티점', '건대입구'),
};

/** Open missions first, finished/paused ones last (dimmed on the list). */
export const lotteMissions = (kioskId: KioskId): readonly Mission[] =>
  [...(MISSIONS[kioskId] ?? W011)].sort(
    (a, b) => Number(a.status !== 'open') - Number(b.status !== 'open'),
  );

/** Hero copy of M-01 per site. */
export const missionIntro = (kioskId: KioskId): string =>
  kioskId === 'W012'
    ? '롯데백화점 청량리점 곳곳을 방문하고,'
    : kioskId === 'W013'
      ? '롯데백화점 건대스타시티점 곳곳을 방문하고,'
      : '롯데월드몰 · 롯데월드타워 곳곳을 방문하고,';
