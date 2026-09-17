/**
 * 제주 유네스코 유산 — Figma 6942:51016 (세계지질공원 state; 6908:51920 / 51916
 * carry the same 2026-09-08 revision). The page behind W008's 제주세계유산 home
 * tile (2026-09 redesign, home 6792:126444).
 *
 * One page, four tabs, one template. The revision over the first cut: the intro
 * line gained a QR badge, the prose panel became an ACCORDION (collapsed to the
 * quote + the first body lines over a fade, expanded by the 더보기 pill; body
 * type 38 → 45), and the 상점 검색 promo banner is back at the page foot with
 * the ※ 출처 line above it. The cards are still the shared 관광명소 card
 * (JejuAttractionCard), two rows on screen, in one hidden-scrollbar column
 * driven by the ▲▼ pair.
 *
 * The frames pin the accordion and scroll only the cards — but an EXPANDED
 * accordion has nowhere to grow in a pinned layout (the frames only draw the
 * collapsed state), so panel + cards scroll as one column; collapsed at rest it
 * renders the frame exactly.
 *
 * ── What is the design's and what is authored ───────────────────────────────
 * The intro line, the four pill labels and the 생물권/세계자연유산 panel copy are
 * transcribed VERBATIM from the frames. The 세계지질공원 and 인류무형문화유산
 * panels have no frame yet — their copy here is authored (short, factual) and
 * marked below; swap it for the designer's when those states land. The CARDS are
 * authored throughout: both frames fill every card with the same 성산일출봉
 * placeholder, so the real site lists (the actual UNESCO designations) are
 * written here instead.
 *
 * Every string resolves through sheetText, so Localization_Jeju can take any of
 * it over — copy fixes and the seven translations — without a release. No
 * Heritage_* rows exist in the sheet today; until they do, every language reads
 * the authored Korean (tab labels are the exception: authored in all eight).
 *
 * ── Card enrichment ─────────────────────────────────────────────────────────
 * Each authored site is matched by Korean name against the curated attractions
 * catalogue (the same rows 여기는 제주도 draws, loaded at boot), and a match
 * lends the card its photo, hours and localized name/address. 성산일출봉,
 * 만장굴, 천지연폭포 and friends are in that catalogue; a site that is not
 * (영천·효돈천, 서귀포층…) still draws its authored card over the shared
 * noimage plate. Tapping a card opens the shared 상세 in place — the matched
 * row's full card, or the authored fields with the rest absent (the detail card
 * renders absence as nothing; nothing is invented).
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import type { Shop } from '@shared/types/shop';
import type { Attraction } from '@shared/types/attraction';
import type { DetailItem } from '@renderer/store/detailStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useShopStore } from '@renderer/store/shopStore';
import { useAttractionStore } from '@renderer/store/attractionStore';
import { pick, type Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import {
  shopAddress,
  shopCategoryLabel,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopsForBase,
} from '@renderer/lib/shops';
import { trackEvent } from '@renderer/lib/analytics';
import { JejuAttractionCard } from './JejuAttractionCard';
import { JejuPageFrame } from './JejuPageFrame';
import { JejuSpotDetailCard } from './JejuSpotDetailCard';
import { belowModeBar, LOW_REACH_BANNER_HEIGHT } from './lowReach';
import styles from './JejuHeritage.module.css';

type TabId = 'biosphere' | 'natural' | 'geopark' | 'intangible';

/** The header title — also the analytics label space and the 상세 card's title. */
const TITLE = '제주 유네스코 유산';

/** One run of the panel: the orange lead quote, a Bold section title, or body. */
interface Block {
  kind: 'quote' | 'heading' | 'para';
  /** Localization_Jeju key that overrides `ko` when the operator fills it. */
  key: string;
  ko: string;
}

/** One authored heritage site. Address stays at the design's district depth. */
interface Site {
  name: string;
  address: string;
}

interface HeritageTab {
  id: TabId;
  labelKey: string;
  label: Record<string, string>;
  blocks: Block[];
  sites: Site[];
}

/**
 * The four designations, pill order as drawn (6900:50198). Pill labels are
 * authored in all eight languages; panel copy is Korean until the sheet's
 * Heritage_* rows arrive (see the header note).
 */
