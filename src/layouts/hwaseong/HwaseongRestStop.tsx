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
/** Korean from the frame; English and the other six authored here. */
const tr = (ko: string, en: string, rest: Omit<Text, 'ko' | 'en'>): Text => ({ ko, en, ...rest });

type TabId = 'map' | 'features' | 'food';

const TABS: { id: TabId; label: Text }[] = [
  { id: 'map', label: tr('화성휴게소 지도', 'Rest Area Map', {"ja":"休憩所マップ","zh":"休息站地图","vi":"Bản đồ trạm dừng","th":"แผนที่จุดพักรถ","ru":"Карта зоны отдыха","id":"Peta rest area"}) },
  { id: 'features', label: tr('주요특징', 'Highlights', {"ja":"主な特徴","zh":"主要特色","vi":"Điểm nổi bật","th":"จุดเด่น","ru":"Особенности","id":"Keunggulan"}) },
  { id: 'food', label: tr('대표먹거리', 'Signature Food', {"ja":"名物グルメ","zh":"招牌美食","vi":"Món đặc trưng","th":"อาหารขึ้นชื่อ","ru":"Фирменные блюда","id":"Kuliner khas"}) },
];

// ── 주요특징 (7956:81433) ──────────────────────────────────────────────
const FEATURES = {
  eyebrow: tr('화성휴게소 주요 특징 및 테마', 'Hwaseong Rest Area highlights and themes', {"ja":"華城休憩所の主な特徴とテーマ","zh":"华城休息站主要特色与主题","vi":"Điểm nổi bật và chủ đề của trạm dừng Hwaseong","th":"จุดเด่นและธีมของจุดพักรถฮวาซอง","ru":"Особенности и темы зоны отдыха Хвасон","id":"Keunggulan dan tema Rest Area Hwaseong"}),
  title: tr('여행의 중간, 편안한 쉼표', 'A restful pause on your journey', {"ja":"旅の途中の、ほっとひと休み","zh":"旅途中的惬意小憩","vi":"Khoảng nghỉ thư thái giữa hành trình","th":"จุดพักผ่อนสบาย ๆ ระหว่างทาง","ru":"Приятная передышка в пути","id":"Jeda nyaman di tengah perjalanan"}),
  body: tr('서해안고속도로에서 만나는 화성휴게소. 든든한 한 끼, 자연을 즐기는 산책로, 편리한 시설로 장거리 운전 중 잠시 쉬어가기 좋은 공간입니다.', 'Hwaseong Rest Area on the Seohaean Expressway: hearty meals, walking trails in nature and convenient facilities make it a good place to take a break on a long drive.', {"ja":"西海岸高速道路にある華城休憩所。ボリュームある食事、自然を楽しめる散策路、便利な施設がそろい、長距離ドライブの途中にひと休みするのにぴったりです。","zh":"位于西海岸高速公路上的华城休息站。丰盛的餐食、亲近自然的步道和便利的设施，是长途驾驶途中小憩的好去处。","vi":"Trạm dừng Hwaseong trên cao tốc Seohaean: bữa ăn no nê, đường dạo bộ giữa thiên nhiên và tiện ích đầy đủ — nơi lý tưởng để nghỉ chân trên chặng đường dài.","th":"จุดพักรถฮวาซองบนทางด่วนซอแฮอัน มีอาหารอิ่มอร่อย ทางเดินเล่นท่ามกลางธรรมชาติ และสิ่งอำนวยความสะดวกครบครัน เหมาะสำหรับแวะพักระหว่างการขับรถทางไกล","ru":"Зона отдыха Хвасон на скоростной трассе Сохэан: сытная еда, прогулочные дорожки на природе и удобная инфраструктура — хорошее место для передышки в долгой поездке.","id":"Rest Area Hwaseong di Jalan Tol Seohaean: makanan mengenyangkan, jalur jalan kaki di alam, dan fasilitas lengkap — tempat yang pas untuk beristirahat di perjalanan jauh."}),
  cards: [
    {
      icon: 'here-utensils',
      title: tr('든든한 한 끼', 'Hearty meals', {"ja":"ボリューム満点の食事","zh":"丰盛的一餐","vi":"Bữa ăn no nê","th":"อาหารอิ่มท้อง","ru":"Сытная еда","id":"Makanan mengenyangkan"}),
      body: tr('깊은 국물의 순대국밥과 구수하고 부드러운 순두부청국장.', 'Rich sundae-gukbap and savoury, soft sundubu cheonggukjang.', {"ja":"深いスープのスンデクッパと、香ばしくまろやかなスンドゥブチョングクチャン。","zh":"汤头浓郁的血肠汤饭，以及香醇柔滑的嫩豆腐清麴酱汤。","vi":"Canh cơm sundae nước dùng đậm đà và canh tương đậu sundubu thơm bùi, mềm mịn.","th":"ซุปข้าวซุนแดน้ำซุปเข้มข้น และซุนดูบูชองกุกจังหอมกลมกล่อมนุ่มละมุน","ru":"Сундэ-гукпап с насыщенным бульоном и нежный сундубу-чхонгукчан.","id":"Sundae-gukbap berkuah kaya rasa dan sundubu cheonggukjang yang gurih dan lembut."}),
    },
    {
      icon: 'here-flower',
      title: tr('자연 속 휴식', 'Rest in nature', {"ja":"自然の中でひと休み","zh":"在自然中休憩","vi":"Nghỉ ngơi giữa thiên nhiên","th":"พักผ่อนท่ามกลางธรรมชาติ","ru":"Отдых на природе","id":"Istirahat di alam"}),
      body: tr('특히 목포 방향에는 꽃길 미술공원과 해넘이 공원 등 산책로가 잘 조성되어 있습니다.', 'The Mokpo-bound side has well-kept walking trails, including a flower-path art park and a sunset park.', {"ja":"特に木浦方面には、花道アート公園や夕日公園などの散策路が整っています。","zh":"尤其是木浦方向，设有花路美术公园和落日公园等完善的步道。","vi":"Đặc biệt hướng Mokpo có các lối dạo bộ được chăm chút như công viên nghệ thuật đường hoa và công viên hoàng hôn.","th":"โดยเฉพาะฝั่งมุ่งหน้ามกโพ มีทางเดินเล่นที่จัดไว้อย่างดี เช่น สวนศิลปะทางดอกไม้และสวนชมพระอาทิตย์ตก","ru":"Особенно в направлении Мокпхо: ухоженные прогулочные дорожки, цветочный арт-парк и парк заката.","id":"Terutama arah Mokpo, tersedia jalur jalan kaki yang tertata seperti taman seni jalur bunga dan taman matahari terbenam."}),
    },
    {
      icon: 'here-fuel',
      title: tr('편리한 시설', 'Convenient facilities', {"ja":"便利な施設","zh":"便利设施","vi":"Tiện ích thuận tiện","th":"สิ่งอำนวยความสะดวก","ru":"Удобства","id":"Fasilitas lengkap"}),
      body: tr('주유·충전 시설과 수유실, 편의점 등 이동 중 필요한 편의시설을 갖추고 있습니다.', 'Fuel and EV charging, a nursing room and a convenience store — everything you need on the road.', {"ja":"給油・充電施設、授乳室、コンビニなど、移動中に必要な施設がそろっています。","zh":"设有加油·充电设施、哺乳室、便利店等旅途中所需的便利设施。","vi":"Có trạm xăng, sạc xe điện, phòng cho con bú, cửa hàng tiện lợi — đủ mọi thứ cần thiết trên đường.","th":"มีปั๊มน้ำมันและจุดชาร์จ ห้องให้นมบุตร ร้านสะดวกซื้อ และสิ่งอำนวยความสะดวกที่จำเป็นระหว่างเดินทาง","ru":"АЗС и зарядка для электромобилей, комната матери и ребёнка, магазин — всё нужное в дороге.","id":"Tersedia SPBU dan pengisian daya, ruang menyusui, minimarket — semua yang dibutuhkan di perjalanan."}),
    },
  ],
  road: tr('서해안고속도로 · 15번 고속도로', 'Seohaean Expressway · Route 15', {"ja":"西海岸高速道路 · 15号線","zh":"西海岸高速公路 · 15号高速","vi":"Cao tốc Seohaean · Tuyến 15","th":"ทางด่วนซอแฮอัน · สาย 15","ru":"Трасса Сохэан · маршрут 15","id":"Tol Seohaean · Rute 15"}),
  address: tr('경기도 화성시 팔탄면', 'Paltan-myeon, Hwaseong-si, Gyeonggi-do', {"ja":"京畿道 華城市 八灘面","zh":"京畿道 华城市 八滩面","vi":"Paltan-myeon, Hwaseong-si, Gyeonggi-do","th":"พัลทันมยอน ฮวาซอง คย็องกีโด","ru":"Пхальтхан-мён, Хвасон, Кёнгидо","id":"Paltan-myeon, Hwaseong-si, Gyeonggi-do"}),
};

