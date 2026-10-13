import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import historyHero from '@renderer/assets/photos/osan/about/history-hero.jpg';
import thumbRed from '@renderer/assets/photos/osan/about/history-thumb-red.jpg';
import thumbGreen from '@renderer/assets/photos/osan/about/history-thumb-green.jpg';
import thumbYellow from '@renderer/assets/photos/osan/about/history-thumb-yellow.jpg';
import thumbOrange from '@renderer/assets/photos/osan/about/history-thumb-orange.jpg';
import thumbPurple from '@renderer/assets/photos/osan/about/history-thumb-purple.jpg';
import cultureRed from '@renderer/assets/photos/osan/about/culture-red.jpg';
import cultureGreen from '@renderer/assets/photos/osan/about/culture-green.jpg';
import cultureYellow from '@renderer/assets/photos/osan/about/culture-yellow.jpg';
import cultureOrangePurple from '@renderer/assets/photos/osan/about/culture-orange-purple.jpg';
import { useLang, type Lang } from '@renderer/lib/i18n';
import { t, tExact } from '@renderer/lib/loc';
import { ui } from '@renderer/lib/uiText';
import {
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopOpenTime,
  shopSecondCategory,
} from '@renderer/lib/shops';
import { useAttractionStore } from '@renderer/store/attractionStore';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { toLocalizedLang, type LocalizedLang } from '@shared/config/languages';
import type { Shop } from '@shared/types/shop';
import { useFitText } from '@layouts/components/fitText';
import { JejuSpotMap, type MapSpot } from '@layouts/jeju/JejuSpotMap';
import { OsanHeader } from './OsanHeader';
import { OsanLeftNav } from './OsanLeftNav';
import { OsanPageBg } from './OsanPageBg';
import { OsanSpotDetailCard, type SpotDetailData } from './OsanSpotDetailCard';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import styles from './OsanAbout.module.css';

interface OsanAboutProps {
  controller: KioskController;
}

type AboutTab = 'attraction' | 'history' | 'culture';

const INITIALS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const PLAIN: Record<string, string> = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' };
/** One row of cards — card 730 + the 60 gap under it (7862:44837 − 44794). */
const SCROLL_STEP = 790;
/** Cards drawn up front, and added per step as the visitor nears the end of the grid. */
const PAGE_SIZE = 24;

function shopInitial(name: string): string {
  const code = name.trim().charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return '';
  const c = CHOSEONG[Math.floor(code / 588)]!;
  return PLAIN[c] ?? c;
}

/** A place's pin position, or null when the row cannot be placed (see InsadongAbout). */
const spotCoords = (s: Shop): { lat: number; lng: number } | null => {
  const { latitude, longitude } = s as Shop & { latitude?: unknown; longitude?: unknown };
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { lat: latitude, lng: longitude };
};

type L8 = Record<LocalizedLang, string>;
const L = (
  ko: string, en: string, ja: string, zh: string, vi: string, th: string, ru: string, id: string,
): L8 => ({ ko, en, ja, zh, vi, th, ru, id });
const say = (table: L8, lang: Lang): string => table[toLocalizedLang(lang)];

/**
 * ── 역사 / 문화 copy: the sheet first, the frame's copy behind it ───────────
 *
 * Same keys InsadongAbout reads (`Here_History_Introduce_*`, `Here_HistoryFlow`,
 * `Here_History_epoch1..6`, `Here_HistoryContent_1|2_*`,
 * `Here_Culture_Introduce_*`, `Here_Culture_Content_1..4_*`), so 오색's operator
 * can override any block from Localization_Osaek without a release. Today that
 * sheet has none of them — only the one-paragraph `Here_HistoryContent` /
 * `Here_CultureContent`, which is NOT this copy — so the authored tables below
 * (Figma 오산>여기는오색시장-02 / -03, 7862:45100 / 45184) are what shows.
 * `tExact`, not `t`: a missing row must read as absent so the fallback runs.
 */
const sheet = (key: string, fallback: L8, lang: Lang): string => tExact(key, lang) || say(fallback, lang);
const sheetAt = (key: string, n: number, field: string, fallback: L8, lang: Lang): string =>
  tExact(`${key}_${n}_${field}`, lang) || say(fallback, lang);

/** Tab labels of the frame (7862:44928). */
const TAB_ATTRACTION = L('관광명소', 'Attractions', '観光名所', '旅游景点', 'Điểm tham quan', 'สถานที่ท่องเที่ยว', 'Достопримечательности', 'Objek wisata');
const TAB_CULTURE = L('문화', 'Culture', '文化', '文化', 'Văn hóa', 'วัฒนธรรม', 'Культура', 'Budaya');

/** 역사's five street thumbnails, top to bottom (7862:45111…45115). */
const HISTORY_THUMBS = [thumbRed, thumbGreen, thumbYellow, thumbOrange, thumbPurple];

