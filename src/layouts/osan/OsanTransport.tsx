import { useState } from 'react';
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { t } from '@renderer/lib/loc';
import transitMap from '@renderer/assets/photos/osan/transport/transit-map.png';
import marketMap from '@renderer/assets/photos/osan/transport/market-map.png';
import streetRed from '@renderer/assets/photos/osan/transport/street-red.png';
import streetGreen from '@renderer/assets/photos/osan/transport/street-green.png';
import streetSmile from '@renderer/assets/photos/osan/transport/street-smile.png';
import streetAreum from '@renderer/assets/photos/osan/transport/street-areum.png';
import streetMoms from '@renderer/assets/photos/osan/transport/street-moms.png';
import { OsanHeader } from './OsanHeader';
import { OsanBanner } from './OsanBanner';
import { ZoomableImage } from '../insadong/ZoomableImage';
import { OsanLeftNav } from './OsanLeftNav';
import styles from './OsanTransport.module.css';

type Lang = SupportedLanguage;
function pick<T>(map: Partial<Record<Lang, T>>, lang: Lang): T {
  return (map[lang] ?? map.ko ?? (Object.values(map)[0] as T)) as T;
}

interface Badge { badge: string; color: string; text: string }

interface TransportContent {
  title: string;
  tabs: string[];
  comingSoon: string;
  transit: {
    heading: string;
    subtitle: string;
    /** Subway badges grouped into rows (Figma: [1,3] on one row, [5] below). */
    subwayRows: Badge[][];
    /** Bus badges, one per row. */
    busRows: Badge[];
  };
  marketMap: {
    heading: string;
    description: string[];
    kioskTitle: string;
    kioskLoc: string;
  };
}

const SUB1 = '#0052A4';
const SUB3 = '#EF7C1C';
const SUB5 = '#8B50A4';
const BUS = '#3D5BAB';

