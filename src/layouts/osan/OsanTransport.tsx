import { type CSSProperties, useRef, useState } from 'react';
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { sheetText, tExact } from '@renderer/lib/loc';
import transitMap from '@renderer/assets/photos/osan/transport/transit-map.png';
import marketMap from '@renderer/assets/photos/osan/transport/market-map.png';
import streetRed from '@renderer/assets/photos/osan/transport/street-red.png';
import streetGreen from '@renderer/assets/photos/osan/transport/street-green.png';
import streetSmile from '@renderer/assets/photos/osan/transport/street-smile.png';
import streetAreum from '@renderer/assets/photos/osan/transport/street-areum.png';
import momsWindowMap from '@renderer/assets/photos/osan/transport/street-moms-window.png';
import badgeB1 from '@renderer/assets/photos/osan/transport/transit-badge-b1.svg';
import badgeB2 from '@renderer/assets/photos/osan/transport/transit-badge-b2.svg';
import transitDot from '@renderer/assets/photos/osan/transport/transit-dot.svg';
import transitMarker from '@renderer/assets/photos/osan/transport/transit-marker.svg';
import { OsanHeader } from './OsanHeader';
import { OsanBanner } from './OsanBanner';
import { ZoomableImage } from '../insadong/ZoomableImage';
import { OsanLeftNav } from './OsanLeftNav';
import styles from './OsanTransport.module.css';
import { useFitText } from '@layouts/components/fitText';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';

type Lang = SupportedLanguage;
function pick<T>(map: Partial<Record<Lang, T>>, lang: Lang): T {
  return (map[lang] ?? map.ko ?? (Object.values(map)[0] as T)) as T;
}

interface Badge { badge: string; color: string; text: string; /** Badge circle key (defaults to `badge`). */ icon?: string }

interface TransportContent {
  title: string;
  tabs: string[];
  comingSoon: string;
  marketMap: {
    heading: string;
    description: string[];
    kioskTitle: string;
    kioskLoc: string;
  };
}

/**
 * 버스 rows — Localization_Osaek `Transport_BusInfo_1` (일반) and
 * `Transport_BusInfo_2` (광역 … 오산역 버스터미널 정차). Route numbers are in the
 * sheet text itself. 오산 has no subway block: the 1/3/5호선 rows this page used
 * to carry (종각 / 안국 / 종로3가) were 인사동's and are gone.
 */
const BUS_ROW_KEYS: { key: string; icon: string; color: string }[] = [
  { key: 'Transport_BusInfo_1', icon: 'B2', color: '#428BC1' }, // 일반 — blue badge
  { key: 'Transport_BusInfo_2', icon: 'B1', color: '#FF733F' }, // 광역 — red badge
];

