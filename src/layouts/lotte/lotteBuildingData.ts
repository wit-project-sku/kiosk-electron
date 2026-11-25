/**
 * PUBLISHING STAGE (2026-11-18): content for 건물 안내 — 이벤트 (C-04) and 핫스팟 (A-07).
 *
 * Copied from the Figma frames. 월드몰's 핫스팟 are the frame's official facilities with photos; the
 * department stores' are their 편의시설 lists with no photos yet (the frame draws '사진 자리').
 * The other 월드몰 buildings and every 이벤트 row are 예시 until the building event source is
 * decided (spec C-04 '아직 정해지지 않은 것').
 */
import type { KioskId } from '@shared/types/kiosk';

export interface BuildingEvent {
  /** MAIN EVENT · POP-UP · ENTERTAINMENT · STORE EVENT */
  kind: string;
  title: string;
  /** '11.13 ~ 11.30 · 롯데월드몰 1F 아트리움' — period and place on one line. */
  when: string;
}

export interface Hotspot {
  name: string;
  /** One-line introduction (월드몰 only). */
  intro?: string;
  /** Floor chip — '롯데월드몰 5F ~ 7F' on 월드몰, '7F' on the department stores. */
  place: string;
  /** Opening hours (월드몰) or the category chip (department stores). */
  hours?: string;
  category?: string;
  /** lotteIconUrl key of the photo; absent = the '사진 자리' plate. */
  photo?: string;
  /** Label on the photo placeholder: '시네마' → '시네마\n사진 자리'. */
  photoLabel?: string;
}

export interface BuildingGuide {
  /** Chip label (월드몰) — the frames order the chips 월드몰 · 타워 · 백화점 · 월드. */
  name: string;
  events: readonly BuildingEvent[];
  hotspots: readonly Hotspot[];
}

const WORLD_MALL: BuildingGuide = {
  name: '롯데월드몰',
  events: [
    { kind: 'MAIN EVENT', title: '겨울 시즌 오픈 행사', when: '11.13 ~ 11.30 · 롯데월드몰 1F 아트리움' },
    { kind: 'POP-UP', title: '예시 브랜드 팝업스토어', when: '11.10 ~ 11.23 · 롯데월드몰 B1 팝업존' },
    { kind: 'ENTERTAINMENT', title: '크리스마스 트리 점등식', when: '11.21 18:00 · 롯데월드몰 월드파크' },
    { kind: 'STORE EVENT', title: '예시 매장 오픈 기념 사은품', when: '11.11 ~ 11.17 · 롯데월드몰 3F' },
  ],
  hotspots: [
    {
      name: '롯데시네마',
      intro: '아시아 최대 규모의 멀티플렉스 영화관',
      place: '롯데월드몰 5F ~ 7F',
      hours: '상영 영화별 마감시간 상이',
      photo: 'hotspot-cinema',
    },
    {
      name: '롯데월드 아쿠아리움',
      intro: '수도권 최대 규모의 아쿠아리움',
      place: '롯데월드몰 B1F',
      hours: '10:00 ~ 20:00 (금~일 22:00)',
      photo: 'hotspot-aquarium',
    },
    {
      name: '롯데콘서트홀',
      intro: '국내 최초 빈야드 스타일 콘서트홀',
      place: '롯데월드몰 8F ~ 10F',
      hours: '10:30 ~ 22:00',
      photo: 'hotspot-concert',
    },
    {
      name: '롯데마트',
      intro: '편리하고 풍요로운 일상을 위한 대형마트',
      place: '롯데월드몰 B2F',
      hours: '10:00 ~ 23:00',
      photo: 'hotspot-mart',
    },
    {
      name: '롯데하이마트',
      intro: '프리미엄 가전제품 매장',
      place: '롯데월드몰 3F',
      hours: '10:30 ~ 21:00',
      photo: 'hotspot-himart',
    },
  ],
};

