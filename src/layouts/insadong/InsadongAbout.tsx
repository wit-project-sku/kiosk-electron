import { useEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import iconMarker from '@renderer/assets/photos/insadong/ai/icon-marker.png';
import iconAlarm from '@renderer/assets/photos/insadong/ai/icon-alarm.png';
import historyHero from '@renderer/assets/photos/insadong/about/history-hero.png';
import historyThumb1 from '@renderer/assets/photos/insadong/about/history-thumb-1.png';
import historyThumb2 from '@renderer/assets/photos/insadong/about/history-thumb-2.png';
import historyThumb3 from '@renderer/assets/photos/insadong/about/history-thumb-3.png';
import historyThumb4 from '@renderer/assets/photos/insadong/about/history-thumb-4.png';
import historyThumb5 from '@renderer/assets/photos/insadong/about/history-thumb-5.png';
import cultureHanok from '@renderer/assets/photos/insadong/about/culture-hanok.png';
import cultureMarket from '@renderer/assets/photos/insadong/about/culture-market.png';
import cultureLife from '@renderer/assets/photos/insadong/about/culture-life.png';
import cultureFood from '@renderer/assets/photos/insadong/about/culture-food.png';
import timelineChevron from '@renderer/assets/photos/insadong/about/timeline-chevron.svg';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useLang, type Lang } from '@renderer/lib/i18n';
import { t, tExact } from '@renderer/lib/loc';
import {
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopOpenTime,
  shopSecondCategory,
} from '@renderer/lib/shops';
import { useShopStore } from '@renderer/store/shopStore';
import { useAttractionStore } from '@renderer/store/attractionStore';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { toLocalizedLang, type LocalizedLang } from '@shared/config/languages';
import type { Shop } from '@shared/types/shop';
import { useFitText } from '@layouts/components/fitText';
import { JejuSpotMap, type MapSpot } from '@layouts/jeju/JejuSpotMap';
import { InsadongHeader } from './InsadongHeader';
import { InsadongLeftNav } from './InsadongLeftNav';
import { SpotDetailCard, type SpotDetailData } from './SpotDetailCard';
import styles from './InsadongAbout.module.css';

interface InsadongAboutProps {
  controller: KioskController;
  debug?: boolean;
}

type AboutTab = 'attraction' | 'history' | 'culture';

const INITIALS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'] as const;
const CHOSEONG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const CHOSEONG_FOLD: Record<string, string> = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' };
/** One row of cards — card 730 + the 60 gap under it (7567:60844 − 60801). */
const SCROLL_STEP = 790;

/** Eat, shop, lodging, and help already have their own screens. Everything
 *  else in the Insadong catalogue (galleries, and any later place category)
 *  is a sight on this page. */
const RESERVED_BASES = new Set(['인사 뭐먹지', '인사 뭐사지', '인사동 숙박', '인사 도와줘']);

/**
 * A shop's pin position, or null when the row cannot be placed.
 *
 * `latitude` / `longitude` are NOT on the `Shop` type, but the API sends them
 * (84 columns on `/api/shops`) and normalizeShop spreads the raw row, so they
 * reach the renderer untouched — the same read 제주 makes via `Partial<Attraction>`.
 *
 * ⚠ As of this writing every 인사동 row has them NULL (0 of 822 on kiosk 1),
 * while 제주 has 661 of 661 — VERIFIED against production, not inferred from the
 * type. The map is drawn either way: OpenStreetMap tiles are global, so it opens
 * on this kiosk's own coordinates and pans and zooms like 제주's. Only the PINS
 * wait on the data, and they appear with no code change once it lands.
 */
const spotCoords = (s: Shop): { lat: number; lng: number } | null => {
  const { latitude, longitude } = s as Shop & { latitude?: unknown; longitude?: unknown };
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { lat: latitude, lng: longitude };
};

function shopInitial(name: string): string {
  const code = name.trim().charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return '';
  const cho = CHOSEONG[Math.floor((code - 0xac00) / 588)] ?? '';
  return CHOSEONG_FOLD[cho] ?? cho;
}

type L8 = Record<LocalizedLang, string>;
const L = (
  ko: string, en: string, ja: string, zh: string, vi: string, th: string, ru: string, id: string,
): L8 => ({ ko, en, ja, zh, vi, th, ru, id });
const say = (table: L8, lang: Lang): string => table[toLocalizedLang(lang)];

/**
 * ── 역사 / 문화 copy comes from Localization_Insa, not from this file ──────
 *
 * Every block below ships an eight-language `L(...)` table, and every block
 * reads its sheet row FIRST. The table is the fallback, so an operator editing
 * 역사 or 문화 needs no release, and a kiosk whose table predates the rows keeps
 * the copy it has today instead of rendering a key name.
 *
 * `tExact` is deliberate over `t`: a MISSING row must read as absent so the
 * fallback runs, and `t()` would hand back the key itself. This is the same
 * shape JejuAbout uses for its own `Here_HistoryContent_1..5` epochs.
 *
 * The sheet currently holds only the two original blobs (`Here_HistoryContent`,
 * `Here_CultureContent`), so today every one of these falls through — the rows
 * below are the names to add.
 */
const sheet = (key: string, fallback: L8, lang: Lang, ...also: string[]): string => {
  const row = tExact(key, lang);
  if (row) return row;
  /* Then the rows the sheet ALREADY has. `Here_HistoryContent` and
     `Here_CultureContent` are real operator copy in all eight languages; before
     this they were ignored in favour of the authored table, so the tab showed
     text nobody could edit even though the sheet had something to say. */
  for (const alt of also) {
    const legacy = tExact(alt, lang);
    if (legacy) return legacy;
  }
  return say(fallback, lang);
};