/** Sheet cells may carry a literal two-char "\\n" as well as a real break. */
function sheetLines(text: string): string[] {
  return text
    .split(/\r?\n|\\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Tab labels, in tab order — Localization_Osaek rows; CONTENT.tabs is the
 *  per-language fallback for a cell the sheet leaves empty. */
const TAB_KEYS = [
  'Transport_Public',
  'Transport_Map',
  'Transport_Red_Road',
  'Transport_Green_Road',
  'Transport_Miso_Road',
  'Transport_Arum_Road',
  'Transport_Moms_Road',
] as const;

const CONTENT: Partial<Record<Lang, TransportContent>> = {
  ko: {
    title: '교통안내',
    tabs: ['대중교통', '오색시장지도', '빨강길', '녹색길', '미소거리', '아름거리', '맘스거리'],
    comingSoon: '준비 중입니다',
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
    tabs: ['Public Transit', 'Market Map', 'Red St.', 'Green St.', 'Smile St.', 'Areum St.', "Mom's St."],
    comingSoon: 'Coming soon',
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
    tabs: ['公共交通', '五色市場地図', 'レッドロード', 'グリーンロード', 'スマイル通り', 'アルム通り', 'マムズ通り'],
    comingSoon: '準備中です',
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
    tabs: ['公共交通', '五色市场地图', '红色路', '绿色路', '微笑街', '美丽街', '妈妈街'],
    comingSoon: '准备中',
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
    tabs: ['Giao thông công cộng', 'Bản đồ chợ Osaek', 'Đường Đỏ', 'Đường Xanh', 'Phố Smile', 'Phố Areum', "Phố Mom's"],
    comingSoon: 'Đang chuẩn bị',
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
    tabs: ['ขนส่งสาธารณะ', 'แผนที่ตลาดโอแซก', 'เส้นทางแดง', 'เส้นทางเขียว', 'ถนนสไมล์', 'ถนนอารึม', 'ถนนมัม'],
    comingSoon: 'กำลังเตรียมการ',
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
    tabs: ['Общественный транспорт', 'Карта рынка Осэк', 'Красный маршрут', 'Зелёный маршрут', 'Улица Smile', 'Улица Areum', 'Улица Mom’s'],
    comingSoon: 'В процессе подготовки',
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
    tabs: ['Transportasi Umum', 'Peta Pasar Osaek', 'Jalur Merah', 'Jalur Hijau', 'Jalan Smile', 'Jalan Areum', "Jalan Mom's"],
    comingSoon: 'Sedang dipersiapkan',
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
 *  Sizes are Figma artboard px (7878:12298 빨강길, 12409 녹색길, 12583 미소거리,
 *  12674 아름거리, 12765 맘스거리). `gaps` override the default 100px between
 *  heading → map → description. `window` is 맘스거리: a clipped window (Figma
 *  7865:84292) onto the full 오색시장 map, positioned relative to that window. */
interface StreetMap {
  src: string;
  w: number;
  h: number;
  cardH: number;
  gaps?: { head: number; bottom: number };
  window?: { left: number; top: number; w: number; h: number };
}

const STREET_MAPS: Record<number, StreetMap> = {
  2: { src: streetRed, w: 1740, h: 344, cardH: 1426 }, // 빨강길
  3: { src: streetGreen, w: 1740, h: 338, cardH: 1426 }, // 녹색길
  4: { src: streetSmile, w: 1740, h: 154, cardH: 1426 }, // 미소거리
  5: { src: streetAreum, w: 1508, h: 1219, cardH: 2075 }, // 아름거리
  6: {
    src: momsWindowMap,
    w: 879,
    h: 1333,
    cardH: 2075,
    gaps: { head: 40.5, bottom: 45.5 },
    window: { left: -2699, top: -454, w: 4013, h: 2404 },
  }, // 맘스거리
};

const BADGE_ICON: Record<string, string> = {
  B1: badgeB1,
  B2: badgeB2,
};

function BadgePill({ b, bus = false }: { b: Badge; bus?: boolean }): JSX.Element {
  return (
    <div className={`${styles.transitItem} ${bus ? styles.busItem : ''}`}>
      <span className={`${styles.badge} ${bus ? styles.badgeBus : ''}`}>
        <img className={styles.badgeImg} src={BADGE_ICON[b.icon ?? b.badge]} alt="" draggable={false} />
        <span className={styles.badgeLabel}>{b.badge}</span>
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
/** The sheet's Transport_MapInfo is a full sentence — longer than the old
 *  one-line Korean title the CSS keeps on one row — so it wraps in every
 *  language (as `.long .marketHeading` already does for the others). */
const HEADING_WRAP = {
  whiteSpace: 'normal',
  wordBreak: 'keep-all',
  overflowWrap: 'normal',
  textWrap: 'balance',
} as CSSProperties;

/** ♿ card tops by tab index (see OsanTransport). */
const LOW_CARD_TOP: Record<number, number> = { 0: 987, 1: 944, 2: 1570, 3: 1580, 4: 1570, 5: 1047, 6: 1024 };

export function OsanTransport({ controller, initialTab = 0 }: OsanTransportProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLanguageStore((s) => s.currentLanguage);
  const c = pick(CONTENT, lang);
  /* Sheet first (Localization_Osaek), the authored CONTENT behind it. */
  const tabs = TAB_KEYS.map((key, i) => tExact(key, lang) || c.tabs[i] || '');
  const busRows: Badge[] = BUS_ROW_KEYS.map(({ key, icon, color }) => ({
    badge: 'B',
    icon,
    color,
    text: sheetText(key, lang),
  })).filter((b) => b.text);
  const market = {
    heading: tExact('Transport_MapInfo', lang) || c.marketMap.heading,
    description: (() => {
      const lines = sheetLines(tExact('Transport_MapContent_1', lang));
      return lines.length ? lines : c.marketMap.description;
    })(),
    kioskTitle: tExact('Transport_MapContent_2', lang) || c.marketMap.kioskTitle,
    kioskLoc: tExact('Transport_MapContent_3', lang) || c.marketMap.kioskLoc,
  };
  /* Korean tab names fit the tab on one line; the other languages do not.
     See "Other languages" in the CSS. */
  const wide = lang !== 'ko';
  const tabsRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(initialTab);
  const street: StreetMap | undefined = STREET_MAPS[tab];

  const row1 = tabs.slice(0, 5);
  const row2 = tabs.slice(5);

  useFitText(tabsRef, styles.tabLabel, wide, 0.72, lang, 'ink', 0.5);

  /*
   * ♿ (교통안내 7894:54695 오색시장 지도, 7894:54761 빨강길): the page keeps
   * OsanKiosk's shift and the tabs drop to the foot (3213). A street map short
   * enough to fit (빨강길 / 녹색길 / 미소거리, card 1426) gets 빨강길's layout:
   * promo at 146, header at 719, card at 1572. Everything else — 대중교통, the
   * 오색시장 map, 기타, and the tall 아름거리 / 맘스거리 crops, which would run
   * into the tabs there — keeps the shifted header with no promo, card at 946.
   */
  const low = useAccessibilityStore((s) => s.lowReach);
  const lowPromo = low && !!street && street.cardH <= 1426;
  /* Card top per tab, measured off each ♿ frame (대중교통 7887:54432, 지도
     7894:54695, 빨강길 7894:54761, 녹색길 7894:54826, 미소거리 7894:54891, 아름거리
     7894:54956, 맘스거리 7894:55020). 기타 has no frame and takes the map's. */
  const lowCardTop = LOW_CARD_TOP[tab] ?? LOW_CARD_TOP[1]!;
  const header = <OsanHeader title="교통안내" subtitle={sheetText('Transport_Subtitle', lang) || sheetText('SubHeader_Transport', lang) || undefined} onHome={goHome} />;

  return (
    <div
      className={
        [low && styles.low, low && tab === 0 && styles.lowTransit, wide && styles.long].filter(Boolean).join(' ') ||
        undefined
      }
      style={{ display: 'contents', ['--low-card-top' as string]: `${lowCardTop}px` }}
    >
      {osanIconUrl('page-bg') && <img className={styles.bg} src={osanIconUrl('page-bg')} alt="" draggable={false} />}

      {lowPromo ? <div className={styles.lowHeader}>{header}</div> : header}

      <div className={styles.results}>
        {/* Category tabs — Figma: 2 rows (5 + 3). */}
        <div ref={tabsRef} className={styles.tabs}>
          <div className={styles.tabRow1}>
            {row1.map((label, i) => (
              <button
                key={i}
                type="button"
                className={`${styles.tab} ${wide ? styles.tabLong : ''} ${tab === i ? styles.tabSelected : ''}`}
                onClick={() => setTab(i)}
              >
                <span className={styles.tabLabel}>{label}</span>
              </button>
            ))}
          </div>
          <div className={styles.tabRow2}>
            {row2.map((label, i) => (
              <button
                key={i + 5}
                type="button"
                className={`${styles.tab} ${wide ? styles.tabLong : ''} ${tab === i + 5 ? styles.tabSelected : ''}`}
                onClick={() => setTab(i + 5)}
              >
                <span className={styles.tabLabel}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {tab === 0 ? (
          /* ── 대중교통 — Figma 7878:12899: header + map, bus list (오산 has no
                subway; the Figma's subway rows were 인사동's) ── */
          <div className={`${styles.card} ${styles.cardTransit}`}>
            <div className={styles.transitTop}>
              <div className={styles.transitHead}>
                <span className={styles.transitHeading}>{sheetText('Transport_Bus', lang)}</span>
                <span className={styles.transitSub}>
                  <img className={styles.transitDot} src={transitDot} alt="" draggable={false} />
                  {tabs[0]}
                </span>
              </div>
              <div className={styles.transitMapBox}>
                <ZoomableImage className={styles.mapZoom} src={transitMap} />
              </div>
            </div>

            <div className={styles.busSection}>
              <img className={styles.markerIcon} src={transitMarker} alt="" draggable={false} />
              <div className={styles.busCol}>
                {busRows.map((b, i) => (
                  <BadgePill key={i} b={b} bus />
                ))}
              </div>
            </div>
          </div>
        ) : tab === 1 ? (
          /* ── 오색시장지도 — heading title above the (zoomable) market map ── */
          <div className={`${styles.card} ${styles.cardMarket}`}>
            <p className={styles.marketHeading} style={HEADING_WRAP}>
              {market.heading}
            </p>
            <div className={styles.marketMapWrap}>
              <ZoomableImage className={styles.mapZoom} src={marketMap} />
            </div>
            <div className={styles.marketBottom}>
              <div className={styles.marketDesc}>
                {market.description.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </div>
              <div className={styles.kioskBlock}>
                <p className={styles.kioskTitle}>{market.kioskTitle}</p>
                <p className={styles.kioskLoc}>{market.kioskLoc}</p>
              </div>
            </div>
          </div>
        ) : street ? (
          /* ── 골목/거리 tabs (빨강길·녹색길·미소거리·아름거리·맘스거리) — same
             오색시장지도 layout, street-specific map crop ── */
          <div className={`${styles.card} ${styles.cardMarket} ${styles.cardStreet}`} style={{ height: street.cardH }}>
            <p className={styles.marketHeading} style={{ ...HEADING_WRAP, marginBottom: street.gaps?.head ?? 100 }}>
              {market.heading}
            </p>
            {street.window ? (
              <div className={styles.windowClip} style={{ width: street.w, height: street.h }}>
                <div
                  style={{
                    position: 'absolute',
                    left: street.window.left,
                    top: street.window.top,
                    width: street.window.w,
                    height: street.window.h,
                  }}
                >
                  <ZoomableImage className={styles.mapZoom} src={street.src} />
                </div>
              </div>
            ) : (
              <div className={styles.streetMapWrap} style={{ width: street.w, height: street.h }}>
                <ZoomableImage className={styles.mapZoom} src={street.src} />
              </div>
            )}
            <div className={styles.marketBottom} style={{ marginTop: street.gaps?.bottom ?? 100 }}>
              <div className={styles.marketDesc}>
                {market.description.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </div>
              <div className={styles.kioskBlock}>
                <p className={styles.kioskTitle}>{market.kioskTitle}</p>
                <p className={styles.kioskLoc}>{market.kioskLoc}</p>
              </div>
            </div>
          </div>
        ) : (
          /* ── Fallback for a tab with no content (placeholder image + 준비중).
                 The 기타 tab that used to land here was removed (2026-10-16). ── */
          <div className={`${styles.card} ${styles.cardEmpty}`}>
            {osanIconUrl('coming-soon') && (
              <img className={styles.comingSoonImg} src={osanIconUrl('coming-soon')} alt="" draggable={false} />
            )}
            <p className={styles.comingSoon}>{c.comingSoon}</p>
          </div>
        )}
      </div>

      <OsanLeftNav onHome={goHome} />

      {(!low || lowPromo) && <OsanBanner onClick={() => controller.startPhoto()} top={lowPromo ? 146 : undefined} />}
    </div>
  );
}