const HISTORY_INTRO_TITLE = L(
  '오색시장의 문화', 'Culture of Osaek Market', 'オセク市場の文化', '五色市场的文化',
  'Văn hóa chợ Osaek', 'วัฒนธรรมตลาดโอแซก', 'Культура рынка Осаек', 'Budaya Pasar Osaek',
);
const HISTORY_INTRO = L(
  '오산장의 전통을 잇는 오색시장은 장보기와 먹거리, 상인의 정이 어우러진 곳입니다. 다섯 색 테마 골목마다 서로 다른 시장 문화를 만날 수 있습니다.',
  'Carrying on the tradition of the Osan market, Osaek Market brings together shopping, food, and the warmth of its merchants. Each of its five colour-themed alleys has a market culture of its own.',
  '烏山場の伝統を受け継ぐオセク市場は、買い物と食べ歩き、商人の人情が溶け合う場所です。五色のテーマ路地ごとに、異なる市場文化に出会えます。',
  '五色市场延续了乌山集市的传统，是购物、美食与商人人情交融的地方。五条不同颜色的主题小巷，各有不同的市场文化。',
  'Tiếp nối truyền thống chợ phiên Osan, chợ Osaek là nơi hội tụ mua sắm, ẩm thực và tình người của các tiểu thương. Mỗi con hẻm theo năm sắc màu mang một nét văn hóa chợ riêng.',
  'ตลาดโอแซกสืบสานประเพณีของตลาดนัดโอซาน เป็นที่ที่การจับจ่าย อาหาร และน้ำใจของพ่อค้าแม่ค้าผสานกัน แต่ละซอยธีมห้าสีมีวัฒนธรรมตลาดที่แตกต่างกัน',
  'Рынок Осаек продолжает традицию ярмарки Осан: здесь сходятся покупки, еда и радушие торговцев. В каждом из пяти цветных переулков — своя рыночная культура.',
  'Melanjutkan tradisi pasar Osan, Pasar Osaek memadukan belanja, kuliner, dan kehangatan para pedagang. Setiap gang bertema lima warna punya budaya pasarnya sendiri.',
);
const HISTORY_FLOW = L(
  '오색시장의 역사 흐름', 'How Osaek Market took shape', 'オセク市場の歴史の流れ', '五色市场的历史脉络',
  'Dòng chảy lịch sử chợ Osaek', 'ลำดับประวัติศาสตร์ตลาดโอแซก', 'Как складывался рынок Осаек', 'Jejak sejarah Pasar Osaek',
);

type StepIcon = 'store' | 'clothing' | 'food';
/** 7871:14889 / 14896 — six epochs; the icon is the frame's per step. */
const HISTORY_STEPS: { icon: StepIcon; year: L8; desc: [L8, L8] }[] = [
  {
    icon: 'store',
    year: L('조선시대', 'Joseon', '朝鮮時代', '朝鲜时代', 'Thời Joseon', 'สมัยโชซอน', 'Чосон', 'Joseon'),
    desc: [
      L('오산장의', 'The Osan market', '烏山場の', '乌山集市的', 'Truyền thống', 'ประเพณีตลาด', 'Традиция', 'Tradisi'),
      L('장터 전통', 'tradition', '市の伝統', '集市传统', 'chợ phiên Osan', 'นัดโอซาน', 'ярмарки Осан', 'pasar Osan'),
    ],
  },
  {
    icon: 'clothing',
    year: L('1914년', '1914', '1914年', '1914年', 'Năm 1914', 'ปี 1914', '1914', '1914'),
    desc: [
      L('오산시장 명칭', 'Named Osan Market', '「烏山市場」の名で', '以“乌山市场”之名', 'Mang tên chợ Osan', 'ใช้ชื่อตลาดโอซาน', 'Рынок Осан', 'Bernama Pasar Osan'),
      L('전통 5일장', 'a five-day market', '伝統の五日市', '传统五日集', 'chợ phiên 5 ngày', 'ตลาดนัดทุก 5 วัน', 'ярмарка раз в 5 дней', 'pasar lima harian'),
    ],
  },
  {
    icon: 'store',
    year: L('1980년대', '1980s', '1980年代', '1980年代', 'Thập niên 1980', 'ทศวรรษ 1980', '1980-е', '1980-an'),
    desc: [
      L('현재 시장으로', 'Trade moves to', '現在の市場へ', '商圈中心', 'Trung tâm buôn bán', 'ย่านการค้าย้าย', 'Торговля смещается', 'Pusat dagang'),
      L('상권 중심 이동', 'today’s market', '商圏の中心が移動', '移至现市场', 'dời về chợ nay', 'มายังตลาดปัจจุบัน', 'к нынешнему рынку', 'pindah ke pasar kini'),
    ],
  },
  {
    icon: 'food',
    year: L('2013년', '2013', '2013年', '2013年', 'Năm 2013', 'ปี 2013', '2013', '2013'),
    desc: [
      L('시민 설문으로', 'A citizen poll', '市民アンケートで', '经市民投票', 'Qua khảo sát người dân', 'ผลสำรวจประชาชน', 'Опрос горожан', 'Lewat survei warga'),
      L('오색시장 명칭', 'names it Osaek', '「オセク市場」に', '定名五色市场', 'đổi tên chợ Osaek', 'ตั้งชื่อตลาดโอแซก', 'даёт имя Осаек', 'bernama Osaek'),
    ],
  },
  {
    icon: 'clothing',
    year: L('2015년', '2015', '2015年', '2015年', 'Năm 2015', 'ปี 2015', '2015', '2015'),
    desc: [
      L('문화관광형', 'Selected as a', '文化観光型', '入选文化', 'Được chọn là chợ', 'ได้รับเลือกเป็น', 'Признан рынком', 'Terpilih sebagai'),
      L('시장사업 선정', 'culture-tourism market', '市場事業に選定', '旅游型市场', 'văn hóa – du lịch', 'ตลาดวัฒนธรรมท่องเที่ยว', 'культурного туризма', 'pasar wisata budaya'),
    ],
  },
  {
    icon: 'food',
    year: L('현재', 'Today', '現在', '现在', 'Hiện nay', 'ปัจจุบัน', 'Сегодня', 'Kini'),
    desc: [
      L('다섯 색 골목', 'Five colour alleys', '五色の路地', '五色小巷', 'Năm con hẻm sắc màu', 'ซอยห้าสี', 'Пять цветных улочек', 'Lima gang warna'),
      L('장보기와 문화', 'shopping and culture', '買い物と文化', '购物与文化', 'mua sắm và văn hóa', 'ช้อปปิ้งและวัฒนธรรม', 'покупки и культура', 'belanja dan budaya'),
    ],
  },
];