/**
 * Numbered rows, probed rather than fixed: `Here_History_Step_1_year` and so
 * on. An operator adding a sixth step needs no code change, and a step whose
 * row is blank keeps the authored one.
 */
const sheetAt = (key: string, n: number, field: string, fallback: L8, lang: Lang): string =>
  tExact(`${key}_${n}_${field}`, lang) || say(fallback, lang);

const HISTORY_THUMBS = [historyThumb1, historyThumb2, historyThumb3, historyThumb4, historyThumb5];

const HISTORY_INTRO_TITLE = L(
  '인사동 문화',
  'Insadong culture',
  '仁寺洞の文化',
  '仁寺洞文化',
  'Văn hóa Insadong',
  'วัฒนธรรมอินซาดง',
  'Культура Инсадона',
  'Budaya Insadong',
);
const HISTORY_INTRO = L(
  '인사동은 조선시대부터 서울의 중심 문화거리로, 골동품과 전통공예, 갤러리가 밀집한 곳으로 자리 잡았습니다. 관인방의 중심부에 위치하며, 서화와 골동품을 다루는 상점들이 형성되며 학문과 예술을 사랑하는 문화가 형성되었습니다.',
  'Since the Joseon Dynasty, Insadong has been a cultural street in the heart of Seoul, lined with antiques, traditional crafts, and galleries. At the center of Gwanin-bang, shops of calligraphy, painting, and antiques grew into a culture devoted to learning and art.',
  '仁寺洞は朝鮮時代からソウルの中心にある文化の通りで、骨董品や伝統工芸、ギャラリーが集まってきました。寛仁坊の中心で書画と骨董の店が育ち、学問と芸術を愛する文化が形づくられました。',
  '仁寺洞自朝鲜时代起就是首尔中心的文化街，古董、传统工艺和画廊聚集于此。它位于宽仁坊中心，书画与古董店铺逐渐形成了热爱学问与艺术的文化。',
  'Từ thời Joseon, Insadong đã là phố văn hóa ở trung tâm Seoul, với đồ cổ, thủ công truyền thống và phòng trưng bày. Ở giữa Gwanin-bang, các cửa hàng thư họa và đồ cổ đã nuôi dưỡng một nền văn hóa yêu học thuật và nghệ thuật.',
  'อินซาดงเป็นถนนวัฒนธรรมใจกลางโซลมาตั้งแต่สมัยโชซอน รวมของเก่า งานฝีมือ และแกลเลอรี ใจกลางกวานอินบัง ร้านภาพเขียนและของเก่าค่อย ๆ สร้างวัฒนธรรมที่รักวิชาการและศิลปะ',
  'С эпохи Чосон Инсадон — культурная улица в центре Сеула, где собраны антиквариат, традиционные ремёсла и галереи. В сердце Кванинбана лавки каллиграфии и древностей вырастили культуру, любящую учёность и искусство.',
  'Sejak zaman Joseon, Insadong adalah jalan budaya di pusat Seoul, penuh barang antik, kerajinan, dan galeri. Di tengah Gwanin-bang, toko kaligrafi dan barang antik menumbuhkan budaya yang mencintai ilmu dan seni.',
);
const HISTORY_FLOW = L(
  '인사동의 역사 흐름',
  'How Insadong took shape',
  '仁寺洞の歴史の流れ',
  '仁寺洞的历史脉络',
  'Dòng chảy lịch sử Insadong',
  'ลำดับประวัติศาสตร์อินซาดง',
  'Как складывался Инсадон',
  'Jejak sejarah Insadong',
);

const HISTORY_STEPS: { icon: string; year: L8; lines: [L8, L8] }[] = [
  {
    icon: '📖',
    year: L('조선시대', 'Joseon', '朝鮮時代', '朝鲜时代', 'Thời Joseon', 'สมัยโชซอน', 'Чосон', 'Joseon'),
    lines: [
      L('한성부 관인방', 'Hanseong Gwanin-bang', '漢城府 寛仁坊', '汉城府宽仁坊', 'Gwanin-bang, Hán Thành', 'กวานอินบัง ฮันซอง', 'Кванинбан Хансона', 'Gwanin-bang Hanseong'),
      L('형성', 'takes shape', '形成', '形成', 'hình thành', 'ก่อตัว', 'складывается', 'terbentuk'),
    ],
  },
  {
    icon: '🏺',
    year: L('일제강점기', 'Colonial period', '日本統治期', '日据时期', 'Thời thuộc địa', 'สมัยอาณานิคม', 'Колониальный период', 'Masa penjajahan'),
    lines: [
      L('인사동 명칭', 'The name Insadong', '仁寺洞の名', '仁寺洞之名', 'Tên Insadong', 'ชื่ออินซาดง', 'Имя Инсадон', 'Nama Insadong'),
      L('유래', 'appears', 'の由来', '的由来', 'ra đời', 'กำเนิด', 'появляется', 'muncul'),
    ],
  },
  {
    icon: '🏠',
    year: L('해방 이후', 'After liberation', '解放後', '光复之后', 'Sau giải phóng', 'หลังเอกราช', 'После освобождения', 'Setelah kemerdekaan'),
    lines: [
      L('골동품 거리', 'Antique street', '骨董の通り', '古董街', 'Phố đồ cổ', 'ถนนของเก่า', 'Улица древностей', 'Jalan barang antik'),
      L('형성', 'takes shape', '形成', '形成', 'hình thành', 'ก่อตัว', 'складывается', 'terbentuk'),
    ],
  },
  {
    icon: '🎨',
    year: L('1980년대', '1980s', '1980年代', '1980年代', 'Thập niên 1980', 'ทศวรรษ 1980', '1980-е', '1980-an'),
    lines: [
      L('갤러리·화랑', 'Galleries', 'ギャラリー・画廊', '画廊', 'Phòng tranh', 'แกลเลอรี', 'Галереи', 'Galeri'),
      L('거리', 'line the street', 'の通り', '街', 'dọc phố', 'เรียงราย', 'вдоль улицы', 'sepanjang jalan'),
    ],
  },
  {
    icon: '🎪',
    year: L('2000년대', '2000s', '2000年代', '2000年代', 'Thập niên 2000', 'ทศวรรษ 2000', '2000-е', '2000-an'),
    lines: [
      L('문화의 거리', 'Culture Street', '文化の通り', '文化街', 'Phố văn hóa', 'ถนนวัฒนธรรม', 'Улица культуры', 'Jalan Budaya'),
      L('지정', 'designated', 'に指定', '被指定', 'được công nhận', 'ได้รับการกำหนด', 'объявлена', 'ditetapkan'),
    ],
  },
  {
    icon: '✨',
    year: L('현재', 'Today', '現在', '现在', 'Hiện nay', 'ปัจจุบัน', 'Сегодня', 'Kini'),
    lines: [
      L('전통과 현대의', 'Tradition and today', '伝統と現代の', '传统与现代', 'Truyền thống và hiện đại', 'ดั้งเดิมและร่วมสมัย', 'Традиция и современность', 'Tradisi dan masa kini'),
      L('공존', 'side by side', '共存', '并存', 'cùng tồn tại', 'อยู่ร่วมกัน', 'рядом', 'berdampingan'),
    ],
  },
];