const CONTENT: Partial<Record<Lang, TransportContent>> = {
  ko: {
    title: '교통안내',
    tabs: ['대중교통', '오색시장지도', '빨강길', '녹색길', '미소거리', '아름거리', '맘스거리', '기타'],
    comingSoon: '준비 중입니다',
    transit: {
      heading: '지하철/버스',
      subtitle: '대중교통',
      subwayRows: [
        [
          { badge: '1', color: SUB1, text: '1호선 종각역 11번출구' },
          { badge: '3', color: SUB3, text: '3호선 안국역 6번출구' },
        ],
        [{ badge: '5', color: SUB5, text: '5호선 종로3가역 5번출구' }],
      ],
      busRows: [
        { badge: 'B', color: BUS, text: 'M4102, 5500, 9003, 9301, 9400, 940, 9411' },
        { badge: 'B', color: BUS, text: '103, 109, 143, 150, 151, 160, 161, 162, 171, 172, 260, 270, 271, 273, 370, 601, 606' },
      ],
    },
    marketMap: {
      heading: '오산 오색시장 : 먹거리, 볼거리, 즐길거리가 가득한 오산의 대표 전통시장',
      description: [
        '*오색 시장의 상점검색, 한복AR착장, AI 추천 코스, 날씨정보제공, 환율정보제공 등',
        '다양한 정보와 체험을 제공하는 오색 시장의 AI 사이니지를 경험해보세요~',
        "(오색 시장의 홍보 도우미 '정이'도 함께 만나보세요)",
      ],
      kioskTitle: '"WITH"=WIT AI SMART KIOSK 설치장소',
      kioskLoc: '오색시장 메인사거리 (오색시장 상인회 앞)',
    },
  },
  en: {
    title: 'Directions',
    tabs: ['Public Transit', 'Market Map', 'Red St.', 'Green St.', 'Smile St.', 'Areum St.', "Mom's St.", 'Other'],
    comingSoon: 'Coming soon',
    transit: {
      heading: 'Subway / Bus',
      subtitle: 'Public Transit',
      subwayRows: [
        [
          { badge: '1', color: SUB1, text: 'Line 1 · Jonggak Stn. Exit 11' },
          { badge: '3', color: SUB3, text: 'Line 3 · Anguk Stn. Exit 6' },
        ],
        [{ badge: '5', color: SUB5, text: 'Line 5 · Jongno 3-ga Stn. Exit 5' }],
      ],
      busRows: [
        { badge: 'B', color: BUS, text: 'M4102, 5500, 9003, 9301, 9400, 940, 9411' },
        { badge: 'B', color: BUS, text: '103, 109, 143, 150, 151, 160, 161, 162, 171, 172, 260, 270, 271, 273, 370, 601, 606' },
      ],
    },
    marketMap: {
      heading: 'Osan Osaek Market: Osan’s flagship traditional market full of food, sights and fun',
      description: [
        '* Shop search, hanbok AR fitting, AI course recommendations, weather and exchange-rate info, and more —',
        'enjoy the AI signage of Osaek Market that offers all kinds of info and experiences~',
        "(Come meet 'JEONG-I', the market's promotion helper, too!)",
      ],
      kioskTitle: '"WITH" = WIT AI SMART KIOSK location',
      kioskLoc: 'Osaek Market main crossing (in front of the Merchants’ Association)',
    },
  },
  ja: {
    title: '交通案内',
    tabs: ['公共交通', '五色市場地図', 'レッドロード', 'グリーンロード', 'スマイル通り', 'アルム通り', 'マムズ通り', 'その他'],
    comingSoon: '準備中です',
    transit: {
      heading: '地下鉄/バス',
      subtitle: '公共交通',
      subwayRows: [
        [
          { badge: '1', color: SUB1, text: '1号線 鍾閣駅 11番出口' },
          { badge: '3', color: SUB3, text: '3号線 安国駅 6番出口' },
        ],
        [{ badge: '5', color: SUB5, text: '5号線 鍾路3街駅 5番出口' }],
      ],
      busRows: [
        { badge: 'B', color: BUS, text: 'M4102, 5500, 9003, 9301, 9400, 940, 9411' },
        { badge: 'B', color: BUS, text: '103, 109, 143, 150, 151, 160, 161, 162, 171, 172, 260, 270, 271, 273, 370, 601, 606' },
      ],
    },
    marketMap: {
      heading: '烏山 五色市場：グルメ・見どころ・遊びが満載の烏山を代表する伝統市場',
      description: [
        '*店舗検索、韓服AR試着、AIおすすめコース、天気情報、為替情報など',
        '多彩な情報と体験を提供する五色市場のAIサイネージを体験してみてください〜',
        '(五色市場の広報ヘルパー「ジョンイ」にも会ってみてください)',
      ],
      kioskTitle: '「WITH」= WIT AI SMART KIOSK 設置場所',
      kioskLoc: '五色市場メイン交差点（五色市場商人会前）',
    },
  },
  zh: {
    title: '交通指南',
    tabs: ['公共交通', '五色市场地图', '红色路', '绿色路', '微笑街', '美丽街', '妈妈街', '其他'],
    comingSoon: '准备中',
    transit: {
      heading: '地铁/巴士',
      subtitle: '公共交通',
      subwayRows: [
        [
          { badge: '1', color: SUB1, text: '1号线 钟阁站 11号出口' },
          { badge: '3', color: SUB3, text: '3号线 安国站 6号出口' },
        ],
        [{ badge: '5', color: SUB5, text: '5号线 钟路3街站 5号出口' }],
      ],
      busRows: [
        { badge: 'B', color: BUS, text: 'M4102, 5500, 9003, 9301, 9400, 940, 9411' },
        { badge: 'B', color: BUS, text: '103, 109, 143, 150, 151, 160, 161, 162, 171, 172, 260, 270, 271, 273, 370, 601, 606' },
      ],
    },
    marketMap: {
      heading: '乌山五色市场：美食、看点、玩乐齐全的乌山代表性传统市场',
      description: [
        '*店铺搜索、韩服AR试穿、AI推荐路线、天气信息、汇率信息等',
        '快来体验提供多样信息与体验的五色市场AI数字标牌吧~',
        "(也来认识五色市场的宣传助手'正伊'吧)",
      ],
      kioskTitle: '"WITH" = WIT AI SMART KIOSK 安装位置',
      kioskLoc: '五色市场主十字路口（五色市场商人会前）',
    },
  },
  vi: {
    title: 'Hướng dẫn giao thông',
    tabs: ['Giao thông công cộng', 'Bản đồ chợ Osaek', 'Đường Đỏ', 'Đường Xanh', 'Phố Smile', 'Phố Areum', "Phố Mom's", 'Khác'],
    comingSoon: 'Đang chuẩn bị',
    transit: {
      heading: 'Tàu điện ngầm / Xe buýt',
      subtitle: 'Giao thông công cộng',
      subwayRows: [
        [
          { badge: '1', color: SUB1, text: 'Tuyến 1 · Ga Jonggak Cửa ra số 11' },
          { badge: '3', color: SUB3, text: 'Tuyến 3 · Ga Anguk Cửa ra số 6' },
        ],
        [{ badge: '5', color: SUB5, text: 'Tuyến 5 · Ga Jongno 3-ga Cửa ra số 5' }],
      ],
      busRows: [
        { badge: 'B', color: BUS, text: 'M4102, 5500, 9003, 9301, 9400, 940, 9411' },
        { badge: 'B', color: BUS, text: '103, 109, 143, 150, 151, 160, 161, 162, 171, 172, 260, 270, 271, 273, 370, 601, 606' },
      ],
    },
    marketMap: {
      heading: 'Chợ Osaek Osan: Chợ truyền thống tiêu biểu của Osan, đầy ắp ẩm thực, cảnh đẹp và giải trí',
      description: [
        '* Tìm kiếm cửa hàng, thử hanbok bằng AR, gợi ý lộ trình bằng AI, thông tin thời tiết, thông tin tỷ giá và nhiều hơn nữa —',
        'hãy trải nghiệm bảng hiệu AI của chợ Osaek mang đến đủ loại thông tin và trải nghiệm~',
        "(Hãy cùng gặp 'JEONG-I', trợ lý quảng bá của chợ nhé!)",
      ],
      kioskTitle: '"WITH" = WIT AI SMART KIOSK vị trí lắp đặt',
      kioskLoc: 'Ngã tư chính chợ Osaek (trước Hội thương nhân chợ Osaek)',
    },
  },
  th: {
    title: 'แนะนำการเดินทาง',
    tabs: ['ขนส่งสาธารณะ', 'แผนที่ตลาดโอแซก', 'เส้นทางแดง', 'เส้นทางเขียว', 'ถนนสไมล์', 'ถนนอารึม', 'ถนนมัม', 'อื่นๆ'],
    comingSoon: 'กำลังเตรียมการ',
    transit: {
      heading: 'รถไฟใต้ดิน / รถบัส',
      subtitle: 'ขนส่งสาธารณะ',
      subwayRows: [
        [
          { badge: '1', color: SUB1, text: 'สาย 1 · สถานีจงกัก ทางออก 11' },
          { badge: '3', color: SUB3, text: 'สาย 3 · สถานีอันกุก ทางออก 6' },
        ],
        [{ badge: '5', color: SUB5, text: 'สาย 5 · สถานีจงโน 3-กา ทางออก 5' }],
      ],
      busRows: [
        { badge: 'B', color: BUS, text: 'M4102, 5500, 9003, 9301, 9400, 940, 9411' },
        { badge: 'B', color: BUS, text: '103, 109, 143, 150, 151, 160, 161, 162, 171, 172, 260, 270, 271, 273, 370, 601, 606' },
      ],
    },
    marketMap: {
      heading: 'ตลาดโอแซกโอซาน: ตลาดดั้งเดิมตัวแทนของโอซานที่เต็มไปด้วยของกิน ของน่าชม และความสนุก',
      description: [
        '* ค้นหาร้านค้า ลองสวมฮันบกด้วย AR แนะนำเส้นทางด้วย AI ข้อมูลสภาพอากาศ ข้อมูลอัตราแลกเปลี่ยน และอื่นๆ —',
        'มาสัมผัสป้ายดิจิทัล AI ของตลาดโอแซกที่มอบข้อมูลและประสบการณ์หลากหลายกันเถอะ~',
        "(มาพบกับ 'JEONG-I' ผู้ช่วยประชาสัมพันธ์ของตลาดด้วยนะ!)",
      ],
      kioskTitle: '"WITH" = WIT AI SMART KIOSK จุดติดตั้ง',
      kioskLoc: 'สี่แยกหลักตลาดโอแซก (หน้าสมาคมพ่อค้าตลาดโอแซก)',
    },
  },
  ru: {
    title: 'Транспорт',
    tabs: ['Общественный транспорт', 'Карта рынка Осэк', 'Красный маршрут', 'Зелёный маршрут', 'Улица Smile', 'Улица Areum', 'Улица Mom’s', 'Другое'],
    comingSoon: 'В процессе подготовки',
    transit: {
      heading: 'Метро / Автобус',
      subtitle: 'Общественный транспорт',
      subwayRows: [
        [
          { badge: '1', color: SUB1, text: 'Линия 1 · Ст. Чонгак, выход 11' },
          { badge: '3', color: SUB3, text: 'Линия 3 · Ст. Ангук, выход 6' },
        ],
        [{ badge: '5', color: SUB5, text: 'Линия 5 · Ст. Чонно 3-га, выход 5' }],
      ],
      busRows: [
        { badge: 'B', color: BUS, text: 'M4102, 5500, 9003, 9301, 9400, 940, 9411' },
        { badge: 'B', color: BUS, text: '103, 109, 143, 150, 151, 160, 161, 162, 171, 172, 260, 270, 271, 273, 370, 601, 606' },
      ],
    },
    marketMap: {
      heading: 'Рынок Осэк в Осане: главный традиционный рынок Осана, полный еды, достопримечательностей и развлечений',
      description: [
        '* Поиск магазинов, AR-примерка ханбока, рекомендации маршрутов от ИИ, погода, курсы валют и многое другое —',
        'познакомьтесь с ИИ-вывеской рынка Осэк, которая предлагает самую разную информацию и впечатления~',
        "(Приходите познакомиться с 'JEONG-I', помощником по продвижению рынка!)",
      ],
      kioskTitle: '"WITH" = WIT AI SMART KIOSK место установки',
      kioskLoc: 'Главный перекрёсток рынка Осэк (перед Ассоциацией торговцев)',
    },
  },
  id: {
    title: 'Petunjuk Transportasi',
    tabs: ['Transportasi Umum', 'Peta Pasar Osaek', 'Jalur Merah', 'Jalur Hijau', 'Jalan Smile', 'Jalan Areum', "Jalan Mom's", 'Lainnya'],
    comingSoon: 'Sedang dipersiapkan',
    transit: {
      heading: 'Kereta Bawah Tanah / Bus',
      subtitle: 'Transportasi Umum',
      subwayRows: [
        [
          { badge: '1', color: SUB1, text: 'Jalur 1 · Stasiun Jonggak Pintu Keluar 11' },
          { badge: '3', color: SUB3, text: 'Jalur 3 · Stasiun Anguk Pintu Keluar 6' },
        ],
        [{ badge: '5', color: SUB5, text: 'Jalur 5 · Stasiun Jongno 3-ga Pintu Keluar 5' }],
      ],
      busRows: [
        { badge: 'B', color: BUS, text: 'M4102, 5500, 9003, 9301, 9400, 940, 9411' },
        { badge: 'B', color: BUS, text: '103, 109, 143, 150, 151, 160, 161, 162, 171, 172, 260, 270, 271, 273, 370, 601, 606' },
      ],
    },
    marketMap: {
      heading: 'Pasar Osaek Osan: pasar tradisional unggulan Osan yang penuh kuliner, pemandangan, dan hiburan',
      description: [
        '* Pencarian toko, pas hanbok dengan AR, rekomendasi rute AI, info cuaca, info nilai tukar, dan lainnya —',
        'nikmati papan digital AI Pasar Osaek yang menyediakan beragam informasi dan pengalaman~',
        "(Temui juga 'JEONG-I', asisten promosi pasar!)",
      ],
      kioskTitle: '"WITH" = WIT AI SMART KIOSK lokasi pemasangan',
      kioskLoc: 'Persimpangan utama Pasar Osaek (di depan Asosiasi Pedagang Pasar Osaek)',
    },
  },
};