const HISTORY_TRADITION_TITLE = L(
  '오산장의 전통', 'The Osan market tradition', '烏山場の伝統', '乌山集市的传统',
  'Truyền thống chợ phiên Osan', 'ประเพณีตลาดนัดโอซาน', 'Традиция ярмарки Осан', 'Tradisi pasar Osan',
);
const HISTORY_TRADITION = L(
  '오산 오색시장은 조선시대 오산장의 전통을 잇는 시장입니다. 옛 오산장은 지역 주민이 물건을 사고팔며 소식을 나누던 장터였습니다. 1914년에는 ‘오산시장’이라는 명칭으로 전통 5일장을 이어왔습니다.',
  'Osan’s Osaek Market carries on the tradition of the Joseon-era Osan market, where local people came to buy and sell and to share the news. From 1914 it continued as a traditional five-day market under the name Osan Market.',
  '烏山オセク市場は、朝鮮時代の烏山場の伝統を受け継ぐ市場です。かつての烏山場は、地域の人々が物を売り買いし、知らせを交わす市でした。1914年からは「烏山市場」の名で伝統の五日市を続けてきました。',
  '乌山五色市场延续了朝鲜时代乌山集市的传统。昔日的乌山集市是当地居民买卖物品、交流消息的地方。1914年起，它以“乌山市场”之名延续着传统的五日集。',
  'Chợ Osaek ở Osan tiếp nối truyền thống chợ phiên Osan thời Joseon, nơi người dân địa phương mua bán và trao đổi tin tức. Từ năm 1914, chợ tiếp tục là chợ phiên 5 ngày truyền thống với tên gọi chợ Osan.',
  'ตลาดโอแซกแห่งโอซานสืบสานประเพณีของตลาดนัดโอซานสมัยโชซอน ซึ่งเป็นที่ที่ชาวบ้านมาซื้อขายและแลกเปลี่ยนข่าวสาร ตั้งแต่ปี 1914 ตลาดดำเนินต่อมาเป็นตลาดนัดทุก 5 วันในชื่อตลาดโอซาน',
  'Рынок Осаек в Осане продолжает традицию ярмарки Осан эпохи Чосон, куда местные жители приходили торговать и обмениваться новостями. С 1914 года он работал как традиционная ярмарка раз в пять дней под названием «Рынок Осан».',
  'Pasar Osaek di Osan melanjutkan tradisi pasar Osan zaman Joseon, tempat warga berjual beli dan bertukar kabar. Sejak 1914 pasar ini berlanjut sebagai pasar lima harian tradisional bernama Pasar Osan.',
);
const HISTORY_CHANGE_TITLE = L(
  '오색시장으로의 변화', 'Becoming Osaek Market', 'オセク市場への変化', '走向五色市场',
  'Trở thành chợ Osaek', 'สู่ตลาดโอแซก', 'Как он стал рынком Осаек', 'Menjadi Pasar Osaek',
);
const HISTORY_CHANGE = L(
  '1980년대 이후 상권의 중심이 현재 시장 쪽으로 이동했습니다. 2013년 시민 설문을 거쳐 ‘오산오색시장’으로 이름을 바꾸고, 2015년 문화관광형시장 육성사업에 선정됐습니다. 오늘날에는 다섯 색 골목에서 장보기와 먹거리, 시장 문화를 함께 즐길 수 있습니다.',
  'From the 1980s the centre of trade moved to where the market stands today. After a citizen poll in 2013 it was renamed Osan Osaek Market, and in 2015 it was selected for the national culture-and-tourism market programme. Today its five colour alleys offer shopping, food, and market culture together.',
  '1980年代以降、商圏の中心が現在の市場側へ移りました。2013年に市民アンケートを経て「烏山オセク市場」と名を改め、2015年には文化観光型市場育成事業に選ばれました。今では五色の路地で買い物と食べ歩き、市場文化を一緒に楽しめます。',
  '1980年代以后，商圈中心逐渐移至现在的市场一带。2013年经市民投票更名为“乌山五色市场”，2015年入选文化旅游型市场培育项目。如今，在五色小巷里可以同时享受购物、美食与市场文化。',
  'Từ thập niên 1980, trung tâm buôn bán dời về vị trí chợ hiện nay. Năm 2013, qua khảo sát người dân, chợ đổi tên thành chợ Osaek Osan, và năm 2015 được chọn vào dự án phát triển chợ văn hóa – du lịch. Ngày nay, năm con hẻm sắc màu mang đến cả mua sắm, ẩm thực lẫn văn hóa chợ.',
  'ตั้งแต่ทศวรรษ 1980 ศูนย์กลางการค้าย้ายมายังที่ตั้งตลาดปัจจุบัน ปี 2013 เปลี่ยนชื่อเป็นตลาดโอแซกโอซานจากผลสำรวจของประชาชน และปี 2015 ได้รับเลือกเข้าโครงการพัฒนาตลาดเชิงวัฒนธรรมและการท่องเที่ยว ปัจจุบันซอยห้าสีมีทั้งการช้อปปิ้ง อาหาร และวัฒนธรรมตลาด',
  'С 1980-х центр торговли сместился туда, где рынок стоит сейчас. В 2013 году по итогам опроса горожан его переименовали в «Осан Осаек», а в 2015 году он вошёл в программу развития рынков культурного туризма. Сегодня в пяти цветных переулках можно и закупиться, и поесть, и почувствовать рыночную культуру.',
  'Sejak 1980-an pusat perdagangan pindah ke lokasi pasar sekarang. Lewat survei warga pada 2013 namanya diganti menjadi Pasar Osaek Osan, dan pada 2015 terpilih dalam program pengembangan pasar wisata budaya. Kini lima gang warnanya menawarkan belanja, kuliner, dan budaya pasar sekaligus.',
);
/** The frames' illustration note (7862:45123 last line / 7867:159948). */
const ILLUSTRATION_NOTE = L(
  '※ 이미지는 시장 문화를 표현한 예시 일러스트입니다.',
  '※ Images are illustrations of the market’s culture.',
  '※ 画像は市場の文化を表したイメージイラストです。',
  '※ 图片为表现市场文化的示意插图。',
  '※ Hình ảnh là tranh minh họa văn hóa chợ.',
  '※ ภาพเป็นภาพประกอบที่สื่อถึงวัฒนธรรมตลาด',
  '※ Изображения — иллюстрации, передающие культуру рынка.',
  '※ Gambar adalah ilustrasi budaya pasar.',
);

