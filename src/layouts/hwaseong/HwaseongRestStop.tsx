/**
 * 여기는 화성휴게소 — Figma 7956:63377 (화성휴게소 지도), 7956:81212 (주요특징),
 * 7956:81568 (대표먹거리); frames named 오산>여기는오색시장-03 in the 화성 file.
 *
 * Header · three tabs at y700 · the tab's panel from y980 · the 상점 검색
 * promo. The copy is the frames' own (Korean) with English written here; the
 * other languages fall back to English, as the page has no sheet rows yet.
 */
import { useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import nightImg from '@renderer/assets/photos/hwaseong/about/night.jpg';
import gukbapImg from '@renderer/assets/photos/hwaseong/about/gukbap.jpg';
import { trackEvent } from '@renderer/lib/analytics';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { pick, screenSubtitle, useLang, type Lang } from '@renderer/lib/i18n';
import { ui } from '@renderer/lib/uiText';
import { HwaseongBanner } from './HwaseongBanner';
import { HwaseongHeader } from './HwaseongHeader';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import { HwaseongPageBg } from './HwaseongPageBg';
import { FloorLegend, FloorMap } from './HwaseongFloorMap';
import styles from './HwaseongRestStop.module.css';

type Text = Partial<Record<Lang, string>>;
/** Korean from the frame, English authored; other languages read English. */
const tx = (ko: string, en: string): Text => ({ ko, en, ja: en, zh: en, vi: en, th: en, ru: en, id: en });

type TabId = 'map' | 'features' | 'food';

const TABS: { id: TabId; label: Text }[] = [
  { id: 'map', label: tx('화성휴게소 지도', 'Rest Area Map') },
  { id: 'features', label: tx('주요특징', 'Highlights') },
  { id: 'food', label: tx('대표먹거리', 'Signature Food') },
];

// ── 주요특징 (7956:81433) ──────────────────────────────────────────────
const FEATURES = {
  eyebrow: tx('화성휴게소 주요 특징 및 테마', 'Hwaseong Rest Area highlights and themes'),
  title: tx('여행의 중간, 편안한 쉼표', 'A restful pause on your journey'),
  body: tx(
    '서해안고속도로에서 만나는 화성휴게소. 든든한 한 끼, 자연을 즐기는 산책로, 편리한 시설로 장거리 운전 중 잠시 쉬어가기 좋은 공간입니다.',
    'Hwaseong Rest Area on the Seohaean Expressway: hearty meals, walking trails in nature and convenient facilities make it a good place to take a break on a long drive.',
  ),
  cards: [
    {
      icon: 'here-utensils',
      title: tx('든든한 한 끼', 'Hearty meals'),
      body: tx('깊은 국물의 순대국밥과 구수하고 부드러운 순두부청국장.', 'Rich sundae-gukbap and savoury, soft sundubu cheonggukjang.'),
    },
    {
      icon: 'here-flower',
      title: tx('자연 속 휴식', 'Rest in nature'),
      body: tx(
        '특히 목포 방향에는 꽃길 미술공원과 해넘이 공원 등 산책로가 잘 조성되어 있습니다.',
        'The Mokpo-bound side has well-kept walking trails, including a flower-path art park and a sunset park.',
      ),
    },
    {
      icon: 'here-fuel',
      title: tx('편리한 시설', 'Convenient facilities'),
      body: tx(
        '주유·충전 시설과 수유실, 편의점 등 이동 중 필요한 편의시설을 갖추고 있습니다.',
        'Fuel and EV charging, a nursing room and a convenience store — everything you need on the road.',
      ),
    },
  ],
  road: tx('서해안고속도로 · 15번 고속도로', 'Seohaean Expressway · Route 15'),
  address: tx('경기도 화성시 팔탄면', 'Paltan-myeon, Hwaseong-si, Gyeonggi-do'),
};

// ── 대표먹거리 (7956:81815 / 81789) ─────────────────────────────────────
const FOOD = {
  main: {
    name: tx('순대국밥', 'Sundae-gukbap'),
    category: tx('대표 먹거리', 'Signature food'),
    body: tx(
      '깊은 국물과 풍부한 건더기가 어우러진 순대국밥. 고속도로를 달리며 쌓인 운전 피로를 달래는 든든한 식사입니다.',
      'Deep broth and generous fillings — a hearty meal that eases the fatigue of a long highway drive.',
    ),
    tags: tx('깊은 국물  ·  풍부한 건더기  ·  든든한 식사', 'Deep broth  ·  Generous fillings  ·  Hearty meal'),
  },
  second: {
    eyebrow: tx('또 하나의 대표 먹거리', 'Another signature dish'),
    name: tx('순두부청국장', 'Sundubu cheonggukjang'),
    body: tx(
      '청국장 특유의 진한 구수함에 부드러운 순두부가 더해진 메뉴입니다. 구수한 맛과 부드러운 식감을 함께 즐길 수 있습니다.',
      'The rich, nutty taste of cheonggukjang meets soft tofu — savoury flavour with a silky texture.',
    ),
    tags: tx('진한 구수함  ·  부드러운 순두부', 'Rich and nutty  ·  Silky soft tofu'),
  },
};

interface Props {
  controller: KioskController;
}

export function HwaseongRestStop({ controller }: Props): JSX.Element {
  const lang = useLang();
  const [tab, setTab] = useState<TabId>('map');
  const T = (text: Text): string => pick(text, lang);
  const icon = hwaseongIconUrl;

  const goHome = (label: string): void => {
    trackEvent({ name: 'button_clicked', payload: { screen: 'tourism', label, kiosk: 'W005' } });
    controller.navigate('home');
  };
  const pickTab = (id: TabId): void => {
    trackEvent({ name: 'button_clicked', payload: { screen: 'tourism', tab: id, kiosk: 'W005' } });
    setTab(id);
  };

  const banner = icon('banner-search');
  /*
   * ♿ (7956:82043 대표먹거리, 82691 주요특징, 82477 지도): the 가상 한복 promo under
   * the mode bar, the header at 719, the tabs at the foot (3435) and the panel
   * 439 lower than normal (980 → 1419), in a window that stops at the tab band
   * (3335) and scrolls the rest.
   */
  const low = useAccessibilityStore((st) => st.lowReach);

  return (
    <div className={styles.root}>
      <HwaseongPageBg image="detail-page-bg" opacity={0.7} />

      {/* "여기는 화성휴게소" is the frame's Korean title; other languages keep
          the sheet's title for the 화성휴게소 tile. */}
      <div className={low ? styles.lowHeader : styles.contents}>
        <HwaseongHeader
          controller={controller}
          title={lang === 'ko' ? '여기는 화성휴게소' : '화성휴게소'}
          subtitle={screenSubtitle('화성휴게소', lang)}
          onHome={() => goHome('홈')}
          onBack={() => goHome('뒤로')}
        />
      </div>

      <div className={low ? `${styles.tabs} ${styles.tabsLow}` : styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab} ${t.id === tab ? styles.tabSelected : ''}`}
            onClick={() => pickTab(t.id)}
          >
            {T(t.label)}
          </button>
        ))}
      </div>

      <div className={low ? styles.lowWindow : styles.contents}>
      <div className={low ? styles.lowWindowInner : styles.contents}>
      {tab === 'map' && (
        <div className={styles.mapCard}>
          <div className={styles.mapSlot}>
            <FloorMap />
          </div>
          <div className={styles.legendSlot}>
            <FloorLegend />
          </div>
        </div>
      )}

      {tab === 'features' && (
        <div className={styles.featuresPanel}>
          <div className={styles.heading}>
            <p className={styles.eyebrow}>{T(FEATURES.eyebrow)}</p>
            <p className={styles.headingTitle}>{T(FEATURES.title)}</p>
          </div>
          <p className={styles.featuresBody}>{T(FEATURES.body)}</p>
          <img className={styles.featuresPhoto} src={nightImg} alt="" draggable={false} />
          <div className={styles.featureCards}>
            {FEATURES.cards.map((c) => (
              <div key={c.icon} className={styles.featureCard}>
                <span className={styles.featureIcon}>
                  {icon(c.icon) && <img src={icon(c.icon)} alt="" draggable={false} />}
                </span>
                <p className={styles.featureTitle}>{T(c.title)}</p>
                <p className={styles.featureBody}>{T(c.body)}</p>
              </div>
            ))}
          </div>
          <div className={styles.rule} />
          <div className={styles.location}>
            <span className={styles.locationIcon}>
              {icon('here-pin') && <img src={icon('here-pin')} alt="" draggable={false} />}
            </span>
            <div className={styles.locationText}>
              <p className={styles.locationRoad}>{T(FEATURES.road)}</p>
              <p className={styles.locationAddress}>{T(FEATURES.address)}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'food' && (
        <>
          <div className={styles.foodCard}>
            <div className={styles.foodTop}>
              <div className={styles.foodTitleRow}>
                <h2 className={styles.foodName}>{T(FOOD.main.name)}</h2>
                <span className={styles.foodCat}>
                  <span className={styles.dot} />
                  {T(FOOD.main.category)}
                </span>
              </div>
              <div className={styles.foodPhotoRow}>
                <img className={styles.foodPhoto} src={gukbapImg} alt="" draggable={false} />
              </div>
              <div className={styles.foodDivider} />
            </div>
            <p className={styles.foodBody}>{T(FOOD.main.body)}</p>
            <p className={styles.foodTags}>{T(FOOD.main.tags)}</p>
          </div>

          <div className={styles.foodCard2}>
            <div className={styles.heading}>
              <p className={styles.eyebrow}>{T(FOOD.second.eyebrow)}</p>
              <p className={styles.headingTitle}>{T(FOOD.second.name)}</p>
            </div>
            <p className={styles.food2Body}>{T(FOOD.second.body)}</p>
            <div className={styles.rule} />
            <p className={styles.food2Tags}>{T(FOOD.second.tags)}</p>
          </div>
        </>
      )}

      </div>
      </div>

      {low && <HwaseongBanner onClick={() => controller.startPhoto()} top={146} />}

      <HwaseongLeftNav onHome={() => goHome('홈')} onBack={() => goHome('뒤로')} />

      {/* The 상점 검색 promo (orange strip) — opens 검색. */}
      {banner && !low && (
        <button
          type="button"
          className={styles.banner}
          onClick={() => controller.navigate('search', '검색')}
          aria-label={ui('searchShops', lang)}
        >
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </div>
  );
}
