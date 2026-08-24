/**
 * 도와줘 '하영' — Figma node 6219:98767 (제주>도와줘 하영-01=공항).
 *
 * The 제주공항 facility finder: pick a terminal, a floor and a category, and the
 * matching airport map is shown. Unlike the other layouts' 도와줘 screens
 * (InsadongHelp/OsanHelp/HwaseongHelp), which list shops from the witteria API,
 * this one is a map browser — 제주's frame draws no list at all.
 *
 * Every chip shares one screen and one floor plan; only the DATA differs. The
 * terminal and floor pick the plan, and the category chip decides which of that
 * plan's dots light up orange and become tappable — it does not swap the map.
 * Only 국제선 1F is drawn so far, so 국내선 and 2F/3F show the 준비중 line;
 * dropping in `map-<terminal>-<floor>.png` with one MAPS entry adds a floor.
 *
 * The map is also this screen's only way OUT to 상세 (6219:99127): each map
 * declares the facilities drawn on it, and tapping one opens the shared detail
 * card. That frame is what makes the pins necessary — it is the 도와줘 flow's own
 * detail and nothing else on this page could reach it.
 */
import { useMemo, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useDetailStore } from '@renderer/store/detailStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useShopStore } from '@renderer/store/shopStore';
import { facilityLabel, pick, type Lang } from '@renderer/lib/i18n';
import {
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopsForBase,
} from '@renderer/lib/shops';
import { trackEvent } from '@renderer/lib/analytics';
import { jejuMascot } from './jejuMascot';
import { JejuPageFrame } from './JejuPageFrame';
import { JejuSubTabRow } from './JejuSubTabRow';
import styles from './JejuHelp.module.css';

import mapInternational1f from '@renderer/assets/photos/jeju/help/map-international-1f.png';

type TerminalId = 'international' | 'domestic';
type FloorId = '1F' | '2F' | '3F';

/** Terminal pills in frame order (6219:98779 / 98783). */
const TERMINALS = [
  {
    id: 'international',
    label: {
      ko: '국제선',
      en: 'International',
      ja: '国際線',
      zh: '国际航线',
      vi: 'Quốc tế',
      th: 'ระหว่างประเทศ',
      ru: 'Международные',
      id: 'Internasional',
    },
  },
  {
    id: 'domestic',
    label: {
      ko: '국내선',
      en: 'Domestic',
      ja: '国内線',
      zh: '国内航线',
      vi: 'Nội địa',
      th: 'ในประเทศ',
      ru: 'Внутренние',
      id: 'Domestik',
    },
  },
] as const satisfies ReadonlyArray<{ id: TerminalId; label: Record<string, string> }>;

const FLOORS: ReadonlyArray<{ id: FloorId; label: string }> = [
  { id: '1F', label: '1F' },
  { id: '2F', label: '2F' },
  { id: '3F', label: '3F' },
];

/**
 * Category chips, in frame order (6219:98787), five per row.
 *
 * The ids are the Korean strings `facilityLabel` keys off — the same map the
 * 도와줘 screens in the other layouts use, extended with 제주 airport's own
 * categories. 교통약자 편의시설 carries the frame's own line break.
 */
const CATEGORIES = [
  '화장실',
  '안내소',
  '식음료',
  '편의점',
  '은행·환전',
  '흡연실',
  '유아휴게실',
  '교통약자\n편의시설',
  '유실물센터',
  '기타',
];
const PER_ROW = 5;

/**
 * One tappable facility on a map.
 *
 * The dot and its caption are PAINTED INTO the map PNG — this is only the
 * hotspot over it, so `x`/`y` are the dot's centre in the map's own 1820×1383
 * space and must be read off the artwork (the 국제선 1F source is 799×607, so a
 * source coordinate scales by 1820/799).
 *
 * `label` is what the map draws. `shopName` is the witteria `shopNameKr` to pull
 * the 상세 content from, defaulting to `label`; the four 장애인화장실 pins below
 * share one label and so would share one row — give each its own `shopName` once
 * the real rows exist and they can be told apart.
 */
interface FacilityPin {
  x: number;
  y: number;
  /** Which category chip lights this dot up. */
  category: string;
  label: string;
  shopName?: string;
}

/**
 * The maps that exist, keyed `<terminal>-<floor>`.
 *
 * ★ NOT keyed by category. One floor plan serves every chip: the plan draws all
 * of its facilities at once, and picking a chip only decides WHICH of its dots
 * light up (see `pins` / the .pinDot overlay). Keying the map by category meant
 * a separate PNG per chip, so nine of the ten chips showed 준비중 on a floor
 * whose plan was already on screen.
 *
 * `here` is where the kiosk itself stands ON THAT MAP, in the same map-local
 * coordinates, anchored at the pin's tip (6219:98771 sits at artboard
 * 759,2323–2384; the map starts at 170,1527). Both it and `pins` travel with the
 * map rather than living in the CSS because they are properties of the drawing:
 * a different floor plan puts everything somewhere else.
 *
 * NOTE: in the Figma frame the 현위치 marker is parented to the BACKGROUND frame
 * (6219:98769), which paints before the map (6219:98774) — so the design's own
 * render hides it behind the map. Drawn on top here: a marker with a position,
 * a label and a colour is authored content, and one that cannot be seen is a
 * z-order slip, not a decision. Delete `here` from the entry to hide it again.
 */
