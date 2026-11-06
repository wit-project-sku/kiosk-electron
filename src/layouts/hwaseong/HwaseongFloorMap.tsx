/**
 * The 화성휴게소 floor map and its legend — Figma 화성휴게소_식당2번_한식당
 * (7956:61156) and 화성휴게소_한국어 (7956:61166). Drawn on the 상세 page
 * (HwaseongDetail) and on 여기는 화성휴게소's 지도 tab (HwaseongRestStop),
 * each a 1703-wide row (658 and 671 tall).
 */
import { useRef } from 'react';
import { useFitText } from '@layouts/components/fitText';
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
 *  Entry names are the floor signage (Korean on the map image), translated for
 *  the other languages; shop brands keep their romanised names. */
interface LegendGroup {
  title: Text;
  icon: 'restaurant' | 'streetfood' | 'clothing' | 'coffee' | 'store';
  color: string;
  items: Text[];
}

/** A signage entry in the eight kiosk languages (ko, en, ja, zh, vi, th, ru, id). */
const n = (ko: string, en: string, ja: string, zh: string, vi: string, th: string, ru: string, id: string): Text => ({
  ko, en, ja, zh, vi, th, ru, id,
});
/** A brand name: Korean on the Korean screen, its romanised name everywhere else. */
const brand = (ko: string, latin: string): Text => n(ko, latin, latin, latin, latin, latin, latin, latin);