const TABS: readonly HeritageTab[] = [
  {
    id: 'biosphere',
    labelKey: 'Heritage_Biosphere',
    label: {
      ko: '생물권 보전지역',
      en: 'Biosphere Reserve',
      ja: '生物圏保護区',
      zh: '生物圈保护区',
      vi: 'Khu dự trữ sinh quyển',
      th: 'พื้นที่สงวนชีวมณฑล',
      ru: 'Биосферный резерват',
      id: 'Cagar Biosfer',
    },
    // 6900:50211 — verbatim.
    blocks: [
      {
        kind: 'quote',
        key: 'Heritage_Biosphere_Quote',
        ko: '“자연은 조상으로부터 물려받은 것이 아니라 후손에게서 잠시 빌려 온 것이다.”',
      },
      {
        kind: 'para',
        key: 'Heritage_Biosphere_Content_1',
        ko: '유네스코에서는 자연이 더 이상 인간에 의해 파괴되지 않고 더불어 공존할 수 있는 방법을 찾다가 1971년에 인간과 생물권계획(MAB)에 따라 생물권보전지역이라는 프로그램을 만들었다. 생물권보전지역에서는 인간이 자연을 잘 보전함으로서 자연으로부터 여러 가지 혜택을 얻고, 여기서 얻은 이익을 다시 자연을 보전하는데 이용하게 된다. 그렇게 되면 인간과 자연이 지속가능한 발전을 이룰 수 있을 것이다. 생물권보전지역은 세계적으로 뛰어난 생태계를 유네스코가 지정한 곳으로 국제적 위상이 올라갈 뿐만 아니라 지역주민들은 브랜드를 활용하여 다양한 혜택을 얻을 수 있다.',
      },
      {
        kind: 'para',
        key: 'Heritage_Biosphere_Content_2',
        ko: '생물권보전지역은 2016년 현재 120개국 669곳이 지정되어 있으며, 우리나라는 설악산(1982년), 제주도(2002년), 신안 다도해(2009년), 광릉숲(2010년), 고창(2013년)이 포함되어 있고, 북한에는 백두산, 묘향산, 구월산, 칠보산 등 4곳이 생물권보전지역으로 지정되어 있다. 생물권보전지역은 핵심구역과 완충구역, 협력(전이)구역으로 나뉘어져 있으며 핵심구역의 경우 생물다양성 보전이 최우선적으로 이뤄지는 지역으로 조사, 연구, 모니터링이 이루어지며 국내법으로 보호받는다. 핵심구역은 한라산국립공원 영천·효돈천 천연보호구역, 섶섬, 문섬·범섬 천연보호구역이다.',
      },
    ],
    // The reserve's core zones — the places the panel's own last sentence names.
    sites: [
      { name: '한라산국립공원', address: '제주특별자치도 제주시·서귀포시' },
      { name: '영천·효돈천', address: '제주특별자치도 서귀포시' },
      { name: '섶섬', address: '제주특별자치도 서귀포시 보목동' },
      { name: '문섬', address: '제주특별자치도 서귀포시 서귀동' },
      { name: '범섬', address: '제주특별자치도 서귀포시 법환동' },
    ],
  },
  {
    id: 'natural',
    labelKey: 'Heritage_Natural',
    label: {
      ko: '세계자연유산',
      en: 'World Natural Heritage',
      ja: '世界自然遺産',
      zh: '世界自然遗产',
      vi: 'Di sản thiên nhiên thế giới',
      th: 'มรดกโลกทางธรรมชาติ',
      ru: 'Всемирное природное наследие',
      id: 'Warisan Alam Dunia',
    },
    // 6900:51909 — verbatim, including the two Bold section titles.
    blocks: [
      {
        kind: 'para',
        key: 'Heritage_Natural_Content_1',
        ko: "제주도는 동서로 약 73㎞, 남북으로 31㎞인 타원형 모양의 화산섬으로, 섬 중심부에 높이 1,950m의 한라산이 우뚝 솟아 있다. 화산활동으로 만들어진 제주도는 섬 전체가 '화산 박물관'이라 할 만큼 다양하고 독특한 화산 지형을 자랑한다. 땅 위에는 크고 작은 368개 오름(소규모 화산체를 뜻하는 제주어)이 펼쳐져 있고, 땅 아래에는 160여 개의 용암동굴이 섬 전역에 흩어져 있는데, 작은 섬 하나에 이렇게 많은 오름과 동굴이 있는 경우는 세계적으로도 매우 드물다.",
      },
      {
        kind: 'para',
        key: 'Heritage_Natural_Content_2',
        ko: '이러한 제주의 가치를 인정받아 2007년 6월 세계유산위원회의 만장일치로 세계자연유산에 등재되었다. 이로써 제주는 2002년 생물권보전지역 지정을 시작으로 2007년 세계자연유산 등재, 2010년 세계지질공원 인증까지 UNESCO 3관왕을 달성한 것이다.',
      },
      {
        kind: 'heading',
        key: 'Heritage_Natural_Content_3_title',
        ko: '세계유산위원회의 만장일치로 결정된 아름다운 제주',
      },
      {
        kind: 'para',
        key: 'Heritage_Natural_Content_3',
        ko: "유네스코는 1972년 '세계문화 및 자연유산보호협약'을 채택하고, 인류전체를 위해 보호되어야 할 문화와 자연이 특별히 뛰어난 지역을 세계유산으로 등재하기 시작했다. 세계유산은 문화유산, 자연유산, 복합유산으로 구분되며, 2016년 기준 165개국 1,052건(문화유산 814점, 자연유산 203점, 복합유산 35점)이 등재되었다. 제주도는 2007년 우리나라 최초로 '제주 화산섬과 용암동굴'이라는 이름으로 세계자연유산에 등재되었으며 한라산 천연보호구역, 성산일출봉, 거문오름 용암동굴계 등 3개 지구로 제주도 전체 면적의 약 10%를 차지한다.",
      },
      {
        kind: 'heading',
        key: 'Heritage_Natural_Content_4_title',
        ko: '유네스코 세계자연유산 등재에 담긴 비화',
      },
      {
        kind: 'para',
        key: 'Heritage_Natural_Content_4',
        ko: '유네스코에 이미 전세계 화산지역이 35개 지역이 등록되어 있었기 때문에 유네스코에서는 더 이상 화산지역을 지정하지 않기로 결의되어 있었다.',
      },
      {
        kind: 'para',
        key: 'Heritage_Natural_Content_5',
        ko: "하지만 유네스코에 등록될 수 있는 한 가지 방법이 있었다. 바로 인간의 간섭을 받지 않은 처녀동굴이 발견되면 등록할 수 있는 것이었다. 유네스코 심사단이 제주도를 찾은 그날 전신주 공사 중 땅이 꺼지는 사건이 발생했고, 그곳에서 용천동굴이 발견되었다. 그 용천동굴로 인해 '유네스코'에 등록될 수 있었다.",
      },
      {
        kind: 'para',
        key: 'Heritage_Natural_Content_6',
        ko: '뉴질랜드 크라이스트처치 컨벤션 센터에서 열린 제 31차 총회에서 유네스코 세계유산 위원회 심사위원이 이런 말을 남겼다고 한다. "앞으로 화산과 용암동굴을 유네스코 세계자연유산에 등재하려면 제주도와 비교하라"',
      },
    ],
    // The three inscribed districts, with the lava-tube system's public caves.
    sites: [
      { name: '한라산 천연보호구역', address: '제주특별자치도 제주시·서귀포시' },
      { name: '성산일출봉', address: '제주특별자치도 서귀포시 성산읍 성산리' },
      { name: '거문오름', address: '제주특별자치도 제주시 조천읍 선흘리' },
      { name: '만장굴', address: '제주특별자치도 제주시 구좌읍 김녕리' },
      { name: '용천동굴', address: '제주특별자치도 제주시 구좌읍 월정리' },
      { name: '당처물동굴', address: '제주특별자치도 제주시 구좌읍 월정리' },
    ],
  },
  {
    id: 'geopark',
    labelKey: 'Heritage_Geopark',
    label: {
      ko: '세계지질공원',
      en: 'Global Geopark',
      ja: '世界ジオパーク',
      zh: '世界地质公园',
      vi: 'Công viên địa chất toàn cầu',
      th: 'อุทยานธรณีโลก',
      ru: 'Глобальный геопарк',
      id: 'Geopark Global',
    },
    // ★ AUTHORED — no Figma state for this tab yet; replace when it lands.
    blocks: [
      {
        kind: 'para',
        key: 'Heritage_Geopark_Content_1',
        ko: '제주도는 2010년 10월 섬 전체가 유네스코 세계지질공원으로 인증되었다. 세계지질공원은 지질학적으로 뛰어난 가치를 지닌 명소를 보전하면서 교육과 관광에 활용해 지역의 지속가능한 발전을 이루어 가는 유네스코 프로그램이다.',
      },
      {
        kind: 'para',
        key: 'Heritage_Geopark_Content_2',
        ko: '제주에는 한라산, 성산일출봉, 만장굴을 비롯해 산방산, 용머리해안, 수월봉, 중문·대포 주상절리대, 서귀포층, 천지연폭포 등의 대표 명소가 있어, 화산이 만든 다채로운 지형을 한 섬 안에서 모두 만날 수 있다.',
      },
    ],
    sites: [
      { name: '한라산', address: '제주특별자치도 제주시·서귀포시' },
      { name: '성산일출봉', address: '제주특별자치도 서귀포시 성산읍 성산리' },
      { name: '만장굴', address: '제주특별자치도 제주시 구좌읍 김녕리' },
      { name: '산방산', address: '제주특별자치도 서귀포시 안덕면 사계리' },
      { name: '용머리해안', address: '제주특별자치도 서귀포시 안덕면 사계리' },
      { name: '수월봉', address: '제주특별자치도 제주시 한경면 고산리' },
      { name: '중문·대포 주상절리대', address: '제주특별자치도 서귀포시 중문동' },
      { name: '서귀포층', address: '제주특별자치도 서귀포시 서홍동' },
      { name: '천지연폭포', address: '제주특별자치도 서귀포시 천지동' },
      { name: '우도', address: '제주특별자치도 제주시 우도면' },
      { name: '비양도', address: '제주특별자치도 제주시 한림읍 협재리' },
      { name: '선흘 곶자왈(동백동산)', address: '제주특별자치도 제주시 조천읍 선흘리' },
    ],
  },
  {
    id: 'intangible',
    labelKey: 'Heritage_Intangible',
    label: {
      ko: '인류무형문화유산',
      en: 'Intangible Cultural Heritage',
      ja: '無形文化遺産',
      zh: '人类非物质文化遗产',
      vi: 'Di sản văn hóa phi vật thể',
      th: 'มรดกภูมิปัญญาทางวัฒนธรรม',
      ru: 'Нематериальное наследие',
      id: 'Warisan Budaya Takbenda',
    },
    // ★ AUTHORED — no Figma state for this tab yet; replace when it lands.
    blocks: [
      {
        kind: 'para',
        key: 'Heritage_Intangible_Content_1',
        ko: '제주해녀문화는 기계 장치 없이 맨몸으로 바다에 들어가 해산물을 채취하는 제주 여성 공동체의 문화로, 2016년 유네스코 인류무형문화유산 대표목록에 등재되었다. 물질 기술과 잠수굿, 해녀노래가 어머니에서 딸로, 공동체 안에서 세대를 이어 전승되고 있다.',
      },
      {
        kind: 'para',
        key: 'Heritage_Intangible_Content_2',
        ko: '제주칠머리당영등굿은 바다의 평온과 풍어를 기원하며 음력 2월에 벌이는 제주 특유의 굿으로, 2009년 유네스코 인류무형문화유산에 등재되었다. 바람의 여신 영등할망을 맞이하고 보내는 제주섬 공동체 신앙의 원형을 간직하고 있다.',
      },
    ],
    sites: [
      { name: '제주해녀문화(해녀박물관)', address: '제주특별자치도 제주시 구좌읍 하도리' },
      { name: '제주칠머리당영등굿', address: '제주특별자치도 제주시 건입동' },
    ],
  },
];