const HISTORY_JOSEON_TITLE = L(
  '조선시대의 인사동', 'Insadong in the Joseon era', '朝鮮時代の仁寺洞', '朝鲜时代的仁寺洞',
  'Insadong thời Joseon', 'อินซาดงสมัยโชซอน', 'Инсадон в эпоху Чосон', 'Insadong di zaman Joseon',
);
const HISTORY_JOSEON = L(
  '조선시대 한양의 중심부에 위치한 인사동은 관인방(寬仁坊)에 속했으며, 양반과 관료들이 거주하던 지역이었습니다. 이 일대에는 서화와 골동품을 다루는 상점들이 자리 잡기 시작했고, 학문과 예술을 사랑하는 문화가 형성되었습니다.',
  'In the Joseon capital of Hanyang, Insadong belonged to Gwanin-bang (寬仁坊), a neighborhood of yangban and officials. Shops of calligraphy, painting, and antiques began to settle here, and a culture devoted to learning and art took root.',
  '朝鮮時代、漢陽の中心にあった仁寺洞は寛仁坊に属し、両班と官僚が住む地域でした。この一帯に書画と骨董の店が集まり始め、学問と芸術を愛する文化が生まれました。',
  '朝鲜时代，位于汉阳中心的仁寺洞属于宽仁坊，是两班与官员居住的地区。书画和古董店铺开始在这一带落脚，热爱学问与艺术的文化由此形成。',
  'Thời Joseon, Insadong nằm ở trung tâm Hanyang, thuộc Gwanin-bang, nơi yangban và quan lại sinh sống. Các cửa hàng thư họa và đồ cổ bắt đầu tụ về, hình thành một nền văn hóa yêu học thuật và nghệ thuật.',
  'สมัยโชซอน อินซาดงอยู่ใจกลางฮันยาง ในเขตกวานอินบัง ที่ขุนนางและข้าราชการอาศัย ร้านภาพเขียนและของเก่าเริ่มตั้งขึ้น และวัฒนธรรมที่รักวิชาการกับศิลปะก็ก่อตัว',
  'В чосонском Ханяне Инсадон входил в Кванинбан, квартал янбанов и чиновников. Здесь стали селиться лавки каллиграфии и древностей, и выросла культура, любящая учёность и искусство.',
  'Pada zaman Joseon, Insadong di pusat Hanyang termasuk Gwanin-bang, tempat yangban dan pejabat tinggal. Toko kaligrafi dan barang antik mulai menetap, dan budaya yang mencintai ilmu serta seni terbentuk.',
);
const HISTORY_MODERN_TITLE = L(
  '근현대의 인사동', 'Insadong in modern times', '近現代の仁寺洞', '近现代的仁寺洞',
  'Insadong thời cận hiện đại', 'อินซาดงยุคใกล้และปัจจุบัน', 'Инсадон в новое время', 'Insadong di masa modern',
);
const HISTORY_MODERN = L(
  '일제강점기를 거치며 인사동은 민족 문화의 보존지로서 역할을 했습니다. 해방 이후 골동품과 고서적 거래의 중심지로 발전했으며, 1980년대부터 화랑과 갤러리가 밀집하면서 한국 미술시장의 핵심 거리로 자리매김했습니다. 2002년 문화의 거리로 지정되어 전통과 현대가 어우러진 서울의 대표적인 문화 명소가 되었습니다.',
  'Through the colonial period Insadong served as a place that kept Korean culture. After liberation it became a center for antiques and old books, and from the 1980s galleries gathered until it was the core street of the Korean art market. Named a Culture Street in 2002, it is one of Seoul’s landmarks where tradition and the present meet.',
  '日本統治期を通じて仁寺洞は民族文化を守る場所としての役割を果たしました。解放後は骨董と古書の取引の中心となり、1980年代から画廊とギャラリーが集まって韓国美術市場の中心の通りになりました。2002年に文化の通りに指定され、伝統と現代が調和するソウルの代表的な文化名所です。',
  '历经日据时期，仁寺洞承担了保存民族文化的角色。光复后成为古董与古书交易的中心，1980年代起画廊聚集，成为韩国美术市场的核心街道。2002年被指定为文化街，成为传统与现代交融的首尔代表性文化名胜。',
  'Qua thời thuộc địa, Insadong giữ vai trò gìn giữ văn hóa dân tộc. Sau giải phóng, nơi đây trở thành trung tâm đồ cổ và sách cũ, rồi từ thập niên 1980 các phòng tranh tụ về, biến nó thành phố cốt lõi của thị trường mỹ thuật Hàn Quốc. Năm 2002 được công nhận là Phố văn hóa, một địa danh của Seoul nơi truyền thống và hiện đại gặp nhau.',
  'ตลอดสมัยอาณานิคม อินซาดงเป็นที่รักษาวัฒนธรรมของชาติ หลังเอกราชกลายเป็นศูนย์กลางของเก่าและหนังสือเก่า และตั้งแต่ทศวรรษ 1980 หอศิลป์รวมตัวจนเป็นถนนหลักของตลาดศิลปะเกาหลี ปี 2002 ได้รับการกำหนดเป็นถนนวัฒนธรรม เป็นแลนด์มาร์กของโซลที่ประเพณีและปัจจุบันอยู่ร่วมกัน',
  'В колониальный период Инсадон хранил национальную культуру. После освобождения он стал центром торговли древностями и старыми книгами, а с 1980-х галереи сделали его главной улицей корейского арт-рынка. В 2002 году улицу объявили культурной — это одна из достопримечательностей Сеула, где традиция встречается с настоящим.',
  'Sepanjang masa penjajahan, Insadong menjaga budaya bangsa. Setelah kemerdekaan ia menjadi pusat barang antik dan buku lama, lalu sejak 1980-an galeri berkumpul hingga jalan ini menjadi inti pasar seni Korea. Ditetapkan sebagai Jalan Budaya pada 2002, ia adalah tengara Seoul tempat tradisi dan masa kini bertemu.',
);
const HISTORY_NOW = L(
  '지금의 인사동', 'Insadong today', '今の仁寺洞', '今天的仁寺洞',
  'Insadong hôm nay', 'อินซาดงวันนี้', 'Инсадон сегодня', 'Insadong hari ini',
);