const LEGEND: LegendGroup[][] = [
  [
    {
      title: { ko: '식당', en: 'Restaurants', ja: '食堂', zh: '餐厅', vi: 'Nhà hàng', th: 'ร้านอาหาร', ru: 'Рестораны', id: 'Restoran' },
      icon: 'restaurant', color: '#ffbe00',
      items: [
        n('양식당', 'Western Restaurant', '洋食レストラン', '西餐厅', 'Nhà hàng Âu', 'ร้านอาหารตะวันตก', 'Европейская кухня', 'Restoran Barat'),
        n('한식당', 'Korean Restaurant', '韓国料理店', '韩餐厅', 'Nhà hàng Hàn', 'ร้านอาหารเกาหลี', 'Корейская кухня', 'Restoran Korea'),
        n('우동코너', 'Udon Corner', 'うどんコーナー', '乌冬面专区', 'Quầy udon', 'มุมอุด้ง', 'Удон', 'Pojok Udon'),
        n('라면코너', 'Ramyeon Corner', 'ラーメンコーナー', '拉面专区', 'Quầy mì ramyeon', 'มุมรามยอน', 'Рамён', 'Pojok Ramyeon'),
        brand('이비가 짬뽕', 'Ibiga Jjamppong'),
        brand('유가네 곰탕', 'Yugane Gomtang'),
      ],
    },
  ],
  [
    {
      title: { ko: '먹거리', en: 'Snacks', ja: '軽食', zh: '小吃', vi: 'Đồ ăn vặt', th: 'ของว่าง', ru: 'Закуски', id: 'Jajanan' },
      icon: 'streetfood', color: '#f18019',
      items: [
        n('수제도너츠', 'Handmade Doughnuts', '手作りドーナツ', '手工甜甜圈', 'Bánh donut thủ công', 'โดนัททำมือ', 'Домашние пончики', 'Donat Buatan Tangan'),
        n('호두과자', 'Walnut Cakes', 'くるみ饅頭', '核桃饼', 'Bánh óc chó', 'ขนมวอลนัท', 'Ореховое печенье', 'Kue Kenari'),
        brand('미스츄러스', 'Miss Churros'),
        n('아리랑고로케', 'Arirang Croquettes', 'アリランコロッケ', '阿里郎可乐饼', 'Croquette Arirang', 'โครเก้อารีรัง', 'Крокеты Ариран', 'Kroket Arirang'),
        brand('빅찹', 'Big Chop'),
        n('못난이꽈배기', 'Twisted Doughnuts', 'ねじりドーナツ', '麻花', 'Bánh quẩy xoắn', 'โดนัทเกลียว', 'Пончики-косички', 'Donat Pilin'),
        n('공주밤빵', 'Gongju Chestnut Bread', '公州栗パン', '公州栗子面包', 'Bánh hạt dẻ Gongju', 'ขนมปังเกาลัดกงจู', 'Каштановый хлеб Конджу', 'Roti Kastanye Gongju'),
        n('핫바', 'Fish Cake Bar', 'ホットバー', '鱼糕棒', 'Chả cá que', 'ฮอตบาร์', 'Рыбная палочка', 'Hot Bar Ikan'),
        n('통감자 오징어', 'Whole Potato & Squid', '丸ごとポテト＆イカ', '整颗土豆和鱿鱼', 'Khoai tây & mực', 'มันฝรั่งทั้งหัวและปลาหมึก', 'Картофель и кальмар', 'Kentang Utuh & Cumi'),
      ],
    },
  ],
  [
    {
      title: { ko: '의류매장', en: 'Clothing', ja: '衣料品店', zh: '服装店', vi: 'Cửa hàng quần áo', th: 'ร้านเสื้อผ้า', ru: 'Одежда', id: 'Toko pakaian' },
      icon: 'clothing', color: '#09b93b',
      items: [
        n('TOY 매장', 'Toy Store', 'おもちゃ売場', '玩具店', 'Cửa hàng đồ chơi', 'ร้านของเล่น', 'Игрушки', 'Toko Mainan'),
        brand('JDX', 'JDX'),
        n('의류매장', 'Clothing Store', '衣料品店', '服装店', 'Cửa hàng quần áo', 'ร้านเสื้อผ้า', 'Одежда', 'Toko Pakaian'),
        brand('하이샵', 'Hi Shop'),
      ],
    },
    {
      title: { ko: '카페', en: 'Cafés', ja: 'カフェ', zh: '咖啡厅', vi: 'Quán cà phê', th: 'คาเฟ่', ru: 'Кафе', id: 'Kafe' },
      icon: 'coffee', color: '#8c502e',
      items: [
        brand('할리스', 'Hollys'),
        brand('로봇커피', 'Robot Coffee'),
        brand('두다트카페', 'Dudart Café'),
      ],
    },
  ],
  [
    {
      title: { ko: '편의시설', en: 'Amenities', ja: '便利施設', zh: '便利设施', vi: 'Tiện ích', th: 'สิ่งอำนวยความสะดวก', ru: 'Удобства', id: 'Fasilitas' },
      icon: 'store', color: '#005ab4',
      items: [
        n('편의점', 'Convenience Store', 'コンビニ', '便利店', 'Cửa hàng tiện lợi', 'ร้านสะดวกซื้อ', 'Магазин у дома', 'Minimarket'),
        n('화장실 (남자 / 여자)', 'Restrooms (Men / Women)', 'トイレ（男性／女性）', '洗手间（男／女）', 'Nhà vệ sinh (Nam / Nữ)', 'ห้องน้ำ (ชาย / หญิง)', 'Туалеты (М / Ж)', 'Toilet (Pria / Wanita)'),
        n('수유실', 'Nursing Room', '授乳室', '哺乳室', 'Phòng cho con bú', 'ห้องให้นมบุตร', 'Комната матери и ребёнка', 'Ruang Menyusui'),
        n('흡연부스 1', 'Smoking Booth 1', '喫煙ブース 1', '吸烟室 1', 'Khu hút thuốc 1', 'บูธสูบบุหรี่ 1', 'Курительная 1', 'Bilik Merokok 1'),
        n('흡연부스 2', 'Smoking Booth 2', '喫煙ブース 2', '吸烟室 2', 'Khu hút thuốc 2', 'บูธสูบบุหรี่ 2', 'Курительная 2', 'Bilik Merokok 2'),
      ],
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
  /* The four group headers are drawn for 식당 / 간식 / 의류 / 편의시설 in columns
     about 360 wide; "Рестораны" or "สิ่งอำนวยความสะดวก" run into the next
     column. The four shrink together only a little (≥ 0.9); a header that still
     does not fit takes its own smaller size (the fitText rescue). */
  const legendRef = useRef<HTMLDivElement>(null);
  useFitText(legendRef, styles.legendHead, lang !== 'ko', 0.9, lang, 'both', 0.45);
  return (
    <div ref={legendRef} className={styles.legend}>
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
                    <div key={name.ko} className={styles.legendItem}>
                      <span className={styles.badge} style={{ background: group.color }}>{i + 1}</span>
                      <span className={`${styles.legendName} ${lang !== 'ko' ? styles.legendNameLong : ''}`}>{pick(name, lang)}</span>
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