/** 문화 tab description in the header (7862:45188). */
const CULTURE_SUBTITLE = L(
  '다섯 색 골목에서 만나는 시장 문화', 'Market culture in five colour alleys', '五色の路地で出会う市場文化', '在五色小巷邂逅市场文化',
  'Văn hóa chợ trong năm con hẻm sắc màu', 'วัฒนธรรมตลาดในซอยห้าสี', 'Рыночная культура пяти цветных переулков', 'Budaya pasar di lima gang warna',
);
const CULTURE_TITLE = L(
  '오색시장의 다섯 색', 'The five colours of Osaek Market', 'オセク市場の五つの色', '五色市场的五种颜色',
  'Năm sắc màu của chợ Osaek', 'ห้าสีของตลาดโอแซก', 'Пять цветов рынка Осаек', 'Lima warna Pasar Osaek',
);
const CULTURE_LEAD = L(
  '오산 오색시장은 다섯 색의 테마 골목을 가진 전통시장입니다.\n장보기와 먹거리, 상인의 정이 어우러진 시장 문화를 만나보세요.',
  'Osan’s Osaek Market is a traditional market with five colour-themed alleys.\nCome and meet a market culture of shopping, food, and friendly merchants.',
  '烏山オセク市場は、五色のテーマ路地を持つ伝統市場です。\n買い物と食べ歩き、商人の人情が溶け合う市場文化に出会ってください。',
  '乌山五色市场是一座拥有五条颜色主题小巷的传统市场。\n来感受购物、美食与商人人情交融的市场文化吧。',
  'Chợ Osaek ở Osan là chợ truyền thống với năm con hẻm theo chủ đề màu sắc.\nHãy đến trải nghiệm văn hóa chợ với mua sắm, ẩm thực và tình người.',
  'ตลาดโอแซกแห่งโอซานเป็นตลาดดั้งเดิมที่มีซอยธีมห้าสี\nมาสัมผัสวัฒนธรรมตลาดที่ผสานการจับจ่าย อาหาร และน้ำใจของพ่อค้าแม่ค้า',
  'Рынок Осаек в Осане — традиционный рынок с пятью цветными тематическими переулками.\nПриходите почувствовать его культуру: покупки, еду и радушных торговцев.',
  'Pasar Osaek di Osan adalah pasar tradisional dengan lima gang bertema warna.\nRasakan budaya pasarnya: belanja, kuliner, dan keramahan para pedagang.',
);