const CULTURE_LEAD = L(
  '인사동은 전통과 현대가 공존하는 서울의 대표 문화지대로, 한옥과 전통시장, 전통공예, 예술과 음식이 어우러진 고유한 문화를 체험할 수 있습니다.',
  'Insadong is one of Seoul’s great cultural districts, where tradition and the present share the same streets. Hanok, the traditional market, crafts, art, and food come together as a culture you can walk through.',
  '仁寺洞は伝統と現代が共存するソウルを代表する文化地域です。韓屋と伝統市場、伝統工芸、芸術と食べ物が調和した固有の文化を体験できます。',
  '仁寺洞是传统与现代并存的首尔代表性文化地带，可以体验韩屋、传统市场、传统工艺、艺术与美食交融而成的独特文化。',
  'Insadong là khu văn hóa tiêu biểu của Seoul, nơi truyền thống và hiện đại cùng tồn tại. Hanok, chợ truyền thống, thủ công, nghệ thuật và ẩm thực hòa thành một nền văn hóa có thể trải nghiệm.',
  'อินซาดงเป็นย่านวัฒนธรรมเด่นของโซล ที่ประเพณีและปัจจุบันอยู่ร่วมกัน สัมผัสฮันอก ตลาดดั้งเดิม งานฝีมือ ศิลปะ และอาหารที่ผสานเป็นวัฒนธรรมเฉพาะตัว',
  'Инсадон — один из главных культурных районов Сеула, где традиция живёт рядом с настоящим. Ханоки, традиционный рынок, ремёсла, искусство и еда складываются в культуру, через которую можно пройти.',
  'Insadong adalah kawasan budaya utama Seoul, tempat tradisi dan masa kini hidup berdampingan. Hanok, pasar tradisional, kerajinan, seni, dan makanan menyatu menjadi budaya yang bisa dialami langsung.',
);