/** 골목/거리 tabs (2–6) share the 오색시장지도 layout; only the map crop differs.
 *  Sizes are the exact Figma frame dims (artboard px); aspect ratios match the
 *  images so ZoomableImage (object-fit: contain) fills with no gutters.
 *  Wide crops span the full 1740 body width; 맘스거리 is a centred 984 column. */
const STREET_MAPS: Record<number, { src: string; w: number; h: number }> = {
  2: { src: streetRed, w: 1740, h: 344 }, // 빨강길
  3: { src: streetGreen, w: 1740, h: 338 }, // 녹색길
  4: { src: streetSmile, w: 1740, h: 154 }, // 미소거리
  5: { src: streetAreum, w: 1740, h: 1406 }, // 아름거리
  6: { src: streetMoms, w: 984, h: 1379 }, // 맘스거리
};

function BadgePill({ b }: { b: Badge }): JSX.Element {
  return (
    <div className={styles.transitItem}>
      <span className={styles.badge} style={{ background: b.color }}>
        {b.badge}
      </span>
      <span className={styles.transitText}>{b.text}</span>
    </div>
  );
}

interface OsanTransportProps {
  controller: KioskController;
  /** 0 = 대중교통 (default, from 교통안내 tile), 1 = 오색시장지도 (from 지도 tile). */
  initialTab?: number;
}