/** 6900:50197 — the page's own lead line above the pills, both frames. */
const INTRO_KO =
  '제주는 2002년 생물권보전지역, 2007년 세계자연유산, 2010년 세계지질공원 인증으로 유네스코가 지정하는 자연과학분야 3개 분야를 동시에 달성한 지역이다. 또한 제주는 세계적 자연경관의 모든 테마(섬, 화산, 폭포, 해변, 국립공원, 동굴, 숲)를 모두 갖추고 있다.';

/** 6942:51602 — the attribution line under the cards. Data facts, not visitor
 *  copy, so it stays as drawn in every language. */
const SOURCE = '※ 출처: 한국문화정보원, VISIT JEJU';

/**
 * The intro row's QR (6942:51448) — "carry this on your phone". The frame's QR
 * is an unlabeled placeholder graphic, so the target is authored: the 제주
 * 세계유산본부's own site, the authority behind everything this page lists (and
 * the venue W008 stands in). Swap here if the operator names a different link.
 */
const HERITAGE_QR_URL = 'https://www.jeju.go.kr/wnhcenter/';

/** Same base-category fallback 여기는 제주도 uses while attractions are uncached. */
const ATTRACTION_BASE_CATEGORY = '제주 뭐하지';

/** The drill-down 상세 sits where the scroll column does; the column and the
 *  cards foot out at 3127, above the ※ 출처 line and the y3267 banner. */
