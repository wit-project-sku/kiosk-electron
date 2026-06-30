import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { pick, useLang, type Lang } from '@renderer/lib/i18n';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongMap.module.css';

interface Props {
  controller: KioskController;
}

/** Card subtitle + legend category headers (item names are brand proper nouns). */
const SUBTITLE = {
  ko: '화성휴게소: 먹거리랑 지역 특색 체험까지 가능한 작은 복합공간',
  en: 'Hwaseong SA: a compact complex for food and local specialties',
  ja: '華城SA：グルメから地域の特色体験まで楽しめる小さな複合空間',
  zh: '华城休息站：可以体验美食和地方特色的小型综合空间',
};
const LEGEND_LABELS: Record<string, Partial<Record<Lang, string>>> = {
  식당: { en: 'Restaurants', ja: '食堂', zh: '餐厅' },
  먹거리: { en: 'Street Food', ja: '軽食', zh: '小吃' },
  의류매장: { en: 'Clothing', ja: '衣料品店', zh: '服装店' },
  카페: { en: 'Café', ja: 'カフェ', zh: '咖啡' },
  편의시설: { en: 'Facilities', ja: '便利施設', zh: '便利设施' },
};

/* ── Legend data from Figma node 4167:170898 ── */
interface LegendCategory {
  label: string;
  color: string;
  iconBg: string;
  icon: string; // emoji fallback
  items: string[];
}

const LEGEND: LegendCategory[] = [
  {
    label: '식당',
    color: '#ffbe00',
    iconBg: '#ffbe00',
    icon: '🍽',
    items: ['양식당', '한식당', '우동코너', '라면코너', '이비가 짬뽕', '유가네 곰탕'],
  },
  {
    label: '먹거리',
    color: '#f18019',
    iconBg: '#f18019',
    icon: '🍢',
    items: ['수제도너츠', '호두과자', '미스츄러스', '아리랑고로케', '빅찹', '못난이꽈배기', '공주밤빵', '핫바', '통감자 오징어'],
  },
  {
    label: '의류매장',
    color: '#09b93b',
    iconBg: '#09b93b',
    icon: '👗',
    items: ['TOY 매장', 'JDX', '의류매장', '하이샵'],
  },
  {
    label: '카페',
    color: '#8c502e',
    iconBg: '#8c502e',
    icon: '☕',
    items: ['할리스', '로봇커피', '두다트카페'],
  },
  {
    label: '편의시설',
    color: '#005ab4',
    iconBg: '#005ab4',
    icon: '🏪',
    items: ['편의점', '화장실 (남자/여자)', '수유실', '흡연부스 1', '흡연부스 2'],
  },
];

export function HwaseongMap({ controller }: Props): JSX.Element {
  const lang = useLang();
  const mapSrc = hwaseongIconUrl('fg-detail-map');

  return (
    <div className={styles.root}>
      <div className={styles.bgBase} />
      {hwaseongIconUrl('bg') && (
        <img src={hwaseongIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      <HwaseongHeader controller={controller} title="화성휴게소 지도" />

      <div className={styles.results}>
        <div className={styles.card}>
          {/* Card subtitle */}
          <p className={styles.cardSubtitle}>{pick(SUBTITLE, lang)}</p>

          {/* Floor plan map */}
          <div className={styles.mapArea}>
            {mapSrc ? (
              <img src={mapSrc} alt="화성휴게소 지도" className={styles.mapImg} draggable={false} />
            ) : (
              <div className={styles.mapPlaceholder}>
                <span className={styles.mapPlaceholderText}>화성휴게소 배치도</span>
              </div>
            )}
          </div>

          {/* Legend — 5 categories */}
          <div className={styles.legend}>
            {LEGEND.map((cat) => (
              <LegendColumn key={cat.label} cat={cat} lang={lang} />
            ))}
          </div>
        </div>
      </div>

      {/* Left nav */}
      <div className={styles.leftNav}>
        {hwaseongIconUrl('fg-leftnav') && (
          <img src={hwaseongIconUrl('fg-leftnav')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button type="button" className={styles.leftNavZoneHome} onClick={() => controller.navigate('home')} aria-label="홈" />
        <button type="button" className={styles.leftNavZoneBack} onClick={() => controller.navigate('home')} aria-label="뒤로" />
      </div>

      {/* Bottom banner */}
      <div className={styles.banner}>
        {hwaseongIconUrl('fg-banner') && (
          <img src={hwaseongIconUrl('fg-banner')} alt="" className={styles.bannerImg} draggable={false} />
        )}
      </div>
    </div>
  );
}

function LegendColumn({ cat, lang }: { cat: LegendCategory; lang: Lang }): JSX.Element {
  return (
    <div className={styles.legendCol}>
      {/* Category header */}
      <div className={styles.legendHeader}>
        <div className={styles.legendIcon} style={{ background: cat.iconBg }}>
          <span className={styles.legendIconEmoji}>{cat.icon}</span>
        </div>
        <span className={styles.legendTitle}>{LEGEND_LABELS[cat.label]?.[lang] ?? cat.label}</span>
      </div>
      {/* Items */}
      <div className={styles.legendItems}>
        {cat.items.map((item, i) => (
          <div key={item} className={styles.legendItem}>
            <div className={styles.legendBadge} style={{ background: cat.color }}>
              <span className={styles.legendBadgeNum}>{i + 1}</span>
            </div>
            <span className={styles.legendItemLabel}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