interface AirportMap {
  src: string;
  here?: { x: number; y: number };
  pins?: FacilityPin[];
}

const MAPS: Record<string, AirportMap> = {
  'international-1F': {
    src: mapInternational1f,
    here: { x: 609.5, y: 857 },
    /*
     * Every dot the plan paints, found by scanning the PNG for its filled black
     * circles rather than read off by eye: 14 of them, 13–14px across in the
     * 799×607 source, listed here in the map's own 1820-wide space (×2.2778).
     * The four already-known 화장실 coordinates came back identical, which is
     * what says the rest are right too.
     *
     * Only the dots that belong to a CHIP are listed. The plan's other nine —
     * GATE1–5, 택시 승강장, 대형버스 주차장 and the two 도착 halls — are
     * wayfinding context that no chip selects, so they stay black and inert.
     * Give one a `category` the day it becomes a facility.
     */
    pins: [
      { x: 184.5, y: 709.5, category: '화장실', label: '장애인화장실' },
      { x: 698.2, y: 202.7, category: '화장실', label: '장애인화장실' },
      { x: 501.1, y: 418.0, category: '화장실', label: '장애인화장실' },
      { x: 1622.1, y: 321.4, category: '화장실', label: '장애인화장실' },
      { x: 851.2, y: 288.6, category: '안내소', label: '종합안내센터' },
    ],
  },
};

const COMING_SOON = {
  ko: '준비중입니다',
  en: 'Coming soon',
  ja: '準備中です',
  zh: '正在准备中',
  vi: 'Đang chuẩn bị',
  th: 'กำลังเตรียมการ',
  ru: 'В подготовке',
  id: 'Sedang disiapkan',
};

/**
 * Base category (witteria `baseCategoryKr`) the facility rows come from.
 *
 * TODO(제주 W006): the catalogue has NO 도와줘 rows yet. Checked 2026-08-12
 * against `/api/shops?kioskId=7` (prod and stage): the only four base categories
 * are 제주 뭐하지 / 제주 뭐먹지 / 제주 뭐사지 / 숙박안내. The mascot form this used
 * to guess ('하영 도와줘') is ruled out by those four — 제주 keys on the LOCATION
 * prefix — so this now follows the same prefix, but it is still a guess about a
 * category that does not exist yet. Until the rows land the screen runs entirely
 * off the map, which is why the absence is invisible: `facilities` is empty and
 * every pin opens with what the MAP knows (see openPin), not an error.
 */
const BASE_CATEGORY = '제주 도와줘';

/** Where in the airport a pin is, for the 상세 card's address line when the
 *  witteria row that would carry a real address does not exist yet. */
function placeLine(terminal: TerminalId, floor: FloorId, lang: Lang): string {
  const t = TERMINALS.find((x) => x.id === terminal)!;
  return `${pick(AIRPORT, lang)} ${pick(t.label, lang)} ${floor}`;
}

const AIRPORT = {
  ko: '제주국제공항',
  en: 'Jeju International Airport',
  ja: '済州国際空港',
  zh: '济州国际机场',
  vi: 'Sân bay quốc tế Jeju',
  th: 'ท่าอากาศยานนานาชาติเชจู',
  ru: 'Международный аэропорт Чеджу',
  id: 'Bandara Internasional Jeju',
};

/** 6219:98773 — the label under the 현위치 pin. */
const YOU_ARE_HERE = {
  ko: '현위치',
  en: 'You are here',
  ja: '現在地',
  zh: '当前位置',
  vi: 'Vị trí hiện tại',
  th: 'ตำแหน่งปัจจุบัน',
  ru: 'Вы здесь',
  id: 'Lokasi Anda',
};

interface Props {
  controller: KioskController;
  /**
   * Chip lit on arrival. The home screen's 화장실 button opens this same page —
   * there is no separate toilet screen — and passes '화장실' so the visitor lands
   * on the toilets rather than having to find the chip. Stated explicitly rather
   * than leaning on 화장실 happening to be `CATEGORIES[0]`, which is a frame
   * ordering that can change. An unknown id falls back to the first chip.
   */
  initialCategory?: string;
}