const CULTURE_CARDS: { photo: string; title: L8; body: L8; light?: boolean }[] = [
  {
    photo: cultureHanok,
    title: L('한옥 문화', 'Hanok', '韓屋文化', '韩屋文化', 'Văn hóa hanok', 'วัฒนธรรมฮันอก', 'Ханоки', 'Budaya hanok'),
    body: L(
      '인사동의 한옥은 서울의 전통을 담은 대표적인 건축물로, 기와지붕과 목조 구조를 통해 전통의 아름다움을 보여줍니다. 한옥의 정취를 느끼며 서울의 역사와 문화를 경험할 수 있습니다.',
      'Insadong’s hanok are among Seoul’s most familiar traditional buildings. Tile roofs and timber frames show the beauty of that craft, and walking among them is a way to feel the city’s history and culture.',
      '仁寺洞の韓屋はソウルの伝統を映す代表的な建築です。瓦屋根と木造が伝統の美しさを伝え、その情緒の中でソウルの歴史と文化を体験できます。',
      '仁寺洞的韩屋是承载首尔传统的代表性建筑，瓦顶与木结构展现传统之美。置身其中，可以感受首尔的历史与文化。',
      'Hanok ở Insadong là công trình tiêu biểu mang truyền thống Seoul. Mái ngói và kết cấu gỗ cho thấy vẻ đẹp truyền thống, và giữa không khí ấy có thể cảm nhận lịch sử cùng văn hóa của thành phố.',
      'ฮันอกในอินซาดงคือสถาปัตยกรรมที่บรรจุประเพณีของโซล หลังคากระเบื้องและโครงสร้างไม้แสดงความงามดั้งเดิม และระหว่างนั้นสัมผัสประวัติศาสตร์กับวัฒนธรรมของเมืองได้',
      'Ханоки Инсадоны — узнаваемые традиционные дома Сеула. Черепичные крыши и деревянный каркас показывают красоту этого ремесла, и среди них чувствуются история и культура города.',
      'Hanok di Insadong adalah bangunan yang membawa tradisi Seoul. Atap genteng dan rangka kayu menunjukkan keindahan itu, dan di antaranya sejarah serta budaya kota bisa dirasakan.',
    ),
  },
  {
    photo: cultureMarket,
    light: true,
    title: L('전통시장', 'Traditional market', '伝統市場', '传统市场', 'Chợ truyền thống', 'ตลาดดั้งเดิม', 'Традиционный рынок', 'Pasar tradisional'),
    body: L(
      '인사동의 전통시장은 한옥과 골목길이 어우러진 유서 깊은 공간으로, 전통음식과 전통공예품을 감상하며 서울의 전통문화를 느낄 수 있습니다.',
      'Insadong’s traditional market is an old quarter of hanok and alleys. Among the food and crafts, Seoul’s traditional culture is close enough to touch.',
      '仁寺洞の伝統市場は韓屋と路地が調和した由緒ある空間です。伝統食と伝統工芸品を眺めながら、ソウルの伝統文化を感じられます。',
      '仁寺洞传统市场是韩屋与小巷交融的古老空间，观赏传统食物与工艺品的同时，可以感受首尔的传统文化。',
      'Chợ truyền thống Insadong là không gian lâu đời của hanok và hẻm nhỏ. Ngắm món ăn và đồ thủ công, có thể cảm nhận văn hóa truyền thống của Seoul.',
      'ตลาดดั้งเดิมของอินซาดงคือพื้นที่เก่าแก่ที่ฮันอกและซอยเล็กประสานกัน ชมอาหารและงานฝีมือแล้วสัมผัสวัฒนธรรมดั้งเดิมของโซลได้',
      'Традиционный рынок Инсадоны — старый квартал ханоков и переулков. Среди еды и ремёсел традиционная культура Сеула ощущается вблизи.',
      'Pasar tradisional Insadong adalah kawasan lama tempat hanok dan gang bertemu. Di antara makanan dan kerajinan, budaya tradisional Seoul terasa dekat.',
    ),
  },
  {
    photo: cultureLife,
    title: L('인사동 생활문화', 'Everyday life', '仁寺洞の生活文化', '仁寺洞生活文化', 'Đời sống Insadong', 'วิถีชีวิตอินซาดง', 'Повседневная жизнь', 'Kehidupan sehari-hari'),
    body: L(
      '인사동의 생활문화는 전통과 현대가 어우러진 서울의 대표 문화지대로, 한옥과 골목길, 전통음식과 예술이 어우러진 고유한 문화를 체험할 수 있습니다.',
      'Daily life in Insadong is Seoul’s cultural district in practice: hanok and alleys, traditional food and art, a culture of its own where the old and the new share the street.',
      '仁寺洞の生活文化は伝統と現代が調和したソウルを代表する文化地域です。韓屋と路地、伝統食と芸術が調和した固有の文化を体験できます。',
      '仁寺洞的生活文化是传统与现代交融的首尔代表性文化地带，可以体验韩屋、小巷、传统食物与艺术汇成的独特文化。',
      'Đời sống Insadong là khu văn hóa tiêu biểu của Seoul, nơi truyền thống và hiện đại hòa vào nhau. Hanok, hẻm nhỏ, món ăn truyền thống và nghệ thuật tạo nên một nền văn hóa riêng để trải nghiệm.',
      'วิถีชีวิตอินซาดงคือย่านวัฒนธรรมเด่นของโซลที่ประเพณีและปัจจุบันผสานกัน สัมผัสฮันอก ซอย อาหารดั้งเดิม และศิลปะที่เป็นวัฒนธรรมเฉพาะตัว',
      'Повседневная жизнь Инсадоны — культурный район Сеула на практике: ханоки и переулки, традиционная еда и искусство, своя культура, где старое и новое делят улицу.',
      'Kehidupan sehari-hari di Insadong adalah kawasan budaya utama Seoul, tempat tradisi dan masa kini berpadu. Hanok, gang, makanan tradisional, dan seni menjadi budaya yang bisa dialami.',
    ),
  },
  {
    photo: cultureFood,
    title: L('인사동 음식문화', 'Food in Insadong', '仁寺洞の食文化', '仁寺洞饮食文化', 'Ẩm thực Insadong', 'วัฒนธรรมอาหารอินซาดง', 'Еда Инсадоны', 'Kuliner Insadong'),
    body: L(
      '인사동의 전통음식과 현대 카페음식이 어우러진 서울의 대표 음식지대로, 한식, 분식, 카페음식 등 다양한 음식을 즐길 수 있습니다.',
      'Insadong is one of Seoul’s food streets, where traditional dishes sit beside café food. Korean meals, snacks, and café plates are all within a short walk.',
      '仁寺洞は伝統食と現代のカフェ料理が調和したソウルを代表する食の地域です。韓食、軽食、カフェ料理など多様な食べ物を楽しめます。',
      '仁寺洞是传统饮食与现代咖啡美食交融的首尔代表性美食地带，可以享用韩餐、小吃和咖啡餐等多种食物。',
      'Insadong là khu ẩm thực tiêu biểu của Seoul, nơi món truyền thống gặp đồ café hiện đại. Cơm Hàn, đồ ăn vặt và món café đều có thể thưởng thức.',
      'อินซาดงเป็นย่านอาหารเด่นของโซล ที่อาหารดั้งเดิมพบกับอาหารคาเฟ่ร่วมสมัย อาหารเกาหลี ของทานเล่น และเมนูคาเฟ่มีให้เลือกมากมาย',
      'Инсадон — одна из гастрономических улиц Сеула: традиционные блюда стоят рядом с едой из кафе. Корейская кухня, закуски и кафе — всё в нескольких шагах.',
      'Insadong adalah kawasan kuliner utama Seoul, tempat makanan tradisional bertemu hidangan kafe. Masakan Korea, camilan, dan menu kafe bisa dinikmati di sini.',
    ),
  },
];