const DETAIL_TOP = 1123;
const CONTENT_FOOT = 3127;

/** ♿ drill-down band — where the card column sits in each low-reach shape
 *  (6942:52400 / 6952:53995), footing out 50 above the foot tab pills. */
const LOW_DETAIL_TOP = 1272;
const LOW_DETAIL_TOP_BANNER = 2058;
const LOW_CONTENT_FOOT = 3485;

/** 더보기 / 접기 on the accordion pill (6942:51470). */
const READ_MORE = {
  ko: '더보기', en: 'Read more', ja: 'もっと見る', zh: '查看更多',
  vi: 'Xem thêm', th: 'ดูเพิ่มเติม', ru: 'Подробнее', id: 'Selengkapnya',
};
const COLLAPSE = {
  ko: '접기', en: 'Collapse', ja: '閉じる', zh: '收起',
  vi: 'Thu gọn', th: 'ย่อ', ru: 'Свернуть', id: 'Tutup',
};

/** One ▲▼ press ≈ one card row (730 + the 50 gap). */
const SCROLL_STEP = 780;

/** Spaces and the parenthetical dropped, for the name match below. */
const normName = (s: string): string => s.replace(/\(.*?\)/g, '').replace(/[\s·]/g, '');

/** Coordinates when the matched row carries them — JejuAbout's spotCoords rule:
 *  the Shop fallback has none, and the CMS's ungeocode 0/0 counts as none. */
