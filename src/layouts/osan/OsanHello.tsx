/**
 * 안녕 '정이' — Figma 오산>안녕정이 (7853:34459 '정이'소개; 7853:34558 / 34628 /
 * 34698 '정이'취미생활 K-POP / 골프 / 테니스). The frames are 제주's 안녕 '하영'
 * redrawn in navy (they are still named 인사>안녕인사-0x), so this is the same page
 * as JejuHello without the mascot switch or the ♿ layout:
 *
 *   '정이'소개      portrait circle + profile + details, one 1820×2160 card
 *   '정이'취미생활   a sub-tab text row over an 850×1510 photo, a caption card
 *   '정이' 건강습관  the same panel (7853:34768 / 34839 / 34909) — 목·어깨 /
 *                   허리 / 기분전환 over an 869×1546 photo
 *
 * The LAYOUT is the frames'. The DATA is Localization_Osaek's `Greeting_*` rows,
 * which hold 정이's own profile, captions and hashtags in all eight languages —
 * the frames' copy is 하영's carried over (word-for-word K-POP caption, "서울
 * 종로구 정이동", #jeong-i). The authored copy below is only the fallback.
 */
import { Fragment, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useFitText } from '@layouts/components/fitText';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { pick, type Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { ui } from '@renderer/lib/uiText';
import helloVideo from '@renderer/assets/videos/osan/hello-jeongi.mp4';
import tiktokIcon from '@renderer/assets/photos/osan/hello/tiktok.png';
import instaIcon from '@renderer/assets/photos/osan/hello/insta.png';
import hobbyKpop from '@renderer/assets/photos/osan/hello/hobby-kpop-v2.jpg';
import hobbyGolf from '@renderer/assets/photos/osan/hello/hobby-golf-v2.jpg';
import hobbyTennis from '@renderer/assets/photos/osan/hello/hobby-tennis-v2.jpg';
import healthNeck from '@renderer/assets/photos/osan/hello/health-neck.jpg';
import healthWaist from '@renderer/assets/photos/osan/hello/health-waist.jpg';
import healthRefresh from '@renderer/assets/photos/osan/hello/health-refresh.jpg';
import { OsanHeader } from './OsanHeader';
import { OsanLeftNav } from './OsanLeftNav';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import styles from './OsanHello.module.css';

type L8 = Partial<Record<Lang, string>>;
type TabId = 'profile' | 'hobbies' | 'health';
type TopicTabId = Exclude<TabId, 'profile'>;

/**
 * Tab labels as the frame writes them (7853:34517). Not the sheet's
 * `Greeting_Category1–3`: those read "정이' 소개" (a lost opening quote),
 * "정이의 취미" and "스트레칭 고고~" — the previous page's names.
 */
const TABS: { id: TabId; label: L8 }[] = [
  { id: 'profile', label: { ko: '‘정이’소개', en: 'About JEONG-I', ja: '‘ジョンイ’紹介', zh: '‘JEONG-I’介绍', vi: 'Giới thiệu ‘JEONG-I’', th: 'แนะนำ ‘จองอี’', ru: 'О ‘Чон-и’', id: 'Tentang ‘JEONG-I’' } },
  { id: 'hobbies', label: { ko: '‘정이’취미생활', en: 'JEONG-I’s Hobbies', ja: '‘ジョンイ’の趣味', zh: '‘JEONG-I’的爱好', vi: 'Sở thích của ‘JEONG-I’', th: 'งานอดิเรกของ ‘จองอี’', ru: 'Хобби ‘Чон-и’', id: 'Hobi ‘JEONG-I’' } },
  { id: 'health', label: { ko: '‘정이’건강습관', en: 'JEONG-I’s Health', ja: '‘ジョンイ’の健康習慣', zh: '‘JEONG-I’的健康习惯', vi: 'Thói quen của ‘JEONG-I’', th: 'สุขภาพของ ‘จองอี’', ru: 'Привычки ‘Чон-и’', id: 'Kebiasaan ‘JEONG-I’' } },
];

/** Field labels as the frame draws them (이름 / 출생 / 출신 …), 8 languages. */
const LABEL = {
  name: { ko: '이름', en: 'Name', ja: '名前', zh: '姓名', vi: 'Tên', th: 'ชื่อ', ru: 'Имя', id: 'Nama' },
  born: { ko: '출생', en: 'Born', ja: '生年月日', zh: '出生', vi: 'Ngày sinh', th: 'วันเกิด', ru: 'Дата рождения', id: 'Lahir' },
  from: { ko: '출신', en: 'From', ja: '出身', zh: '籍贯', vi: 'Quê quán', th: 'ภูมิลำเนา', ru: 'Родом из', id: 'Asal' },
  nationality: { ko: '국적', en: 'Nationality', ja: '国籍', zh: '国籍', vi: 'Quốc tịch', th: 'สัญชาติ', ru: 'Гражданство', id: 'Kebangsaan' },
  blood: { ko: '혈액형', en: 'Blood type', ja: '血液型', zh: '血型', vi: 'Nhóm máu', th: 'กรุ๊ปเลือด', ru: 'Группа крови', id: 'Gol. darah' },
  mbti: { ko: 'MBTI', en: 'MBTI', ja: 'MBTI', zh: 'MBTI', vi: 'MBTI', th: 'MBTI', ru: 'MBTI', id: 'MBTI' },
  hobby: { ko: '취미', en: 'Hobbies', ja: '趣味', zh: '爱好', vi: 'Sở thích', th: 'งานอดิเรก', ru: 'Хобби', id: 'Hobi' },
  vibe: { ko: '성격', en: 'Personality', ja: '性格', zh: '性格', vi: 'Tính cách', th: 'บุคลิก', ru: 'Характер', id: 'Kepribadian' },
  dream: { ko: '장래희망', en: 'Dream', ja: '将来の夢', zh: '理想', vi: 'Ước mơ', th: 'ความฝัน', ru: 'Мечта', id: 'Cita-cita' },
  about: { ko: '자기소개', en: 'About me', ja: '自己紹介', zh: '自我介绍', vi: 'Giới thiệu', th: 'แนะนำตัว', ru: 'О себе', id: 'Tentang saya' },
} satisfies Record<string, L8>;

/** Profile rows (7853:34465) — the value is the sheet's 정이 row. */
const PROFILE: { label: L8; key: string; ko: string }[] = [
  { label: LABEL.born, key: 'Greeting_BirthDayContent', ko: '2006년 7월 31일' },
  { label: LABEL.from, key: 'Greeting_HomeTownContent', ko: '대한민국 경기도' },
  { label: LABEL.nationality, key: 'Greeting_NationalityContent', ko: '대한민국' },
  { label: LABEL.blood, key: 'Greeting_BloodTypeContent', ko: 'O형' },
  { label: LABEL.mbti, key: 'Greeting_MBTIContent', ko: 'ENTJ' },
];

/**
 * Detail rows (7853:34487). The frame's four are 특기 / 취미 / 장래희망 /
 * 자기소개; the sheet has no 특기 for 정이, but it has a 취미 list and a 성격
 * line (`Greeting_Specialty*` is labelled 취미 there, `Greeting_Hobby*` 성격), so
 * those two take the first two slots under their own names.
 */
const DETAILS: { label: L8; key: string; ko: string }[] = [
  { label: LABEL.hobby, key: 'Greeting_SpecialtyContent', ko: 'K-POP 댄스, 맛집 탐방, 디저트 카페 방문, 테니스, 골프' },
  { label: LABEL.vibe, key: 'Greeting_HobbyContent', ko: '' },
  { label: LABEL.dream, key: 'Greeting_FutureHopeContent', ko: '' },
  { label: LABEL.about, key: 'Greeting_IntrodutionContent', ko: '' },
];

/** One sub-tab of 취미생활 or 건강습관: a photo and a caption read from the sheet,
 *  with authored copy (8 languages) behind it where the sheet has none. */
interface Topic {
  id: string;
  label: L8;
  photo: string;
  titleKey: string;
  bodyKey: string;
  title?: L8;
  body?: L8;
}

/**
 * 취미생활 sub-tabs (7853:34558 / 34628 / 34698). Labels are the frame's; the
 * caption is the sheet's `Greeting_Hobby_<n>_Desc_1` (title) / `…_Desc_2` (body).
 * Since the 2026-10-15 sheet revision the bare `Greeting_Hobby_<n>` row is the
 * TAB LABEL ("K-POP") and `…_Content` is gone — the same shape as 건강습관.
 */
const HOBBIES: Topic[] = [
  {
    id: 'kpop',
    label: { ko: 'K-POP', en: 'K-POP', ja: 'K-POP', zh: 'K-POP', vi: 'K-POP', th: 'K-POP', ru: 'K-POP', id: 'K-POP' },
    photo: hobbyKpop,
    titleKey: 'Greeting_Hobby_First_Desc_1',
    bodyKey: 'Greeting_Hobby_First_Desc_2',
  },
  {
    id: 'golf',
    label: { ko: '골프', en: 'Golf', ja: 'ゴルフ', zh: '高尔夫', vi: 'Golf', th: 'กอล์ฟ', ru: 'Гольф', id: 'Golf' },
    photo: hobbyGolf,
    titleKey: 'Greeting_Hobby_Second_Desc_1',
    bodyKey: 'Greeting_Hobby_Second_Desc_2',
  },
  {
    id: 'tennis',
    label: { ko: '테니스', en: 'Tennis', ja: 'テニス', zh: '网球', vi: 'Tennis', th: 'เทนนิส', ru: 'Теннис', id: 'Tenis' },
    photo: hobbyTennis,
    titleKey: 'Greeting_Hobby_Third_Desc_1',
    bodyKey: 'Greeting_Hobby_Third_Desc_2',
  },
];
/**
 * 건강습관 sub-tabs (7853:34768 목·어깨, 34839 허리, 34909 기분전환).
 *
 * Localization_Osaek has no 건강습관 rows (only the previous page's
 * `Greeting_Stretching_*`), so the frames' captions are authored here, keyed like
 * the hobby rows so an operator can add `Greeting_Healthy_Habit_<n>` /
 * `…_Content` later. The frames' Korean reads "정이동" — a 인사동→정이동
 * find-and-replace left over from the 인사 template they were copied from — and
 * is written as 오색시장 here.
 */
const HEALTH: Topic[] = [
  {
    id: 'neck',
    label: { ko: '목·어깨', en: 'Neck & shoulders', ja: '首・肩', zh: '颈部·肩膀', vi: 'Cổ & vai', th: 'คอ·ไหล่', ru: 'Шея и плечи', id: 'Leher & bahu' },
    photo: healthNeck,
    titleKey: 'Greeting_Healthy_Habit_First_Desc_1',
    bodyKey: 'Greeting_Healthy_Habit_First_Desc_2',
    title: {
      ko: '오색시장을 즐기는 만큼 몸도 가볍게 풀어보세요.',
      en: 'Enjoy Osaek Market — and loosen up your body too.',
      ja: 'オセク市場を楽しむ分、体も軽くほぐしましょう。',
      zh: '尽情逛五色市场，也让身体轻松舒展一下吧。',
      vi: 'Vui chơi ở chợ Osaek, và thả lỏng cơ thể nữa nhé.',
      th: 'เที่ยวตลาดโอแซกให้สนุก แล้วยืดเหยียดร่างกายให้สบายด้วย',
      ru: 'Гуляете по рынку Осаек — дайте отдых и телу.',
      id: 'Nikmati Pasar Osaek, dan regangkan tubuh juga.',
    },
    body: {
      ko: '오색시장 곳곳을 둘러보며 쌓인 목과 어깨의 긴장을 가볍게 풀어보세요. 화면 속 동작을 천천히 따라 하며 몸을 리프레시하고, 더욱 편안하게 오색시장을 즐겨보세요.',
      en: 'Ease the tension in your neck and shoulders from exploring the market. Follow the moves on screen slowly to refresh your body, then enjoy Osaek Market in comfort.',
      ja: '市場を巡って溜まった首と肩の緊張を軽くほぐしましょう。画面の動きをゆっくり真似して体をリフレッシュし、もっと快適にオセク市場を楽しんでください。',
      zh: '逛市场累积的颈肩紧张，来轻轻放松一下吧。跟着画面中的动作慢慢做，让身体焕然一新，更舒适地享受五色市场。',
      vi: 'Thả lỏng cổ và vai sau khi dạo quanh chợ. Chậm rãi làm theo động tác trên màn hình để làm mới cơ thể và tận hưởng chợ Osaek thoải mái hơn.',
      th: 'คลายความตึงที่คอและไหล่หลังเดินเที่ยวทั่วตลาด ทำตามท่าบนหน้าจออย่างช้า ๆ เพื่อให้ร่างกายสดชื่น แล้วเที่ยวตลาดโอแซกได้สบายยิ่งขึ้น',
      ru: 'Снимите напряжение в шее и плечах после прогулки по рынку. Медленно повторяйте движения с экрана, освежитесь и наслаждайтесь рынком Осаек с удобством.',
      id: 'Lemaskan leher dan bahu yang tegang setelah berkeliling pasar. Ikuti gerakan di layar perlahan untuk menyegarkan tubuh, lalu nikmati Pasar Osaek dengan nyaman.',
    },
  },
  {
    id: 'waist',
    label: { ko: '허리', en: 'Back', ja: '腰', zh: '腰部', vi: 'Lưng', th: 'หลัง', ru: 'Спина', id: 'Pinggang' },
    photo: healthWaist,
    titleKey: 'Greeting_Healthy_Habit_Second_Desc_1',
    bodyKey: 'Greeting_Healthy_Habit_Second_Desc_2',
    title: {
      ko: '지친 몸, 잠시 쉬어가세요.',
      en: 'Tired? Take a short break.',
      ja: '疲れた体、少しひと休みしましょう。',
      zh: '身体累了，稍微休息一下吧。',
      vi: 'Mệt rồi, nghỉ ngơi một chút nhé.',
      th: 'เหนื่อยแล้ว พักสักครู่นะ',
      ru: 'Устали? Сделайте небольшую паузу.',
      id: 'Lelah? Istirahat sejenak, yuk.',
    },
    body: {
      ko: '오색시장 곳곳을 둘러보느라 뻐근해진 몸을 가볍게 풀어보세요.\n간단한 스트레칭으로 몸의 긴장을 풀고, 편안한 마음으로 오색시장 여행을 이어가세요.',
      en: 'Loosen up a body stiff from walking around the market.\nA few simple stretches ease the tension, so you can carry on exploring Osaek Market relaxed.',
      ja: '市場を巡ってこわばった体を軽くほぐしましょう。\n簡単なストレッチで緊張をほぐし、ゆったりした気分でオセク市場の旅を続けてください。',
      zh: '逛市场逛得身体僵硬了，来轻轻舒展一下吧。\n简单的拉伸让身体放松，带着轻松的心情继续五色市场之旅。',
      vi: 'Thả lỏng cơ thể mỏi nhừ sau khi dạo quanh chợ.\nVài động tác giãn cơ đơn giản giúp bạn thư giãn để tiếp tục khám phá chợ Osaek.',
      th: 'ยืดร่างกายที่ปวดเมื่อยจากการเดินเที่ยวตลาด\nยืดเหยียดง่าย ๆ ช่วยคลายความตึง แล้วเที่ยวตลาดโอแซกต่ออย่างสบายใจ',
      ru: 'Разомните тело, уставшее от прогулки по рынку.\nПростая растяжка снимет напряжение — и можно спокойно продолжать путешествие по рынку Осаек.',
      id: 'Regangkan tubuh yang pegal setelah berkeliling pasar.\nPeregangan sederhana melepas ketegangan, agar bisa lanjut menjelajahi Pasar Osaek dengan santai.',
    },
  },
  {
    id: 'refresh',
    label: { ko: '기분전환', en: 'Refresh', ja: '気分転換', zh: '换换心情', vi: 'Thư giãn', th: 'เปลี่ยนอารมณ์', ru: 'Перезагрузка', id: 'Segarkan diri' },
    photo: healthRefresh,
    titleKey: 'Greeting_Healthy_Habit_Third_Desc_1',
    bodyKey: 'Greeting_Healthy_Habit_Third_Desc_2',
    title: {
      ko: '잠시 멈춰, 기분 좋은 에너지를 채워보세요.',
      en: 'Pause for a moment and recharge.',
      ja: 'ちょっと立ち止まって、心地よいエネルギーを満たしましょう。',
      zh: '停下片刻，补充满满的好能量吧。',
      vi: 'Dừng lại một chút và nạp năng lượng tích cực.',
      th: 'หยุดพักสักครู่ แล้วเติมพลังดี ๆ ให้ตัวเอง',
      ru: 'Остановитесь на минуту и наберитесь сил.',
      id: 'Berhenti sejenak dan isi ulang energi.',
    },
    body: {
      ko: '간단한 스트레칭을 따라 하며 긴장을 풀고, 여행 중 쌓인 피로를 자연스럽게 덜어보세요. 잠깐의 휴식이 여행을 더욱 즐겁게 만드는 특별한 시간이 될 거예요.',
      en: 'Follow some simple stretches to unwind and let the tiredness of the trip fade. A short break can make the rest of your trip even more enjoyable.',
      ja: '簡単なストレッチを真似して緊張をほぐし、旅の疲れを自然に和らげましょう。少しの休憩が旅をもっと楽しくする特別な時間になります。',
      zh: '跟着简单的拉伸放松身心，自然缓解旅途中积累的疲劳。短暂的休息会让旅程更加愉快。',
      vi: 'Làm theo vài động tác giãn cơ để thư giãn và xua tan mệt mỏi của chuyến đi. Một chút nghỉ ngơi sẽ khiến chuyến đi thêm vui vẻ.',
      th: 'ทำตามท่ายืดง่าย ๆ เพื่อผ่อนคลายและคลายความเหนื่อยล้าจากการเดินทาง การพักสั้น ๆ จะทำให้การเที่ยวสนุกยิ่งขึ้น',
      ru: 'Повторите простую растяжку, расслабьтесь и снимите усталость в дороге. Короткий перерыв сделает поездку ещё приятнее.',
      id: 'Ikuti peregangan sederhana untuk rileks dan hilangkan lelah perjalanan. Istirahat singkat membuat perjalanan makin menyenangkan.',
    },
  },
];

/**
 * Per topic tab: the sub-tabs, the photo slot and where the caption sits. The
 * frames draw 취미생활's photo 850×1510 at y1080 with the caption 56 into its
 * card, 건강습관's 869×1546 at y1081 with it 60 in; 건강습관 also mutes its
 * unselected sub-tabs to #999 where 취미생활's are gray 07.
 */
const TOPIC_TABS: Record<
  TopicTabId,
  { topics: Topic[]; photo: { width: number; height: number; top: number }; captionTop: number; muted: boolean }
> = {
  hobbies: { topics: HOBBIES, photo: { width: 850, height: 1510, top: 1080 }, captionTop: 56, muted: false },
  health: { topics: HEALTH, photo: { width: 869, height: 1546, top: 1081 }, captionTop: 60, muted: true },
};

/** What follows each sub-tab label in the frames' one text node (7853:34597). */
const SUB_GAPS = ['        ㅣ          ', '        ㅣ          '];

/** 정이's Instagram, and 인사's TikTok in the other slot (정이 has none) — QR
 *  codes are generated from these, inside the frame's navy tile. */
const SOCIAL_LINKS = [
  { id: 'tiktok', icon: tiktokIcon, url: 'https://www.tiktok.com/@insa.world' },
  { id: 'instagram', icon: instaIcon, url: 'https://www.instagram.com/jeong.i_stagram' },
];

const say = (table: L8, lang: Lang): string => pick(table, lang);
const fromSheet = (key: string, lang: Lang, ko: string): string => sheetText(key, lang, ko ? { ko } : undefined);

function hashPill(raw: string): string {
  const bare = raw.replace(/^#+/, '').trim();
  return bare ? `#${bare}` : '';
}

/** Hashtag pills + the TikTok/Instagram tiles and their codes (7853:34500).
 *  The tags are what visitors search for on TikTok/Instagram, so they are
 *  never translated: Korean on the Korean screen, English on every other
 *  (Figma note on the other-language frames: 한국어/영어만 사용). */
function HelloFooter({ lang, className }: { lang: Lang; className: string }): JSX.Element {
  const tagLang: Lang = lang === 'ko' ? 'ko' : 'en';
  const tags = [
    hashPill(sheetText('Greeting_Tag1', tagLang, { ko: 'JEONGE', en: 'JEONGE' })),
    hashPill(sheetText('Greeting_Tag2', tagLang, { ko: '정이', en: 'JEONG-I' })),
    hashPill(sheetText('Greeting_Tag3', tagLang, { ko: '안녕 정이', en: 'Hello Jeong-i' })),
  ].filter(Boolean);
  /* "#Hello JEONG-I" is wider than its 322 pill. The pills keep their text
     whole and the row's hashtag type shrinks together (--fit) until the footer
     fits its 1582 beside the social tiles. */
  const footerRef = useRef<HTMLDivElement>(null);
  useFitText(footerRef, styles.footer, lang !== 'ko', 0.6, tags.join('|'));
  return (
    <div ref={footerRef} className={`${styles.footer} ${className}`}>
      {tags.map((h, i) => (
        <span key={i} className={styles.hashtag}>
          {h}
        </span>
      ))}
      <div className={styles.socials}>
        {SOCIAL_LINKS.map((s) => (
          <Fragment key={s.id}>
            <img className={styles.socialIcon} src={s.icon} alt="" draggable={false} />
            <div className={styles.socialQr}>
              <QRCodeSVG value={s.url} level="M" style={{ width: '100%', height: '100%' }} />
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

interface OsanHelloProps {
  controller: KioskController;
}

export function OsanHello({ controller }: OsanHelloProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLanguageStore((s) => s.currentLanguage);
  const [tab, setTab] = useState<TabId>('profile');
  const [topic, setTopic] = useState<Record<TopicTabId, string>>({
    hobbies: HOBBIES[0]!.id,
    health: HEALTH[0]!.id,
  });
  const tabsRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const banner = osanIconUrl('banner-course');

  /* Customer-display clip per tab and sub-tab (재생조건 Greeting-2-1…3 / 3-1…3). */
  const topicTab = tab === 'profile' ? null : TOPIC_TABS[tab];
  const topicId = tab === 'profile' ? '' : topic[tab];
  const topicIndex = topicTab ? topicTab.topics.findIndex((t) => t.id === topicId) + 1 : 0;
  useEffect(() => {
    const key = tab === 'hobbies' ? `hello_hobby_${topicIndex}` : tab === 'health' ? `hello_stretch_${topicIndex}` : 'hello';
    void window.api.kiosk.setScreen(key);
  }, [tab, topicIndex]);

  const current = topicTab ? (topicTab.topics.find((t) => t.id === topicId) ?? topicTab.topics[0]!) : null;
  const wide = lang !== 'ko';
  useFitText(tabsRef, styles.tab, wide, 0.72, lang);
  /* The sheet's 정이 copy is longer than the frame's — in Korean too — so the
     detail block and the caption shrink as one when they outgrow their slots. */
  useFitText(detailsRef, styles.details, true, 0.7, `${lang}|${tab}`, 'height');
  useFitText(captionRef, styles.topicText, true, 0.7, `${lang}|${tab}|${topicId}`, 'height');

  /*
   * ♿ (안녕 '정이' 7887:52114 소개, 7887:51936 / 51995 / 52054 취미생활): the page
   * keeps OsanKiosk's shift but the tabs drop to the foot (3430) with the topic
   * row under them (3650), the promo goes, and the content takes the freed band.
   */
  const low = useAccessibilityStore((s) => s.lowReach);

  return (
    <div className={low ? styles.low : undefined} style={{ display: 'contents' }}>
      {osanIconUrl('page-bg') && <img className={styles.bg} src={osanIconUrl('page-bg')} alt="" draggable={false} />}

      <OsanHeader title="안녕 '정이'" onHome={goHome} />

      <div ref={tabsRef} className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab} ${wide ? styles.tabLong : ''} ${tab === t.id ? styles.tabSelected : ''}`}
            onClick={() => setTab(t.id)}
          >
            {say(t.label, lang)}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className={styles.card}>
          <div className={styles.portrait}>
            {/* 정이's intro clip, looped and muted like 인사동's. No poster: the
                old still flashed in the circle before the clip's first frame. */}
            <video
              src={helloVideo}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
            />
          </div>

          <div className={styles.profile}>
            <div className={`${styles.row} ${styles.rowName}`}>
              <p className={styles.label}>{say(LABEL.name, lang)}</p>
              <span className={styles.namePlate}>{fromSheet('Greeting_NameContent', lang, '정이')}</span>
            </div>
            {PROFILE.map((row) => (
              <div key={row.key} className={styles.row}>
                <p className={styles.label}>{say(row.label, lang)}</p>
                <p className={styles.value}>{fromSheet(row.key, lang, row.ko)}</p>
              </div>
            ))}
          </div>

          <div className={styles.divider} />

          <div ref={detailsRef} className={styles.details}>
            {DETAILS.map((row) => {
              const value = fromSheet(row.key, lang, row.ko);
              return value ? (
                <div key={row.key} className={styles.detailRow}>
                  <p className={styles.detailLabel}>{say(row.label, lang)}</p>
                  <p className={styles.detailValue}>{value}</p>
                </div>
              ) : null;
            })}
          </div>

          <HelloFooter lang={lang} className={styles.footerProfile ?? ''} />
        </div>
      )}

      {topicTab && current && tab !== 'profile' && (
        <>
          <p className={`${styles.subTabs} ${topicTab.muted ? styles.subTabsMuted : ''}`}>
            {topicTab.topics.map((t, i) => (
              <Fragment key={t.id}>
                <button
                  type="button"
                  className={`${styles.subTab} ${t.id === topicId ? styles.subTabOn : ''}`}
                  data-label={say(t.label, lang)}
                  onClick={() => setTopic((prev) => ({ ...prev, [tab]: t.id }))}
                >
                  <span>{say(t.label, lang)}</span>
                </button>
                {SUB_GAPS[i]}
              </Fragment>
            ))}
          </p>

          <div
            className={styles.topicPhoto}
            style={{
              width: topicTab.photo.width,
              height: topicTab.photo.height,
              /* ♿ the frames keep the photo where the normal page draws it (1080),
                 so it undoes OsanKiosk's shift. */
              top: low ? `calc(${topicTab.photo.top}px - var(--osan-mode-push, 0px))` : topicTab.photo.top,
            }}
          >
            <img src={current.photo} alt="" draggable={false} />
          </div>

          <div className={styles.topicCard}>
            <div ref={captionRef} className={styles.topicText} style={{ top: topicTab.captionTop }}>
              <p className={styles.topicTitle}>{sheetText(current.titleKey, lang, current.title)}</p>
              <p className={styles.topicBody}>{sheetText(current.bodyKey, lang, current.body)}</p>
            </div>
            <HelloFooter lang={lang} className={styles.footerTopic ?? ''} />
          </div>
        </>
      )}

      <OsanLeftNav onHome={goHome} />

      {/* 7853:34567 — the 상점 검색 promo (orange strip), which opens 검색. */}
      {!low && banner && (
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