/** 교통안내 — public transit + 오색시장 map (Figma 오산>교통안내). Only the first
 *  two tabs have content; the market-zone tabs show a 준비중 placeholder. */
export function OsanTransport({ controller, initialTab = 0 }: OsanTransportProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLanguageStore((s) => s.currentLanguage);
  const c = pick(CONTENT, lang);
  const [tab, setTab] = useState(initialTab);

  const row1 = c.tabs.slice(0, 5);
  const row2 = c.tabs.slice(5);

  return (
    <>
      {osanIconUrl('bg') && <img className={styles.bg} src={osanIconUrl('bg')} alt="" draggable={false} />}

      <OsanHeader title={c.title} subtitle={t('SubHeader_Transport', lang)} onHome={goHome} />

      <div className={styles.results}>
        {/* Category tabs — Figma: 2 rows (5 + 3). */}
        <div className={styles.tabs}>
          <div className={styles.tabRow1}>
            {row1.map((label, i) => (
              <button
                key={i}
                type="button"
                className={`${styles.tab} ${tab === i ? styles.tabSelected : ''}`}
                onClick={() => setTab(i)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={styles.tabRow2}>
            {row2.map((label, i) => (
              <button
                key={i + 5}
                type="button"
                className={`${styles.tab} ${tab === i + 5 ? styles.tabSelected : ''}`}
                onClick={() => setTab(i + 5)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === 0 ? (
          /* ── 대중교통 ── */
          <div className={`${styles.card} ${styles.cardTransit}`}>
            <div className={styles.transitTop}>
              <div className={styles.transitHead}>
                <span className={styles.transitHeading}>{c.transit.heading}</span>
                <span className={styles.transitSub}>
                  <span className={styles.dot} />
                  {c.transit.subtitle}
                </span>
              </div>
              <div className={styles.mapWrap}>
                <ZoomableImage className={styles.mapZoom} src={transitMap} />
              </div>
            </div>

            <div className={styles.infoRow}>
              {osanIconUrl('marker') && <img className={styles.markerIcon} src={osanIconUrl('marker')} alt="" draggable={false} />}
              <div className={styles.subwayCol}>
                {c.transit.subwayRows.map((rowItems, i) => (
                  <div key={i} className={styles.subwayRow}>
                    {rowItems.map((b, j) => (
                      <BadgePill key={j} b={b} />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.infoRow}>
              {osanIconUrl('marker') && <img className={styles.markerIcon} src={osanIconUrl('marker')} alt="" draggable={false} />}
              <div className={styles.busCol}>
                {c.transit.busRows.map((b, i) => (
                  <BadgePill key={i} b={b} />
                ))}
              </div>
            </div>
          </div>
        ) : tab === 1 ? (
          /* ── 오색시장지도 — heading title above the (zoomable) market map ── */
          <div className={`${styles.card} ${styles.cardMarket}`}>
            <p className={styles.marketHeading}>{c.marketMap.heading}</p>
            <div className={styles.marketMapWrap}>
              <ZoomableImage className={styles.mapZoom} src={marketMap} />
            </div>
            <div className={styles.marketBottom}>
              <div className={`${styles.marketDesc} ${styles.marketDescLeft}`}>
                {c.marketMap.description.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </div>
              <div className={styles.kioskBlock}>
                <p className={styles.kioskTitle}>{c.marketMap.kioskTitle}</p>
                <p className={styles.kioskLoc}>{c.marketMap.kioskLoc}</p>
              </div>
            </div>
          </div>
        ) : STREET_MAPS[tab] ? (
          /* ── 골목/거리 tabs (빨강길·녹색길·미소거리·아름거리·맘스거리) — same
             오색시장지도 layout, street-specific map crop ── */
          <div className={`${styles.card} ${styles.cardMarket}`}>
            <p className={styles.marketHeading}>{c.marketMap.heading}</p>
            <div
              className={styles.streetMapWrap}
              style={{ width: STREET_MAPS[tab]!.w, height: STREET_MAPS[tab]!.h }}
            >
              <ZoomableImage className={styles.mapZoom} src={STREET_MAPS[tab]!.src} />
            </div>
            <div className={styles.marketBottom}>
              <div className={`${styles.marketDesc} ${styles.marketDescLeft}`}>
                {c.marketMap.description.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </div>
              <div className={styles.kioskBlock}>
                <p className={styles.kioskTitle}>{c.marketMap.kioskTitle}</p>
                <p className={styles.kioskLoc}>{c.marketMap.kioskLoc}</p>
              </div>
            </div>
          </div>
        ) : (
          /* ── 기타 (Other) — not ready yet (placeholder image + 준비중) ── */
          <div className={`${styles.card} ${styles.cardEmpty}`}>
            {osanIconUrl('coming-soon') && (
              <img className={styles.comingSoonImg} src={osanIconUrl('coming-soon')} alt="" draggable={false} />
            )}
            <p className={styles.comingSoon}>{c.comingSoon}</p>
          </div>
        )}
      </div>

      <OsanLeftNav onHome={goHome} />

      <OsanBanner onClick={() => controller.startPhoto()} />
    </>
  );
}