/** 7862:45191…45209 — the four cards; the last one is 46px (a long title). */
const CULTURE_CARDS: { photo: string; title: L8; body: L8; small?: boolean }[] = [
  {
    photo: cultureRed,
    title: L('빨강길', 'Red Street', '赤の道', '红色街', 'Đường Đỏ', 'ถนนสีแดง', 'Красная улица', 'Jalan Merah'),
    body: L(
      '야시장·야맥축제가 열리는 활기찬 거리입니다. 패션과 의류 중심으로 다양한 상품을 만날 수 있으며, 밤이 깊을수록 오색시장의 열기가 넘칩니다.',
      'A lively street that hosts the night market and the night beer festival. Fashion and clothing lead a wide range of goods, and the later the night, the warmer Osaek Market’s energy.',
      '夜市やナイトビアフェスが開かれる活気ある通りです。ファッションと衣類を中心に多彩な商品に出会え、夜が更けるほどオセク市場の熱気があふれます。',
      '这里是举办夜市和夜间啤酒节的热闹街道。以时装和服饰为主，商品种类丰富，夜越深，五色市场越热闹。',
      'Con phố sôi động với chợ đêm và lễ hội bia đêm. Thời trang và quần áo là chủ đạo cùng nhiều mặt hàng khác, và càng về đêm chợ Osaek càng náo nhiệt.',
      'ถนนคึกคักที่มีตลาดกลางคืนและเทศกาลเบียร์ยามค่ำ เน้นแฟชั่นและเสื้อผ้าพร้อมสินค้าหลากหลาย ยิ่งดึกตลาดโอแซกยิ่งคึกคัก',
      'Оживлённая улица ночного рынка и ночного пивного фестиваля. Здесь в основном одежда и мода, но выбор широк, и чем позднее, тем жарче на рынке Осаек.',
      'Jalan meriah tempat pasar malam dan festival bir malam. Fesyen dan pakaian jadi andalan di antara beragam barang, dan makin malam Pasar Osaek makin semarak.',
    ),
  },
  {
    photo: cultureGreen,
    title: L('녹색길', 'Green Street', '緑の道', '绿色街', 'Đường Xanh', 'ถนนสีเขียว', 'Зелёная улица', 'Jalan Hijau'),
    body: L(
      '정육·채소·수산물·과일·건어물 등 신선한 식재료 골목입니다. 오색시장의 풍성한 먹거리를 준비하는 공간으로, 시장의 활기를 느낄 수 있습니다.',
      'An alley of fresh ingredients: meat, vegetables, seafood, fruit, and dried fish. This is where Osaek Market’s plentiful food begins, and where you can feel the market’s energy.',
      '精肉・野菜・水産物・果物・乾物など、新鮮な食材の路地です。オセク市場の豊かな食を支える場所で、市場の活気を感じられます。',
      '这里是肉类、蔬菜、水产、水果、干货等新鲜食材的小巷。它为五色市场丰富的美食做准备，能感受到市场的活力。',
      'Con hẻm của nguyên liệu tươi: thịt, rau, hải sản, trái cây và đồ khô. Đây là nơi chuẩn bị cho ẩm thực phong phú của chợ Osaek, nơi cảm nhận rõ sức sống của chợ.',
      'ซอยของวัตถุดิบสด ทั้งเนื้อสัตว์ ผัก อาหารทะเล ผลไม้ และของแห้ง เป็นที่เตรียมอาหารอันอุดมของตลาดโอแซก สัมผัสความคึกคักของตลาดได้',
      'Переулок свежих продуктов: мясо, овощи, морепродукты, фрукты и сушёная рыба. Отсюда начинается щедрая еда рынка Осаек — здесь чувствуется его жизнь.',
      'Gang bahan segar: daging, sayur, hasil laut, buah, dan ikan kering. Di sinilah hidangan melimpah Pasar Osaek disiapkan, dan semangat pasar terasa.',
    ),
  },
  {
    photo: cultureYellow,
    title: L('노랑 미소거리', 'Yellow Smile Street', '黄色の微笑み通り', '黄色微笑街', 'Phố Nụ Cười Vàng', 'ถนนรอยยิ้มสีเหลือง', 'Жёлтая улица улыбок', 'Jalan Senyum Kuning'),
    body: L(
      '방앗간과 상인의 친절한 미소가 어우러진 골목입니다. 따뜻한 정과 서비스 정신을 느낄 수 있는 오색시장의 대표 정취 공간입니다.',
      'An alley of mills and friendly merchants’ smiles. It is Osaek Market’s most characteristic corner, full of warmth and good service.',
      '精米所と商人の優しい笑顔が溶け合う路地です。温かな人情とおもてなしの心を感じられる、オセク市場を代表する風情の場所です。',
      '这是磨坊与商人亲切笑容交织的小巷，是能感受到温暖人情与服务精神的五色市场代表性风情空间。',
      'Con hẻm của những cối xay và nụ cười thân thiện của tiểu thương. Đây là góc mang đậm chất chợ Osaek, nơi cảm nhận tình người ấm áp và sự hiếu khách.',
      'ซอยที่โรงสีและรอยยิ้มอันเป็นมิตรของพ่อค้าแม่ค้าผสานกัน เป็นมุมบรรยากาศเด่นของตลาดโอแซกที่สัมผัสน้ำใจและการบริการได้',
      'Переулок мельниц и приветливых улыбок торговцев. Самый душевный уголок рынка Осаек, где чувствуются тепло и забота.',
      'Gang penggilingan dan senyum ramah para pedagang. Sudut paling khas Pasar Osaek, tempat kehangatan dan pelayanan terasa.',
    ),
  },
  {
    photo: cultureOrangePurple,
    small: true,
    title: L(
      '주황 아름거리 & 보라 맘스거리', 'Orange Areum St. & Purple Mom’s St.', 'オレンジ通り&パープル通り', '橙色美丽街 & 紫色妈妈街',
      'Phố Cam & Phố Tím', 'ถนนส้ม & ถนนม่วง', 'Оранжевая и Фиолетовая улицы', 'Jalan Oranye & Ungu',
    ),
    body: L(
      '주황 아름거리는 먹거리·맛집, 보라 맘스거리는 텃밭장터와 전통 장터 정취를 담고 있습니다.',
      'Orange Areum Street is for food and good restaurants; Purple Mom’s Street has the garden market and the feel of a traditional fair.',
      'オレンジのアルム通りは食べ歩きと名店、パープルのマムズ通りは菜園市と昔ながらの市の風情を伝えます。',
      '橙色美丽街汇集美食与名店，紫色妈妈街则保留着菜园集市与传统集市的风情。',
      'Phố Areum màu cam là phố ẩm thực và quán ngon; phố Mom’s màu tím mang không khí chợ vườn và chợ phiên truyền thống.',
      'ถนนอารึมสีส้มคือถนนอาหารและร้านอร่อย ส่วนถนนมัมส์สีม่วงมีตลาดผักสวนครัวและบรรยากาศตลาดนัดดั้งเดิม',
      'Оранжевая улица Арым — это еда и хорошие закусочные, Фиолетовая улица мам — огородный рынок и атмосфера старой ярмарки.',
      'Jalan Areum oranye untuk kuliner dan tempat makan enak; Jalan Mom’s ungu menghadirkan pasar kebun dan suasana pasar tradisional.',
    ),
  },
];