function Bullet({ text }: { text: string }): JSX.Element {
  return <h2 className={styles.bullet}>{text}</h2>;
}

function HistoryStory({ lang }: { lang: Lang }): JSX.Element {
  const [hero, setHero] = useState(historyHero);
  return (
    <article className={styles.story}>
      <div className={styles.historyTop}>
        <div className={styles.thumbs}>
          {HISTORY_THUMBS.map((src, i) => (
            <button
              key={src}
              type="button"
              className={`${styles.thumb} ${hero === src ? styles.thumbOn : ''}`}
              onClick={() => setHero(src)}
              aria-label={`${i + 1}`}
            >
              <img src={src} alt="" draggable={false} />
            </button>
          ))}
        </div>
        <img className={styles.hero} src={hero} alt="" draggable={false} />
        <div className={styles.historyIntro}>
          <Bullet text={sheet('Here_History_Intro_Title', HISTORY_INTRO_TITLE, lang)} />
          <p className={`${styles.prose} ${styles.proseLight}`}>{sheet('Here_History_Intro', HISTORY_INTRO, lang, 'Here_HistoryContent')}</p>
        </div>
      </div>

      <Bullet text={sheet('Here_History_Flow', HISTORY_FLOW, lang)} />
      <div className={styles.timeline}>
        {HISTORY_STEPS.map((step, i) => (
          <div key={step.icon} className={styles.stepWrap}>
            <div className={styles.step}>
              <span className={styles.stepIcon} aria-hidden="true">{step.icon}</span>
              <p className={styles.stepYear}>{sheetAt('Here_History_Step', i + 1, 'year', step.year, lang)}</p>
              <p className={styles.stepDesc}>
                {sheetAt('Here_History_Step', i + 1, 'line1', step.lines[0], lang)}
                <br />
                {sheetAt('Here_History_Step', i + 1, 'line2', step.lines[1], lang)}
              </p>
            </div>
            {i < HISTORY_STEPS.length - 1 && (
              <img className={styles.chevron} src={timelineChevron} alt="" draggable={false} />
            )}
          </div>
        ))}
      </div>

      <section className={styles.section}>
        <Bullet text={sheet('Here_History_Joseon_Title', HISTORY_JOSEON_TITLE, lang)} />
        <p className={styles.prose}>{sheet('Here_History_Joseon', HISTORY_JOSEON, lang)}</p>
      </section>
      <section className={styles.section}>
        <Bullet text={sheet('Here_History_Modern_Title', HISTORY_MODERN_TITLE, lang)} />
        <p className={styles.prose}>{sheet('Here_History_Modern', HISTORY_MODERN, lang)}</p>
      </section>
      <section className={styles.section}>
        <Bullet text={sheet('Here_History_Now', HISTORY_NOW, lang)} />
      </section>
    </article>
  );
}

function CultureStory({ lang }: { lang: Lang }): JSX.Element {
  return (
    <article className={styles.storyCulture}>
      <Bullet text={sheet('Here_Culture_Title', HISTORY_INTRO_TITLE, lang)} />
      <p className={`${styles.lead} ${styles.proseLight}`}>{sheet('Here_Culture_Lead', CULTURE_LEAD, lang, 'Here_CultureContent')}</p>
      <div className={styles.cultureGrid}>
        {CULTURE_CARDS.map((card, i) => (
          <article key={card.photo} className={styles.cultureCard}>
            <img className={styles.culturePhoto} src={card.photo} alt="" draggable={false} />
            <h3 className={styles.cultureTitle}>{sheetAt('Here_Culture', i + 1, 'title', card.title, lang)}</h3>
            <p className={`${styles.cultureBody} ${card.light ? styles.proseLight : ''}`}>{sheetAt('Here_Culture', i + 1, 'body', card.body, lang)}</p>
          </article>
        ))}
      </div>
    </article>
  );
}

function placeDetail(shop: Shop, lang: ReturnType<typeof useLang>, originName: string): SpotDetailData {
  const hours = shopOpenTime(shop.openTime);
  return {
    name: shopName(shop, lang),
    category: shopSecondCategory(shop, lang),
    photos: shopImages(shop),
    address: shopAddress(shop, lang),
    hours: hours ? [hours] : [],
    phone: shop.tel ?? '',
    description: shopDescription(shop, lang),
    tags: shopHashtag(shop, lang),
    rating: shop.naverRating != null ? String(shop.naverRating) : '',
    instagram: '',
    blog: shop.naverLink ?? '',
    originName,
    distanceKm: shop.route?.distanceKm ?? null,
    walkMin: shop.route?.walkMin ?? null,
  };
}

/** 여기는 인사동 — tabs, consonant index, Insadong map, and place cards.
 *  Tapping a card opens the shared detail under the same chrome. */