export function JejuHelp({ controller, initialCategory }: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const shops = useShopStore((s) => s.shops);
  const setDetail = useDetailStore((s) => s.setItem);
  const [terminal, setTerminal] = useState<TerminalId>('international');
  const [floor, setFloor] = useState<FloorId>('1F');
  const [category, setCategory] = useState(
    initialCategory && CATEGORIES.includes(initialCategory) ? initialCategory : CATEGORIES[0]!,
  );

  const track = (payload: Record<string, string>): void => {
    trackEvent({
      name: 'button_clicked',
      payload: { screen: 'help', ...payload, kioskId: controller.kioskId },
    });
  };

  const map = MAPS[`${terminal}-${floor}`];
  const here = jejuIconUrl('ico-here');

  /** The dots the selected chip lights up — every other dot stays black. */
  const activePins = (map?.pins ?? []).filter((p) => p.category === category);

  const facilities = useMemo(() => shopsForBase(shops, BASE_CATEGORY), [shops]);

  /**
   * Open 도와줘 '하영' > 상세 (6219:99127) for a pin.
   *
   * The card is filled from the witteria row whose Korean name matches the pin;
   * until 제주 rows exist there is none, and the pin still opens with what the
   * MAP itself knows — the facility's own label, the chip it was found under and
   * where in the airport it is. Nothing on the card is invented: an absent field
   * renders as nothing (see JejuSpotDetailCard), so the card fills in on its own
   * the day the rows land.
   */
  const openPin = (pin: FacilityPin): void => {
    const wanted = pin.shopName ?? pin.label;
    const shop = facilities.find((s) => s.shopNameKr === wanted);

    track({ facility: wanted, terminal, floor, category });

    setDetail({
      from: 'help',
      title: '여기는 제주도',
      name: shop ? shopName(shop, lang) : pin.label,
      category: facilityLabel(category, lang).replace('\n', ' '),
      photos: shop ? shopImages(shop) : [],
      address: shop ? shopAddress(shop, lang) : placeLine(terminal, floor, lang),
      hours: shop?.openTime ?? '',
      phone: shop?.tel ?? '',
      description: shop ? shopDescription(shop, lang) : '',
      tags: shop ? shopHashtag(shop, lang) : '',
      rating: shop?.naverRating != null ? String(shop.naverRating) : '',
      instagram: '',
      // Carries the Naver LINK, not a review count — see JejuDetail.
      blogReviews: shop?.naverLink ?? '',
    });
    controller.navigate('detail', `도와줘 ${jejuMascot().ko} 상세`);
  };

  return (
    // No banner in the standard layout: the frame runs the background
    // illustration to the bottom. The low-reach frame DOES open with one, so
    // the page asks for it — see .mapLow and friends.
    <JejuPageFrame
      controller={controller}
      title={jejuMascot().helpTitle}
      showBanner={false}
      lowReachBanner
      lowReachSelfLayout
      bannerFallback="banner-detail"
      onBack={() => controller.navigate('home', '뒤로')}
    >
      <div className={`${styles.terminals} ${lowReach ? styles.terminalsLow : ''}`}>
        {TERMINALS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`${styles.pill} ${id === terminal ? styles.pillActive : ''}`}
            onClick={() => {
              track({ terminal: id });
              setTerminal(id);
            }}
          >
            {pick(label, lang)}
          </button>
        ))}
      </div>

      {/* This page's floor band is on y940, not the shared row's y920. */}
      <JejuSubTabRow
        className={`${styles.floors} ${lowReach ? styles.floorsLow : ''}`}
        items={FLOORS}
        value={floor}
        onChange={(id) => {
          track({ floor: id });
          setFloor(id);
        }}
      />

      <div className={`${styles.cats} ${lowReach ? styles.catsLow : ''}`}>
        {[0, PER_ROW].map((start) => (
          <div key={start} className={styles.catRow}>
            {CATEGORIES.slice(start, start + PER_ROW).map((id) => (
              <button
                key={id}
                type="button"
                className={`${styles.pill} ${id === category ? styles.pillActive : ''}`}
                onClick={() => {
                  track({ category: id });
                  setCategory(id);
                }}
              >
                {facilityLabel(id, lang)}
              </button>
            ))}
          </div>
        ))}
      </div>

      {map ? (
        <div className={`${styles.map} ${lowReach ? styles.mapLow : ''}`}>
          <img src={map.src} alt="" draggable={false} />

          {/* The dots for the selected chip. The plan paints every dot BLACK,
              so the orange one is drawn over it — the artwork carries no
              per-category colour and cannot be recoloured through CSS. The
              button around it is the tap target and the route to 상세. */}
          {activePins.map((pin) => (
            <button
              key={`${pin.x},${pin.y}`}
              type="button"
              className={styles.pin}
              style={{ left: pin.x, top: pin.y }}
              onClick={() => openPin(pin)}
              aria-label={pin.label}
            >
              <span className={styles.pinDot} />
            </button>
          ))}

          {/* 현위치 (6219:98771). Drawn only when the map says where the kiosk
              is — a pin at a guessed position is worse than no pin. */}
          {map.here && here && (
            <div className={styles.here} style={{ left: map.here.x, top: map.here.y }}>
              <img src={here} alt="" className={styles.hereIcon} draggable={false} />
              <p className={styles.hereLabel}>{pick(YOU_ARE_HERE, lang)}</p>
            </div>
          )}
        </div>
      ) : (
        <p className={`${styles.empty} ${lowReach ? styles.emptyLow : ''}`}>{pick(COMING_SOON, lang)}</p>
      )}
    </JejuPageFrame>
  );
}