function Bullet({ text }: { text: string }): JSX.Element {
  return <h2 className={styles.bullet}>{text}</h2>;
}

function HistoryStory({ lang }: { lang: Lang }): JSX.Element {
  return (
    <article className={styles.story}>
      {/* 7871:14885 — five street thumbnails, the main illustration, the intro. */}
      <div className={styles.historyTop}>
        <div className={styles.thumbs}>
          {HISTORY_THUMBS.map((src) => (
            <img key={src} className={styles.thumb} src={src} alt="" draggable={false} />
          ))}
        </div>
        <img className={styles.hero} src={historyHero} alt="" draggable={false} />
        <div className={styles.historyIntro}>
          <Bullet text={sheet('Here_History_Introduce_title', HISTORY_INTRO_TITLE, lang)} />
          <p className={`${styles.prose} ${styles.proseLight}`}>
            {sheet('Here_History_Introduce_content', HISTORY_INTRO, lang)}
          </p>
        </div>
      </div>

      <Bullet text={sheet('Here_HistoryFlow', HISTORY_FLOW, lang)} />
      {/* 7862:45108 — the #FBF8F3 strip: years on one row, icon + two lines under. */}
      <div className={styles.timeline}>
        <div className={styles.timelineRow}>
          {HISTORY_STEPS.map((step, i) => (
            <p key={i} className={styles.stepYear}>
              {tExact(`Here_History_epoch${i + 1}`, lang) || say(step.year, lang)}
            </p>
          ))}
        </div>
        <div className={`${styles.timelineRow} ${styles.steps}`}>
          {HISTORY_STEPS.map((step, i) => (
            <div key={i} className={styles.step}>
              {osanIconUrl(`about-step-${step.icon}`) && (
                <img className={styles.stepIcon} src={osanIconUrl(`about-step-${step.icon}`)} alt="" draggable={false} />
              )}
              {/* The sheet gives ONE description per epoch; the authored one is two lines. */}
              <p className={styles.stepDesc}>
                {tExact(`Here_History_epoch${i + 1}_desc`, lang) || (
                  <>
                    {say(step.desc[0], lang)}
                    <br />
                    {say(step.desc[1], lang)}
                  </>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>

      <section className={`${styles.section} ${styles.sectionFirst}`}>
        <Bullet text={sheetAt('Here_HistoryContent', 1, 'title', HISTORY_TRADITION_TITLE, lang)} />
        <p className={styles.prose}>{sheetAt('Here_HistoryContent', 1, 'summary', HISTORY_TRADITION, lang)}</p>
      </section>
      <section className={styles.section}>
        <Bullet text={sheetAt('Here_HistoryContent', 2, 'title', HISTORY_CHANGE_TITLE, lang)} />
        <p className={styles.prose}>
          {sheetAt('Here_HistoryContent', 2, 'summary', HISTORY_CHANGE, lang)}
          <br />
          {say(ILLUSTRATION_NOTE, lang)}
        </p>
      </section>
    </article>
  );
}

function CultureStory({ lang }: { lang: Lang }): JSX.Element {
  return (
    <article className={styles.storyCulture}>
      <Bullet text={sheet('Here_Culture_Introduce_title', CULTURE_TITLE, lang)} />
      <p className={`${styles.lead} ${styles.proseLight}`}>{sheet('Here_Culture_Introduce_content', CULTURE_LEAD, lang)}</p>
      <div className={styles.cultureGrid}>
        {CULTURE_CARDS.map((card, i) => (
          <article key={card.photo} className={styles.cultureCard}>
            <img className={styles.culturePhoto} src={card.photo} alt="" draggable={false} />
            <h3 className={`${styles.cultureTitle} ${card.small ? styles.cultureTitleSmall : ''}`}>
              {sheetAt('Here_Culture_Content', i + 1, 'title', card.title, lang)}
            </h3>
            <p className={`${styles.cultureBody} ${styles.proseLight}`}>
              {sheetAt('Here_Culture_Content', i + 1, 'desc', card.body, lang)}
            </p>
          </article>
        ))}
      </div>
      <p className={styles.cultureNote}>{say(ILLUSTRATION_NOTE, lang)}</p>
    </article>
  );
}

function placeDetail(shop: Shop, lang: Lang): SpotDetailData {
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
  };
}

interface SpotCardProps {
  shop: Shop;
  lang: Lang;
  noImg: string | undefined;
  onOpen: (shop: Shop) => void;
}

/** One 관광명소 card (7862:44795). Memoised: the map reports its viewport on every pan. */
const SpotCard = memo(function SpotCard({ shop, lang, noImg, onOpen }: SpotCardProps): JSX.Element {
  const photo = shopImages(shop)[0] || noImg;
  const address = shopAddress(shop, lang);
  const hours = shopOpenTime(shop.openTime);
  const marker = osanIconUrl('marker');
  const alarm = osanIconUrl('alarm');
  return (
    <button type="button" className={styles.card} data-spot-id={shop.id} onClick={() => onOpen(shop)}>
      <span className={styles.copy}>
        {photo && <img className={styles.photo} src={photo} alt="" draggable={false} loading="lazy" decoding="async" />}
        <span className={styles.copyText}>
          <span className={`${styles.name} ${lang === 'ko' ? '' : styles.nameLong}`}>{shopName(shop, lang)}</span>
          <span className={styles.metaCol}>
            {address && (
              <span className={styles.meta}>
                {marker && <img className={styles.marker} src={marker} alt="" draggable={false} />}
                <span className={styles.addr}>{address}</span>
              </span>
            )}
            {hours && (
              <span className={`${styles.meta} ${styles.metaHours}`}>
                {alarm && <img className={styles.alarm} src={alarm} alt="" draggable={false} />}
                <span className={styles.hours}>{hours}</span>
              </span>
            )}
          </span>
        </span>
      </span>
    </button>
  );
});

/**
 * 여기는 오색시장 — Figma 오산>여기는오색시장-01-1 / -01-2 / -02 / -03 (7862:44787 /
 * 44961 / 45100 / 45184). A port of InsadongAbout: 관광명소 (map, ㄱ–ㅎ, place
 * cards → the shared 상세 card with its own map), 역사 and 문화.
 *
 * 관광명소 is the curated attractions feed for this kiosk (`region=OSAEK`). 오색's
 * shop catalogue has no sight category — every base is 정이 뭐먹지/뭐사지/뭐사지2/
 * 도와줘, each with its own screen — so there is no shop fallback as on 인사동.
 * Stage answers OSAEK with 0 rows today: the grid shows its empty line and the
 * map opens on the market until the backend enters them.
 */
export function OsanAbout({ controller }: OsanAboutProps): JSX.Element {
  const lang = useLang();
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
  const [shown, setShown] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const noImg = osanIconUrl('noimage');
  const arrow = osanIconUrl('scroll-arrow');
  const banner = osanIconUrl('banner-course');

  const goHome = (): void => controller.navigate('home', 'Back');
  const goBack = (): void => {
    if (spot) {
      setSpot(null);
      return;
    }
    goHome();
  };

  /** W004 → 4. The feed is per-region, but trust each row's own kioskId. */
  const kioskNum = useMemo(() => Number(controller.kioskId.match(/\d+/)?.[0] ?? 0), [controller.kioskId]);
  const places = useMemo(() => {
    const mine = attractions.filter((a) => a.kioskId === kioskNum);
    // Places WITH a photo first — a wall of "no image" plates up top reads as empty.
    const hasPhoto = (s: Shop): boolean => shopImages(s).length > 0;
    return [...mine.filter(hasPhoto), ...mine.filter((s) => !hasPhoto(s))];
  }, [attractions, kioskNum]);
  const visible = useMemo(
    () => places.filter((s) => !initial || shopInitial(shopName(s, 'ko')) === initial),
    [places, initial],
  );

  /* The ㄱ–ㅎ index only works for the alphabet the names are written in. */
  const showInitials = lang === 'ko';
  useEffect(() => {
    if (!showInitials && initial !== '') {
      setInitial('');
      setMapIds(null);
      setPinned(null);
    }
  }, [showInitials, initial]);

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
  const mappable = useMemo(() => places.some((sh) => spotCoords(sh) !== null), [places]);
  /** This kiosk's own position — where a map opens before it has pins to frame. */
  const here = useMemo(() => {
    const c = getKioskLocation(controller.kioskId).coordinates;
    return { lat: c.lat, lng: c.lon };
  }, [controller.kioskId]);

  const listed = useMemo(() => {
    if (!mapIds || !mappable) return visible;
    const inView = new Set(mapIds);
    return visible.filter((sh) => inView.has(sh.id));
  }, [visible, mapIds, mappable]);

  const pinnedIndex = pinned === null ? -1 : listed.findIndex((sh) => sh.id === pinned);
  const limit = Math.max(shown, pinnedIndex + PAGE_SIZE);
  const rendered = useMemo(() => listed.slice(0, limit), [listed, limit]);

  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [tab, initial, lang]);

  const more = rendered.length < listed.length;
  useEffect(() => {
    const box = listRef.current;
    const end = sentinelRef.current;
    if (!more || !box || !end) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => Math.max(n, limit) + PAGE_SIZE);
      },
      { root: box, rootMargin: '0px 0px 1500px 0px' },
    );
    io.observe(end);
    return () => io.disconnect();
  }, [more, limit]);

  const openSpot = useCallback((shop: Shop): void => setSpot(shop), []);

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

  /* Localization_Osaek's `Here_Attraction` / `Here_Culture` rows still carry the
     previous page's tab names (현재와 미래 / 특징), so those two use the frame's
     labels; `Here_History` (역사) already matches and stays on the sheet. */
  const tabs: { id: AboutTab; label: string }[] = [
    { id: 'attraction', label: say(TAB_ATTRACTION, lang) },
    { id: 'history', label: t('Here_History', lang) },
    { id: 'culture', label: say(TAB_CULTURE, lang) },
  ];

  const selectTab = (id: AboutTab): void => {
    setTab(id);
    /* 재생조건: Here-1 관광명소 · Here-2 역사 · Here-3 문화. */
    void window.api.kiosk.setScreen(
      id === 'history' ? 'about_history' : id === 'culture' ? 'about_culture' : 'about_attractions',
    );
    setInitial('');
    setSpot(null);
    setMapIds(null);
    setPinned(null);
    if (listRef.current) listRef.current.scrollTop = 0;
  };

  const detail = spot ? placeDetail(spot, lang) : null;
  const detailAt = spot ? spotCoords(spot) : null;

  useFitText(tabsRef, styles.tabLong, lang !== 'ko', 0.6, `${lang}|tabs`);
  useFitText(listRef, styles.nameLong, lang !== 'ko', 0.7, `${lang}|${tab}|${visible.length}|${rendered.length}`);

  /* Per-frame description: 문화 has its own line (7862:45188); 역사 draws none
     (its text node is fully transparent); 관광명소 keeps the sheet's. */
  /*
   * ♿ — OsanKiosk moves this page down under the mode bar; `.low` re-places it
   * onto the frames. Every state drops the three tabs to the foot (3435). 역사 /
   * 문화 (7887:50843 / 50923) also bring the promo up to 146 and the header to
   * 719 with the story panel at 1413; 관광명소 (7887:50982 list, 7887:51156
   * detail) keep the shifted header, no promo, and the ㄱ–ㅎ row at the foot.
   */
  const low = useAccessibilityStore((s) => s.lowReach);
  const lowStory = low && !detail && tab !== 'attraction';

  const subtitle =
    tab === 'culture' && !detail
      ? tExact('Here_Culture_Subtitle', lang) || say(CULTURE_SUBTITLE, lang)
      : tab === 'history' && !detail
        ? ''
        : undefined;

  const header = <OsanHeader title="여기는 오색시장" subtitle={subtitle} onHome={goHome} onBack={goBack} />;

  return (
    <div className={low ? styles.low : undefined} style={{ display: 'contents' }}>
      <OsanPageBg />

      {lowStory ? <div className={styles.lowHeader}>{header}</div> : header}

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

      {tab === 'attraction' && showInitials && !detail && (
        <p className={styles.initials}>
          {INITIALS.map((letter, i) => (
            <span key={letter}>
              <button
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
              {i < INITIALS.length - 1 && ' '}
            </span>
          ))}
        </p>
      )}

      {detail ? (
        <OsanSpotDetailCard
          data={detail}
          className={styles.detailEmbed}
          map={
            <JejuSpotMap
              className={styles.detailMap}
              spots={
                detailAt && spot
                  ? [{ id: spot.id, lat: detailAt.lat, lng: detailAt.lng, name: detail.name, address: detail.address }]
                  : []
              }
              width={1514}
              height={631}
              lang={lang}
              fallbackCenter={detailAt ?? here}
              fallbackZoom={16}
            />
          }
        />
      ) : (
        <div ref={listRef} className={`${styles.body} ${tab === 'attraction' ? '' : styles.storyBody}`}>
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
                fallbackCenter={here}
                fallbackZoom={16}
              />
              {listed.length > 0 ? (
                <>
                  <div className={styles.grid}>
                    {rendered.map((shop) => (
                      <SpotCard key={shop.id} shop={shop} lang={lang} noImg={noImg} onOpen={openSpot} />
                    ))}
                  </div>
                  {more && <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />}
                </>
              ) : (
                <div className={styles.emptyWrap}>
                  <p className={styles.empty}>
                    {places.length === 0
                      ? tExact('Search_NoContent', lang) || '표시할 관광명소가 없습니다'
                      : visible.length > 0
                        ? tExact('Here_NoMatchInView', lang) || '이 지역에는 관광명소가 없습니다'
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

      {/* ▲/▼ (7862:44953 / 44954) — 관광명소 and 역사 draw them; 문화 and 상세 do not. */}
      {!detail && tab !== 'culture' && (
        <>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollUp}`}
            onClick={() => listRef.current?.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' })}
            aria-label="위로"
          >
            {arrow && <img src={arrow} alt="" className={styles.scrollBtnImg} draggable={false} />}
          </button>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollDown}`}
            onClick={() => listRef.current?.scrollBy({ top: SCROLL_STEP, behavior: 'smooth' })}
            aria-label="아래로"
          >
            {arrow && <img src={arrow} alt="" className={styles.scrollBtnImg} draggable={false} />}
          </button>
        </>
      )}

      <OsanLeftNav onHome={goHome} onBack={goBack} />

      {/* 역사 / 문화 / 상세 carry the 상점 검색 promo (orange strip); 관광명소's list runs to the foot. */}
      {(low ? lowStory : detail || tab !== 'attraction') && banner && (
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