export function InsadongAbout({ controller }: InsadongAboutProps): JSX.Element {
  const lang = useLang();
  const banner = useRotatingBanner();
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const shops = useShopStore((s) => s.shops);
  const attractions = useAttractionStore((s) => s.attractions);
  const [tab, setTab] = useState<AboutTab>('attraction');
  const [initial, setInitial] = useState('');
  const [spot, setSpot] = useState<Shop | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  /** Ids the map is showing, or null for "not filtering" (its opening fit). */
  const [mapIds, setMapIds] = useState<number[] | null>(null);
  /** The pin whose callout is open — also the card the list scrolls to. */
  const [pinned, setPinned] = useState<number | null>(null);
  const noImg = iconUrl('noimage');

  const goHome = (): void => controller.navigate('home', 'Back');
  const goBack = (): void => {
    if (spot) {
      setSpot(null);
      return;
    }
    goHome();
  };

  /**
   * 관광명소, preferring the curated feed over the shop catalogue — the same
   * order 제주 uses (`attractions.length > 0 ? attractions : shopsForBase(...)`).
   *
   * This is also the ONLY route by which pins can appear. `/api/shops` carries
   * `latitude` / `longitude` but they are null on all 822 인사동 rows, whereas
   * `/api/jeju/attractions` is coordinate-bearing — 152 of 152 on kiosk 6. It
   * IS kiosk-scoped (kiosk 1 answers with 0 rows, not 제주's); 인사동 simply has
   * no attractions entered yet. Enter them and both the grid and the map fill
   * with no code change.
   */
  /** This kiosk's own number — W001 → 1. Rows from any other kiosk are ignored. */
  const kioskNum = useMemo(
    () => Number(controller.kioskId.match(/\d+/)?.[0] ?? 0),
    [controller.kioskId],
  );
  const places = useMemo(() => {
    /* ⚠ The curated feed is JEJU-NAMESPACED (`/api/jeju/attractions`). It is
       kiosk-scoped today — kiosk 1 answers with 0 rows, not 제주's 152 — but
       every row carries its own `kioskId`, so trust that rather than the
       endpoint's routing. Without this guard a feed that ever hands 제주 rows to
       an 인사동 kiosk would pin 성산일출봉 on 여기는 인사동 AND fit the map to an
       island 450km away. */
    const mine = attractions.filter((a) => a.kioskId === kioskNum);
    if (mine.length > 0) return mine;
    return shops.filter((s) => s.baseCategoryKr && !RESERVED_BASES.has(s.baseCategoryKr));
  }, [attractions, shops, kioskNum]);
  const visible = useMemo(
    () => places.filter((s) => !initial || shopInitial(shopName(s, 'ko')) === initial),
    [places, initial],
  );

  /* Hidden outside Korean rather than translated — an alphabet index only works
     for the alphabet the names are written in, and every card shows its name in
     the visitor's own language. Same call JejuAbout makes. */
  const showInitials = lang === 'ko';

  /* What the map pins: the 초성-filtered set narrowed to placeable rows.
     Deliberately NOT the viewport-filtered list — feeding the map its own
     output would refit it to whatever it last showed and it would walk itself
     into a corner on every pan. */
  const mapSpots = useMemo<MapSpot[]>(
    () =>
      visible.flatMap((shop) => {
        const at = spotCoords(shop);
        if (!at) return [];
        return [{
          id: shop.id,
          lat: at.lat,
          lng: at.lng,
          name: shopName(shop, lang),
          address: shopAddress(shop, lang),
          photo: shopImages(shop)[0],
        }];
      }),
    [visible, lang],
  );

  /* Whether this CATALOGUE can be mapped at all — read off the unfiltered set,
     so "no coordinates anywhere" stays distinct from "this 초성 matched
     nothing". Gating the map on the filtered set would take it away exactly
     when the visitor needs it to escape a dead-end filter. */
  const mappable = useMemo(() => places.some((sh) => spotCoords(sh) !== null), [places]);
  /** This kiosk's own position — where the map opens before it has pins to frame.
   *  Memoised: it is handed to the map as `fallbackCenter`, and that value feeds
   *  the map's refit, so a fresh object each render would reset the view. */
  const here = useMemo(() => {
    const c = getKioskLocation(controller.kioskId).coordinates;
    return { lat: c.lat, lng: c.lon };
  }, [controller.kioskId]);

  /* The cards the map is showing. Until the map is moved off its opening fit,
     `mapIds` is null and this is `visible` unchanged. */
  const listed = useMemo(() => {
    /* Narrow by the viewport only when there is something pinned to narrow BY —
       an unmapped catalogue would otherwise be filtered down to nothing by a
       map that is showing no pins at all. */
    if (!mapIds || !mappable) return visible;
    const inView = new Set(mapIds);
    return visible.filter((sh) => inView.has(sh.id));
  }, [visible, mapIds, mappable]);

  /* Tapping a pin brings its card to the middle of the grid. */
  useEffect(() => {
    const box = listRef.current;
    if (pinned === null || !box) return;
    const card = box.querySelector<HTMLElement>(`[data-spot-id="${pinned}"]`);
    if (!card) return;
    box.scrollTo({
      top: Math.max(0, card.offsetTop - box.clientHeight / 2 + card.offsetHeight / 2),
      behavior: 'smooth',
    });
  }, [pinned, listed]);

  const tabs: { id: AboutTab; label: string }[] = [
    { id: 'attraction', label: t('Here_Attraction', lang) },
    { id: 'history', label: t('Here_History', lang) },
    { id: 'culture', label: t('Here_Culture', lang) },
  ];

  const selectTab = (id: AboutTab): void => {
    setTab(id);
    setInitial('');
    setSpot(null);
    setMapIds(null);
    setPinned(null);
    if (listRef.current) listRef.current.scrollTop = 0;
  };

  const detail = spot
    ? placeDetail(spot, lang, getKioskLocation(controller.kioskId).name)
    : null;

  /* 관광명소 / 역사 / 문화 sit on fixed 580px plates; their translations do not.
     One factor for the three so the row keeps a single size, and one for the
     card names inside their 521 column. */
  useFitText(tabsRef, styles.tabLong, lang !== 'ko', 0.6, `${lang}|tabs`);
  useFitText(listRef, styles.nameLong, lang !== 'ko', 0.7, `${lang}|${tab}|${visible.length}`);

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title="여기는 인사동" onHome={goHome} onBack={goBack} />

      <div ref={tabsRef} className={styles.tabs}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.tab} ${item.id === tab ? styles.tabOn : ''} ${lang === 'ko' ? '' : styles.tabLong}`}
            onClick={() => selectTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'attraction' && showInitials && (
      <div className={styles.initials}>
        {INITIALS.map((letter) => (
          <button
            key={letter}
            type="button"
            className={`${styles.initial} ${letter === initial ? styles.initialOn : ''}`}
            onClick={() => {
              setInitial((cur) => (cur === letter ? '' : letter));
              setMapIds(null);
              setPinned(null);
            }}
          >
            {letter}
          </button>
        ))}
      </div>
      )}

      {detail ? (
        <SpotDetailCard
          data={detail}
          className={lowReach ? `${styles.detailEmbed} ${styles.detailEmbedLow}` : styles.detailEmbed}
        />
      ) : (
        <div
          ref={listRef}
          className={`${styles.body} ${tab === 'attraction' ? '' : styles.storyBody} ${
            lowReach && tab !== 'attraction' ? styles.storyBodyLow : ''
          }`}
        >
          {tab === 'attraction' && (
            <>
              <JejuSpotMap
                className={styles.map}
                spots={mapSpots}
                width={1812}
                height={767}
                lang={lang}
                activeId={pinned}
                onSelect={setPinned}
                onOpen={(id) => {
                  const hit = places.find((sh) => sh.id === id);
                  if (hit) setSpot(hit);
                }}
                onViewportChange={setMapIds}
                /* Where to open when no row can be placed. Without this the map
                   would fall back to JEJU_CENTER — an island 450km away. */
                fallbackCenter={here}
                fallbackZoom={16}
              />
              {listed.length > 0 ? (
                <div className={styles.grid}>
                  {listed.map((shop) => {
                    const photo = shopImages(shop)[0] || noImg;
                    const address = shopAddress(shop, lang);
                    const hours = shopOpenTime(shop.openTime);
                    return (
                      <button
                        key={shop.id}
                        type="button"
                        className={styles.card}
                        data-spot-id={shop.id}
                        onClick={() => setSpot(shop)}
                      >
                        <span className={styles.copy}>
                          {photo && <img className={styles.photo} src={photo} alt="" draggable={false} loading="lazy" />}
                          <span className={styles.copyText}>
                            <span className={`${styles.name} ${lang === 'ko' ? '' : styles.nameLong}`}>
                              {shopName(shop, lang)}
                            </span>
                            <span className={styles.metaCol}>
                              {address && (
                                <span className={styles.meta}>
                                  <img className={styles.marker} src={iconMarker} alt="" draggable={false} />
                                  <span className={styles.addr}>{address}</span>
                                </span>
                              )}
                              {hours && (
                                <span className={`${styles.meta} ${styles.metaHours}`}>
                                  <img className={styles.alarm} src={iconAlarm} alt="" draggable={false} />
                                  <span className={styles.hours}>{hours}</span>
                                </span>
                              )}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyWrap}>
                  <p className={styles.empty}>
                    {places.length === 0
                      ? t('Here_AttractionContent', lang)
                      : visible.length > 0
                        ? /* The MAP is narrowed, not the filter — 전체 보기 is the way back. */
                          tExact('Here_NoMatchInView', lang) || '이 지역에는 관광명소가 없습니다'
                        : tExact('Here_NoMatch', lang) || '해당 초성의 관광명소가 없습니다'}
                  </p>
                  {visible.length > 0 && mapIds && (
                    <button type="button" className={styles.resetView} onClick={() => setMapIds(null)}>
                      {tExact('Here_ShowAll', lang) || '전체 보기'}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'history' && <HistoryStory lang={lang} />}
          {tab === 'culture' && <CultureStory lang={lang} />}
        </div>
      )}

      {!detail && (
        <>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollUp}`}
            onClick={() => listRef.current?.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' })}
            aria-label="위로"
          >
            {iconUrl('scroll-arrow') && (
              <img src={iconUrl('scroll-arrow')} alt="" className={styles.scrollBtnImg} draggable={false} />
            )}
          </button>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollDown}`}
            onClick={() => listRef.current?.scrollBy({ top: SCROLL_STEP, behavior: 'smooth' })}
            aria-label="아래로"
          >
            {iconUrl('scroll-arrow') && (
              <img src={iconUrl('scroll-arrow')} alt="" className={styles.scrollBtnImg} draggable={false} />
            )}
          </button>
        </>
      )}

      <InsadongLeftNav onHome={goHome} onBack={goBack} />

      {!lowReach && (detail || tab !== 'attraction') && banner && (
        <button type="button" className={styles.banner} onClick={() => controller.startPhoto()} aria-label="가상 한복 체험">
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </>
  );
}