// ── 대표먹거리 (7956:81815 / 81789) ─────────────────────────────────────
const FOOD = {
  main: {
    name: tr('순대국밥', 'Sundae-gukbap', {"ja":"スンデクッパ","zh":"血肠汤饭","vi":"Canh cơm sundae","th":"ซุปข้าวซุนแด","ru":"Сундэ-гукпап","id":"Sundae-gukbap"}),
    category: tr('대표 먹거리', 'Signature food', {"ja":"名物グルメ","zh":"招牌美食","vi":"Món đặc trưng","th":"อาหารขึ้นชื่อ","ru":"Фирменное блюдо","id":"Kuliner khas"}),
    body: tr('깊은 국물과 풍부한 건더기가 어우러진 순대국밥. 고속도로를 달리며 쌓인 운전 피로를 달래는 든든한 식사입니다.', 'Deep broth and generous fillings — a hearty meal that eases the fatigue of a long highway drive.', {"ja":"深いスープとたっぷりの具が合わさったスンデクッパ。高速道路の運転で溜まった疲れを癒やす、満足感のある一杯です。","zh":"浓郁汤头配上丰富配料的血肠汤饭，是缓解高速驾驶疲劳的丰盛一餐。","vi":"Nước dùng đậm đà cùng nhiều nhân — bữa ăn no nê giúp xua tan mệt mỏi sau quãng đường cao tốc dài.","th":"น้ำซุปเข้มข้นกับเครื่องแน่น ๆ อาหารอิ่มท้องที่ช่วยคลายความเหนื่อยล้าจากการขับรถบนทางด่วน","ru":"Насыщенный бульон и щедрая начинка — сытная еда, снимающая усталость после долгой дороги.","id":"Kuah kaya rasa dengan isian melimpah — hidangan mengenyangkan pelepas lelah setelah berkendara di jalan tol."}),
    tags: tr('깊은 국물  ·  풍부한 건더기  ·  든든한 식사', 'Deep broth  ·  Generous fillings  ·  Hearty meal', {"ja":"深いスープ  ·  たっぷりの具  ·  満足の一食","zh":"浓郁汤头  ·  配料丰富  ·  丰盛一餐","vi":"Nước dùng đậm  ·  Nhiều nhân  ·  No nê","th":"น้ำซุปเข้มข้น  ·  เครื่องแน่น  ·  อิ่มท้อง","ru":"Насыщенный бульон  ·  Щедрая начинка  ·  Сытно","id":"Kuah kaya  ·  Isian melimpah  ·  Mengenyangkan"}),
  },
  second: {
    eyebrow: tr('또 하나의 대표 먹거리', 'Another signature dish', {"ja":"もうひとつの名物","zh":"另一道招牌美食","vi":"Một món đặc trưng khác","th":"อาหารขึ้นชื่ออีกเมนู","ru":"Ещё одно фирменное блюдо","id":"Kuliner khas lainnya"}),
    name: tr('순두부청국장', 'Sundubu cheonggukjang', {"ja":"スンドゥブチョングクチャン","zh":"嫩豆腐清麴酱汤","vi":"Canh tương sundubu","th":"ซุนดูบูชองกุกจัง","ru":"Сундубу-чхонгукчан","id":"Sundubu cheonggukjang"}),
    body: tr('청국장 특유의 진한 구수함에 부드러운 순두부가 더해진 메뉴입니다. 구수한 맛과 부드러운 식감을 함께 즐길 수 있습니다.', 'The rich, nutty taste of cheonggukjang meets soft tofu — savoury flavour with a silky texture.', {"ja":"チョングクチャン特有の濃い香ばしさに、やわらかいスンドゥブを合わせた一品。香ばしい味となめらかな食感を一緒に楽しめます。","zh":"清麴酱特有的浓郁香醇，加上柔嫩的嫩豆腐，香醇味道与柔滑口感兼得。","vi":"Vị bùi đậm đặc trưng của cheonggukjang hòa cùng đậu hũ non mềm mịn — vừa thơm ngon vừa êm dịu.","th":"ความหอมเข้มข้นของชองกุกจังผสานกับเต้าหู้อ่อนนุ่ม ได้ทั้งรสชาติกลมกล่อมและสัมผัสนุ่มละมุน","ru":"Насыщенный вкус чхонгукчана с нежным мягким тофу — пряно и бархатисто одновременно.","id":"Rasa gurih khas cheonggukjang berpadu tahu sutra yang lembut — gurih sekaligus halus di mulut."}),
    tags: tr('진한 구수함  ·  부드러운 순두부', 'Rich and nutty  ·  Silky soft tofu', {"ja":"濃い香ばしさ  ·  やわらかスンドゥブ","zh":"浓郁香醇  ·  柔嫩豆腐","vi":"Thơm bùi đậm  ·  Đậu hũ non mềm","th":"หอมเข้มข้น  ·  เต้าหู้อ่อนนุ่ม","ru":"Насыщенный вкус  ·  Нежный тофу","id":"Gurih pekat  ·  Tahu sutra lembut"}),
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
      <HwaseongPageBg />

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
