/**
 * The 화성휴게소 floor map and its legend — Figma 화성휴게소_식당2번_한식당
 * (7956:61156) and 화성휴게소_한국어 (7956:61166). Drawn on the 상세 page
 * (HwaseongDetail) and on 여기는 화성휴게소's 지도 tab (HwaseongRestStop),
 * each a 1703-wide row (658 and 671 tall).
 */
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { pick, useLang, type Lang } from '@renderer/lib/i18n';
import styles from './HwaseongFloorMap.module.css';

type Text = Partial<Record<Lang, string>>;

// ── Floor-map route ────────────────────────────────────────────────────
/** One 20/21-wide red segment, in the map row's coordinates (1703 × 658). */
export interface Segment { left: number; top: number; width: number; height: number }

/** Route segments + where the arrowhead's 58×63 box sits, per shopNameKr. */
export const ROUTES: Record<string, { segments: Segment[]; head: { left: number; top: number } }> = {
  // Figma 7956:61158 — 현위치 → 한식당 (map number 2, top-left).
  한식당: {
    segments: [
      { left: 243, top: 279, width: 21, height: 158 },
      { left: 243, top: 418, width: 426, height: 20 },
      { left: 648, top: 418, width: 21, height: 127 },
      { left: 1130, top: 533, width: 21, height: 92 },
      { left: 648, top: 591, width: 21, height: 36 },
      { left: 650, top: 607, width: 501, height: 20 },
    ],
    head: { left: 224, top: 258 },
  },
};

// ── Legend (화성휴게소_한국어 7956:61166) ───────────────────────────────
/** A legend group: header icon + title, then numbered entries in the badge colour.
 *  Entry names are the floor signage, as on the map image (Korean). */
interface LegendGroup {
  title: Text;
  icon: 'restaurant' | 'streetfood' | 'clothing' | 'coffee' | 'store';
  color: string;
  items: string[];
}

const LEGEND: LegendGroup[][] = [
  [
    {
      title: { ko: '식당', en: 'Restaurants', ja: '食堂', zh: '餐厅', vi: 'Nhà hàng', th: 'ร้านอาหาร', ru: 'Рестораны', id: 'Restoran' },
      icon: 'restaurant', color: '#ffbe00',
      items: ['양식당', '한식당', '우동코너', '라면코너', '이비가 짬뽕', '유가네 곰탕'],
    },
  ],
  [
    {
      title: { ko: '먹거리', en: 'Snacks', ja: '軽食', zh: '小吃', vi: 'Đồ ăn vặt', th: 'ของว่าง', ru: 'Закуски', id: 'Jajanan' },
      icon: 'streetfood', color: '#f18019',
      items: ['수제도너츠', '호두과자', '미스츄러스', '아리랑고로케', '빅찹', '못난이꽈배기', '공주밤빵', '핫바', '통감자 오징어'],
    },
  ],
  [
    {
      title: { ko: '의류매장', en: 'Clothing', ja: '衣料品店', zh: '服装店', vi: 'Cửa hàng quần áo', th: 'ร้านเสื้อผ้า', ru: 'Одежда', id: 'Toko pakaian' },
      icon: 'clothing', color: '#09b93b',
      items: ['TOY 매장', 'JDX', '의류매장', '하이샵'],
    },
    {
      title: { ko: '카페', en: 'Cafés', ja: 'カフェ', zh: '咖啡厅', vi: 'Quán cà phê', th: 'คาเฟ่', ru: 'Кафе', id: 'Kafe' },
      icon: 'coffee', color: '#8c502e',
      items: ['할리스', '로봇커피', '두다트카페'],
    },
  ],
  [
    {
      title: { ko: '편의시설', en: 'Amenities', ja: '便利施設', zh: '便利设施', vi: 'Tiện ích', th: 'สิ่งอำนวยความสะดวก', ru: 'Удобства', id: 'Fasilitas' },
      icon: 'store', color: '#005ab4',
      items: ['편의점', '화장실 (남자 / 여자)', '수유실', '흡연부스 1', '흡연부스 2'],
    },
  ],
];

/** 식당 is the narrower column in the frame (302.4); the others are 343.8. */
const LEGEND_WIDTHS = [302.4, 343.8, 343.8, 343.8];

function LegendIcon({ icon }: { icon: LegendGroup['icon'] }): JSX.Element {
  const src = hwaseongIconUrl(`legend-${icon}`);
  // 먹거리 is a white glyph on an orange 72 tile (radius 30), not a full export.
  if (icon === 'streetfood') {
    return (
      <span className={styles.legendFoodTile}>
        {src && <img src={src} alt="" className={styles.legendFoodGlyph} draggable={false} />}
      </span>
    );
  }
  return <span className={styles.legendIcon}>{src && <img src={src} alt="" draggable={false} />}</span>;
}

export type FloorRoute = (typeof ROUTES)[string];

/** The 1600×658 plan centred in its 1703 row, with a shop's red route on top. */
export function FloorMap({ route }: { route?: FloorRoute }): JSX.Element {
  const icon = hwaseongIconUrl;
  return (
    <div className={styles.map}>
      {icon('detail-floor-map') && <img className={styles.mapImg} src={icon('detail-floor-map')} alt="" draggable={false} />}
      {route && (
        <>
          {route.segments.map((s, i) => (
            <span key={i} className={styles.routeBar} style={s} />
          ))}
          <span className={styles.routeHead} style={route.head}>
            {icon('detail-route-head') && <img src={icon('detail-route-head')} alt="" draggable={false} />}
          </span>
        </>
      )}
    </div>
  );
}

/** The numbered signage legend under the map. */
export function FloorLegend(): JSX.Element {
  const lang = useLang();
  return (
    <div className={styles.legend}>
      <div className={styles.legendRow}>
        {LEGEND.map((column, ci) => (
          <div key={ci} className={styles.legendColumn} style={{ width: LEGEND_WIDTHS[ci] }}>
            {column.map((group) => (
              <div key={group.icon} className={styles.legendGroup}>
                <div className={styles.legendHead}>
                  <LegendIcon icon={group.icon} />
                  <span className={styles.legendTitle}>{pick(group.title, lang)}</span>
                </div>
                <div className={styles.legendList}>
                  {group.items.map((name, i) => (
                    <div key={name} className={styles.legendItem}>
                      <span className={styles.badge} style={{ background: group.color }}>{i + 1}</span>
                      <span className={styles.legendName}>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