const siteCoords = (s: Shop): { lat: number; lng: number } | null => {
  const { latitude, longitude } = s as Partial<Attraction>;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { lat: latitude, lng: longitude };
};

interface Props {
  controller: KioskController;
}

export function JejuHeritage({ controller }: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage) as Lang;
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const shops = useShopStore((s) => s.shops);
  const attractions = useAttractionStore((s) => s.attractions);
  const [tabId, setTabId] = useState<TabId>(TABS[0]!.id);
  /** The accordion — collapsed on arrival and on every tab switch. */
  const [expanded, setExpanded] = useState(false);
  /** The in-place drill-down; null is the panel + grid. */
  const [open, setOpen] = useState<{ site: Site; row?: Shop } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0]!;

  /** Curated catalogue first, shop fallback second — same order as JejuAbout,
   *  and for the same reason: empty attractions means "not cached yet". */
  const spots = useMemo(
    () => (attractions.length > 0 ? attractions : shopsForBase(shops, ATTRACTION_BASE_CATEGORY)),
    [attractions, shops],
  );

  /**
   * The catalogue row behind an authored site, by Korean name. Exact match
   * first; containment second, so 한라산국립공원 finds the catalogue's 한라산 and
   * 거문오름 finds 거문오름 용암동굴계. Containment needs 2+ chars on the
   * shorter side, which every name here has.
   */
  const rowFor = useMemo(() => {
    const index = spots.map((s) => ({ s, n: normName(shopName(s, 'ko')) }));
    return (site: Site): Shop | undefined => {
      const w = normName(site.name);
      return (
        index.find((e) => e.n === w)?.s ??
        index.find((e) => e.n.includes(w) || w.includes(e.n))?.s
      );
    };
  }, [spots]);

  const cards = useMemo(
    () => tab.sites.map((site) => ({ site, row: rowFor(site) })),
    [tab, rowFor],
  );

  /**
   * ♿: a tab whose sites fit one 3-card row keeps the 573 promo under the mode
   * bar and shows a single-row viewport (6952:53995, 인류무형문화유산); a taller
   * tab gives the banner up for a second card row (6942:52400, 생물권). The
   * header shift follows whichever the active tab draws.
   */
  const singleRow = cards.length <= 3;

  const [canScroll, setCanScroll] = useState(false);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    setCanScroll(!!el && el.scrollHeight > el.clientHeight + 1);
  }, [tabId, lang, open, expanded, lowReach]);

  const scrollBy = (delta: number): void =>
    scrollRef.current?.scrollBy({ top: delta, behavior: 'smooth' });

  const select = (id: TabId): void => {
    trackEvent({
      name: 'button_clicked',
      payload: { screen: 'heritage', tab: id, kioskId: controller.kioskId },
    });
    setTabId(id);
    setExpanded(false);
    setOpen(null);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const openSite = (site: Site, row?: Shop): void => {
    trackEvent({
      name: 'button_clicked',
      payload: { screen: 'heritage', tab: tabId, site: site.name, kioskId: controller.kioskId },
    });
    setOpen({ site, row });
  };

  /** Back closes the drill-down first, like every in-place 상세 on 제주. */
  const goBack = (): void => {
    if (open) setOpen(null);
    else controller.navigate('home', '뒤로');
  };

  /** The matched row's full card, or the authored fields with the rest absent. */
  const detailItem = (site: Site, row: Shop | undefined): DetailItem =>
    row
      ? {
          from: 'heritage',
          shopId: row.id,
          title: TITLE,
          name: shopName(row, lang),
          category: shopCategoryLabel(row, lang),
          photos: shopImages(row),
          address: shopAddress(row, lang),
          hours: row.openTime ?? '',
          phone: row.tel ?? '',
          description: shopDescription(row, lang),
          tags: shopHashtag(row, lang),
          rating: row.naverRating != null ? String(row.naverRating) : '',
          instagram: '',
          blogReviews: row.naverLink ?? '',
        }
      : {
          from: 'heritage',
          title: TITLE,
          name: site.name,
          category: sheetText(tab.labelKey, lang, tab.label),
          photos: [],
          address: site.address,
          hours: '',
          phone: '',
          description: '',
          tags: '',
          rating: '',
          instagram: '',
          blogReviews: '',
        };

  const detailMap = useMemo(
    () => (open?.row ? siteCoords(open.row) : null),
    [open],
  );

  const detailTop = lowReach
    ? singleRow
      ? LOW_DETAIL_TOP_BANNER
      : LOW_DETAIL_TOP
    : DETAIL_TOP;

  /* The four category pills — at y903 normally, in the foot group in ♿. */
  const tabPills = (
    <div className={`${styles.tabs} ${lowReach ? styles.tabsLow : ''}`}>
      {TABS.map(({ id, labelKey, label }) => (
        <button
          key={id}
          type="button"
          className={`${styles.tab} ${id === tabId ? styles.tabActive : ''}`}
          onClick={() => select(id)}
        >
          {sheetText(labelKey, lang, label)}
        </button>
      ))}
    </div>
  );

  /* Accordion (6942:51462): the quote stays visible; the body run is clipped
     behind the fade until 더보기 opens it. A tab with no quote simply collapses
     to its first body lines. In ♿ it sits pinned in the foot group, so the
     expanded run scrolls inside a cap instead of growing without bound. */
  const panel = (
    <div className={styles.panel}>
      {tab.blocks
        .filter((b) => b.kind === 'quote')
        .map((b) => (
          <p key={b.key} className={styles.quote}>
            {sheetText(b.key, lang, { ko: b.ko })}
          </p>
        ))}
      <div
        className={`${styles.panelBody} ${
          expanded ? (lowReach ? styles.panelBodyLowScroll : '') : styles.panelBodyCollapsed
        }`}
      >
        {tab.blocks
          .filter((b) => b.kind !== 'quote')
          .map((b) => (
            <p key={b.key} className={b.kind === 'heading' ? styles.heading : styles.para}>
              {sheetText(b.key, lang, { ko: b.ko })}
            </p>
          ))}
        {!expanded && <div className={styles.fade} />}
      </div>
      <button
        type="button"
        className={styles.readMore}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? `${pick(COLLAPSE, lang)} ▲` : `${pick(READ_MORE, lang)} ▼`}
      </button>
    </div>
  );

  const cardGrid = (
    <div className={styles.cards}>
      {cards.map(({ site, row }) => (
        <JejuAttractionCard
          key={site.name}
          name={row ? shopName(row, lang) : site.name}
          address={row ? shopAddress(row, lang) : site.address}
          hours={row?.openTime ? [row.openTime] : []}
          photo={row ? shopImages(row)[0] : undefined}
          onClick={() => openSite(site, row)}
        />
      ))}
    </div>
  );

  return (
    /* banner-detail: the revision foots every state out on the 상점 검색 promo,
       the same artwork 여기는 제주도 carries. ♿ is the mode-bar revision
       (6942:52400 / 6952:53995): bar at the top, banner kept under it only on a
       single-row tab, header dropped by bar (+banner), body self-laid-out. */
    <JejuPageFrame
      controller={controller}
      title={TITLE}
      onBack={goBack}
      bannerFallback="banner-detail"
      lowReachModeBar
      lowReachBarBanner={singleRow}
      lowReachShift={belowModeBar(singleRow ? LOW_REACH_BANNER_HEIGHT : 0)}
    >
      <div className={`${styles.introRow} ${lowReach ? styles.introRowLow : ''}`}>
        <p className={styles.intro}>{sheetText('Heritage_Intro', lang, { ko: INTRO_KO })}</p>
        <div className={styles.qrBadge}>
          <QRCodeSVG value={HERITAGE_QR_URL} level="M" bgColor="#fff" fgColor="#000" />
        </div>
      </div>

      {!lowReach && tabPills}

      {open ? (
        <JejuSpotDetailCard
          item={detailItem(open.site, open.row)}
          top={detailTop}
          gallery="row"
          map={detailMap}
          maxScrollHeight={(lowReach ? LOW_CONTENT_FOOT : CONTENT_FOOT) - detailTop}
          lang={lang}
        />
      ) : lowReach ? (
        /* ♿: the ※ 출처 line heads the card column and the accordion moves to
           the foot group, so the scroller holds ONLY the cards. */
        <div
          className={`${styles.scroller} ${
            singleRow ? styles.scrollerLowBanner : styles.scrollerLow
          }`}
          ref={scrollRef}
        >
          {cardGrid}
        </div>
      ) : (
        <div className={styles.scroller} ref={scrollRef}>
          {panel}
          {cardGrid}
        </div>
      )}

      {!(lowReach && open) && (
        <p
          className={`${styles.source} ${
            lowReach ? (singleRow ? styles.sourceLowBanner : styles.sourceLow) : ''
          }`}
        >
          {SOURCE}
        </p>
      )}

      {lowReach && (
        /* Accordion + pills at the foot, within seated reach. Collapsed it sits
           at the frames' y2940; expanded (or with only the pills left while the
           상세 is open) it anchors to the foot and grows upward. */
        <div
          className={`${styles.bottomGroupLow} ${
            expanded || open ? styles.bottomGroupLowFoot : ''
          }`}
        >
          {!open && panel}
          {tabPills}
        </div>
      )}

      {canScroll && !open && (
        <>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollUp} ${lowReach ? styles.scrollUpLow : ''}`}
            onClick={() => scrollBy(-SCROLL_STEP)}
            aria-label="위로"
          >
            {jejuIconUrl('scroll-arrow') && (
              <img src={jejuIconUrl('scroll-arrow')} alt="" className={styles.scrollBtnImg} draggable={false} />
            )}
          </button>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollDown} ${lowReach ? styles.scrollDownLow : ''}`}
            onClick={() => scrollBy(SCROLL_STEP)}
            aria-label="아래로"
          >
            {jejuIconUrl('scroll-arrow') && (
              <img src={jejuIconUrl('scroll-arrow')} alt="" className={styles.scrollBtnImg} draggable={false} />
            )}
          </button>
        </>
      )}
    </JejuPageFrame>
  );
}