/* 예시 — the frames draw only the 월드몰 chip's content. */
const TOWER: BuildingGuide = {
  name: '롯데타워',
  events: [{ kind: 'ENTERTAINMENT', title: '예시 전망대 야경 이벤트', when: '11.15 ~ 12.31 · 서울스카이 117F' }],
  hotspots: [
    { name: '서울스카이', intro: '국내 최고층 전망대', place: '롯데월드타워 117F ~ 123F', hours: '10:30 ~ 22:00', photoLabel: '전망대' },
    { name: '시그니엘 서울', intro: '롯데월드타워 고층부의 호텔', place: '롯데월드타워 76F ~ 101F', photoLabel: '호텔' },
  ],
};
const DEPARTMENT: BuildingGuide = {
  name: '롯데백화점',
  events: [{ kind: 'STORE EVENT', title: '예시 시즌 오프 행사', when: '11.14 ~ 11.24 · 롯데백화점 잠실점 9F' }],
  hotspots: [
    { name: '롯데백화점 잠실점', intro: '쇼핑과 미식을 한 곳에서', place: '롯데백화점 B1F ~ 12F', hours: '10:30 ~ 20:00', photoLabel: '백화점' },
  ],
};
const WORLD: BuildingGuide = {
  name: '롯데월드',
  events: [{ kind: 'ENTERTAINMENT', title: '예시 퍼레이드', when: '11.01 ~ 11.30 · 롯데월드 어드벤처' }],
  hotspots: [
    { name: '롯데월드 어드벤처', intro: '실내외 테마파크', place: '롯데월드 어드벤처', hours: '10:00 ~ 21:00', photoLabel: '테마파크' },
  ],
};

const STORE_EVENTS = (site: string): BuildingEvent[] => [
  { kind: 'MAIN EVENT', title: '예시 겨울 정기 세일', when: `11.13 ~ 11.30 · ${site} 1F` },
  { kind: 'POP-UP', title: '예시 브랜드 팝업스토어', when: `11.10 ~ 11.23 · ${site} B1` },
];

const CHEONGNYANGNI: BuildingGuide = {
  name: '롯데백화점 청량리점',
  events: STORE_EVENTS('청량리점'),
  hotspots: [
    { name: '롯데시네마 청량리', place: '7F', category: '시네마', photoLabel: '시네마' },
    { name: '롯데문화센터', place: '8F', category: '문화', photoLabel: '문화' },
    { name: '샤롯데가든', place: '9F', category: '휴식', photoLabel: '휴식' },
    { name: '테라스가든', place: '7F · 3F', category: '휴식', photoLabel: '휴식' },
    { name: '킨더라운지', place: '6F', category: '키즈', photoLabel: '키즈' },
    { name: 'Tax Refund', place: '8F', category: '외국인', photoLabel: '외국인' },
  ],
};

const KONKUK: BuildingGuide = {
  name: '롯데백화점 건대스타시티점',
  events: STORE_EVENTS('건대스타시티점'),
  hotspots: [
    { name: '푸드에비뉴', place: 'B1', category: '식당가', photoLabel: '식당가' },
    { name: '롯데문화센터', place: '3F', category: '문화', photoLabel: '문화' },
    { name: '에비뉴엘 오렌지 라운지', place: '5F', category: '라운지', photoLabel: '라운지' },
    { name: '유아휴게실', place: '8F', category: '키즈', photoLabel: '키즈' },
    { name: 'Tax Refund', place: '1F · 8F', category: '외국인', photoLabel: '외국인' },
    { name: '롯데웨딩센터', place: '8F', category: '웨딩', photoLabel: '웨딩' },
  ],
};

const GUIDES: Record<string, readonly BuildingGuide[]> = {
  W011: [WORLD_MALL, TOWER, DEPARTMENT, WORLD],
  W012: [CHEONGNYANGNI],
  W013: [KONKUK],
};

export const buildingGuides = (kioskId: KioskId): readonly BuildingGuide[] =>
  GUIDES[kioskId] ?? GUIDES.W011!;

/** The guide a home 건물 단추 caption opens ('롯데타워' → index into buildingGuides). */
export const guideIndexFor = (kioskId: KioskId, caption: string): number =>
  Math.max(
    0,
    buildingGuides(kioskId).findIndex((g) => g.name === caption || caption.startsWith(g.name)),
  );
