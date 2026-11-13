/**
 * 안녕 '휴' — Figma 7956:72869 ('휴'소개) and 7956:72981 / 73066 / 73150
 * ('휴'취미생활 런닝 / 스키 / 테니스), 7956:73234 / 73319 / 73403 ('휴'건강습관
 * 목·어깨 / 허리 / 기분전환). The frames are 오산's 안녕 '정이'
 * (OsanHello) recoloured to 화성 main 1, so this is the same page:
 *
 *   '휴'소개      portrait circle + profile + details, one 1820×2160 card
 *   '휴'취미생활   a sub-tab text row over an 853×1515 photo, a caption card
 *   '휴'건강습관   the same panel with an 869×1546 photo
 *
 * The LAYOUT is the frames'. The profile DATA is Localization_Hwaseong's
 * `Greeting_*` rows (the frame's 2005년 9월 30일 / 서울 종로구 휴동 / ENTJ and its
 * 자기소개 — which still names 오색시장 and @jeongi_stagram — are placeholder
 * copy). The sheet has no 런닝 / 스키 / 테니스 captions (its Hobby rows are
 * 디자인 / 모델 / 운동), so the frames' captions are authored below — as are
 * 건강습관's.
 */
import { Fragment, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { trackEvent } from '@renderer/lib/analytics';
import { pick, useLang, type Lang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { ui } from '@renderer/lib/uiText';
import { useFitText } from '@layouts/components/fitText';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import hobbyRunning from '@renderer/assets/photos/hwaseong/hello/hobby-running.jpg';
import hobbySkiing from '@renderer/assets/photos/hwaseong/hello/hobby-skiing.jpg';
import hobbyTennis from '@renderer/assets/photos/hwaseong/hello/hobby-tennis.jpg';
import healthNeck from '@renderer/assets/photos/hwaseong/hello/health-neck.jpg';
import healthWaist from '@renderer/assets/photos/hwaseong/hello/health-waist.jpg';
import healthRefresh from '@renderer/assets/photos/hwaseong/hello/health-refresh.jpg';
import tiktokIcon from '@renderer/assets/photos/hwaseong/hello/tiktok.png';
import instaIcon from '@renderer/assets/photos/hwaseong/hello/insta.png';
import helloVideo from '@renderer/assets/videos/hwaseong/hello-hue.mp4';
import { HwaseongHeader } from './HwaseongHeader';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import { HwaseongPageBg } from './HwaseongPageBg';
import styles from './HwaseongHello.module.css';

const INSTAGRAM_URL = 'https://www.instagram.com/hue_stargram?igsh=YjJqeXBtMTVwbzFr';

type L8 = Partial<Record<Lang, string>>;
type TabId = 'profile' | 'hobbies' | 'health';
type TopicTabId = Exclude<TabId, 'profile'>;

/**
 * Tab labels as the frame writes them. Not the sheet's `Greeting_Category1–3`
 * ("휴' 소개", "휴'의 일상생활", "스트레칭 고고~") — the previous page's names.
 */
const TABS: { id: TabId; label: L8 }[] = [
  { id: 'profile', label: { ko: '‘휴’소개', en: 'About HUE', ja: '‘ひゅ’紹介', zh: '‘HUE’介绍', vi: 'Giới thiệu ‘Hyu’', th: 'แนะนำ ‘ฮยู’', ru: 'О ‘Хью’', id: 'Tentang ‘Hyu’' } },
  { id: 'hobbies', label: { ko: '‘휴’취미생활', en: 'HUE’s Hobbies', ja: '‘ひゅ’の趣味', zh: '‘HUE’的爱好', vi: 'Sở thích của ‘Hyu’', th: 'งานอดิเรกของ ‘ฮยู’', ru: 'Хобби ‘Хью’', id: 'Hobi ‘Hyu’' } },
  { id: 'health', label: { ko: '‘휴’건강습관', en: 'HUE’s Health', ja: '‘ひゅ’の健康習慣', zh: '‘HUE’的健康习惯', vi: 'Thói quen của ‘Hyu’', th: 'สุขภาพของ ‘ฮยู’', ru: 'Привычки ‘Хью’', id: 'Kebiasaan ‘Hyu’' } },
];

/** Profile rows (label + value from the sheet, as before). */
const PROFILE_KEYS: [string, string][] = [
  ['Greeting_BirthDay', 'Greeting_BirthDayContent'],
  ['Greeting_HomeTown', 'Greeting_HomeTownContent'],
  ['Greeting_Nationality', 'Greeting_NationalityContent'],
  ['Greeting_BloodType', 'Greeting_BloodTypeContent'],
  ['Greeting_MBTI', 'Greeting_MBTIContent'],
];

/**
 * Detail rows — the frame's 특기 / 취미 / 장래희망 / 자기소개, which are the
 * sheet's Hobby (labelled 특기) / Specialty (labelled 취미) / FutureHope /
 * Introdution. The sheet's 신체 row is not in the frame.
 */
const DETAIL_KEYS: [string, string][] = [
  ['Greeting_Hobby', 'Greeting_HobbyContent'],
  ['Greeting_Specialty', 'Greeting_SpecialtyContent'],
  ['Greeting_FutureHope', 'Greeting_FutureHopeContent'],
  ['Greeting_Introdution', 'Greeting_IntrodutionContent'],
];

/** Korean from the frame; English and the other six authored here. */
const tr = (ko: string, en: string, rest: Omit<L8, 'ko' | 'en'>): L8 => ({ ko, en, ...rest });

interface Topic {
  id: string;
  label: L8;
  photo: string;
  /** A caption authored here, or the sheet row it is read from. */
  title: L8 | string;
  body: L8 | string;
}

/** 취미생활 (7956:72981 런닝, 73066 스키, 73150 테니스). */
const HOBBIES: Topic[] = [
  {
    id: 'running',
    label: { ko: '런닝', en: 'Running', ja: 'ランニング', zh: '跑步', vi: 'Chạy bộ', th: 'วิ่ง', ru: 'Бег', id: 'Lari' },
    photo: hobbyRunning,
    title: tr('달리는 순간이 가장 행복해요!', 'I’m happiest when I’m running!', {"ja":"走っている瞬間がいちばん幸せ！","zh":"奔跑的时刻最幸福！","vi":"Lúc chạy bộ là lúc mình hạnh phúc nhất!","th":"ตอนวิ่งคือช่วงเวลาที่มีความสุขที่สุด!","ru":"Я счастливее всего, когда бегу!","id":"Saat berlari adalah saat paling bahagia!"}),
    /* The frame's copy runs "제주 곳곳을" — carried over from 제주's 하영. */
    body: tr('상쾌한 바람을 맞으며 곳곳을 달리는 시간을 사랑해요. 좋은 코스만 보이면 언제 어디서든 바로 러닝을 즐긴답니다.', 'I love running through new places with a fresh breeze on my face. Whenever I spot a good route, I’m off for a run — anytime, anywhere.', {"ja":"さわやかな風を受けながら、あちこちを走る時間が大好き。良いコースを見つけたら、いつでもどこでもすぐにランニングを楽しみます。","zh":"我喜欢迎着清爽的风四处奔跑。只要看到好路线，随时随地都会跑起来。","vi":"Mình rất thích chạy khắp nơi trong làn gió mát. Hễ thấy cung đường đẹp là mình chạy ngay, bất cứ lúc nào, ở đâu.","th":"ชอบวิ่งไปทั่วท่ามกลางสายลมสดชื่น เจอเส้นทางดี ๆ เมื่อไหร่ก็พร้อมออกวิ่งได้ทุกที่ทุกเวลา","ru":"Обожаю бегать по новым местам, подставляя лицо свежему ветру. Увижу хороший маршрут — сразу на пробежку, когда угодно и где угодно.","id":"Aku suka berlari ke mana-mana diterpa angin segar. Begitu melihat rute yang bagus, aku langsung lari — kapan pun, di mana pun."}),
  },
  {
    id: 'skiing',
    label: { ko: '스키', en: 'Skiing', ja: 'スキー', zh: '滑雪', vi: 'Trượt tuyết', th: 'สกี', ru: 'Лыжи', id: 'Ski' },
    photo: hobbySkiing,
    title: tr('슬로프를 질주하면, 스트레스가 싹 날아가요!', 'Racing down the slope blows all my stress away!', {"ja":"ゲレンデを滑走すると、ストレスが吹き飛ぶ！","zh":"在雪道上飞驰，压力一扫而空！","vi":"Lao xuống dốc tuyết, căng thẳng tan biến hết!","th":"ได้ซิ่งลงลานสกี ความเครียดหายเกลี้ยง!","ru":"Мчусь по склону — и стресс как рукой снимает!","id":"Meluncur di lereng, stres langsung hilang!"}),
    body: tr('하얀 설원 위에서 시원한 바람을 가르며 스키 타는 순간이 정말 좋아요. 설원에서 스키를 즐기며 힐링하고, 멋진 스키웨어 스타일링도 함께 즐겨보세요!', 'I love skiing across the white snowfields, cutting through the cool wind. Unwind on the slopes — and have fun styling a great ski outfit too!', {"ja":"真っ白な雪原で冷たい風を切って滑る瞬間が本当に好き。雪の上でスキーを楽しんで癒やされて、素敵なスキーウェアのコーデも一緒に楽しんでみて！","zh":"我超爱在白色雪原上迎着凉风滑雪的瞬间。在雪原上尽情滑雪、放松身心，也一起享受帅气的滑雪服搭配吧！","vi":"Mình rất thích lướt trên cánh đồng tuyết trắng, xé gió mát lạnh. Hãy trượt tuyết để thư giãn và cùng phối những bộ đồ trượt tuyết thật đẹp nhé!","th":"ชอบช่วงเวลาที่ได้เล่นสกีฝ่าลมเย็นบนลานหิมะสีขาวมาก ๆ มาเล่นสกีผ่อนคลายบนหิมะ และสนุกกับการแต่งชุดสกีเท่ ๆ ด้วยกันนะ!","ru":"Обожаю мчаться по белоснежным склонам навстречу прохладному ветру. Отдохните душой на лыжне — и заодно подберите себе стильный лыжный образ!","id":"Aku suka sekali bermain ski di hamparan salju putih, membelah angin sejuk. Yuk, healing sambil bermain ski dan bergaya dengan baju ski yang keren!"}),
  },
  {
    id: 'tennis',
    label: { ko: '테니스', en: 'Tennis', ja: 'テニス', zh: '网球', vi: 'Quần vợt', th: 'เทนนิส', ru: 'Теннис', id: 'Tenis' },
    photo: hobbyTennis,
    title: tr('테니스는 내 스트레스 해소법!', 'Tennis is how I beat stress!', {"ja":"テニスは私のストレス解消法！","zh":"网球是我的解压方式！","vi":"Quần vợt là cách mình xả stress!","th":"เทนนิสคือวิธีคลายเครียดของฉัน!","ru":"Теннис — мой способ снять стресс!","id":"Tenis adalah caraku melepas stres!"}),
    body: tr('랠리를 이어가며 한 점 한 점 승부를 즐기는 시간이 가장 행복해요. 친구들과 함께 경기를 하거나 새로운 기술을 연습하며 건강한 에너지를 충전한답니다.', 'Nothing makes me happier than a long rally, fighting for every point. Playing with friends or practising new shots recharges me with healthy energy.', {"ja":"ラリーを続けながら一点一点の勝負を楽しむ時間がいちばん幸せ。友達と試合をしたり新しい技を練習したりして、元気なエネルギーをチャージしています。","zh":"一来一回地对打、享受每一分的较量，是我最幸福的时光。和朋友比赛或练习新技术，让我充满健康的能量。","vi":"Không gì vui bằng những pha đôi công dài, tranh từng điểm một. Chơi cùng bạn bè hay tập kỹ thuật mới giúp mình nạp đầy năng lượng tích cực.","th":"ช่วงเวลาที่ได้ตีโต้ต่อเนื่องและลุ้นทีละแต้มคือช่วงที่มีความสุขที่สุด ได้เล่นกับเพื่อน ๆ หรือฝึกท่าใหม่ ๆ ช่วยเติมพลังดี ๆ ให้ร่างกาย","ru":"Нет ничего лучше долгого розыгрыша, когда борешься за каждое очко. Игра с друзьями или отработка новых ударов заряжает меня здоровой энергией.","id":"Paling bahagia saat reli panjang, berebut poin demi poin. Bertanding bersama teman atau berlatih teknik baru mengisi ulang energiku."}),
  },
];

/**
 * 건강습관 (7956:73234 목·어깨, 73319 허리, 73403 기분전환). The frames' captions
 * are written for drivers; the sheet's older `Greeting_Stretching_*` rows are
 * not used.
 */
const HEALTH: Topic[] = [
  {
    id: 'neck',
    label: { ko: '목·어깨', en: 'Neck & shoulders', ja: '首・肩', zh: '颈部·肩膀', vi: 'Cổ & vai', th: 'คอ·ไหล่', ru: 'Шея и плечи', id: 'Leher & bahu' },
    photo: healthNeck,
    title: tr('몸도 가볍게 풀어보세요.', 'Loosen up your body, too.', {"ja":"体も軽くほぐしてみて。","zh":"也来放松一下身体吧。","vi":"Thả lỏng cơ thể một chút nhé.","th":"ลองยืดเหยียดร่างกายเบา ๆ กันนะ","ru":"Немного разомнитесь.","id":"Regangkan juga tubuhmu."}),
    body: tr('운전을 하며 쌓인 목과 어깨의 긴장을 가볍게 풀어보세요. 화면 속 동작을 천천히 따라 하며 몸을 리프레시하고, 더욱 편안하게 운전하세요.', 'Ease the tension that builds up in your neck and shoulders while driving. Slowly follow the moves on screen to refresh your body, then drive on in comfort.', {"ja":"運転でたまった首と肩のこわばりを軽くほぐしましょう。画面の動きをゆっくりまねして体をリフレッシュし、もっと快適に運転してください。","zh":"轻轻舒缓开车时积累的颈部和肩膀紧张。慢慢跟着画面中的动作做，让身体焕然一新，开车更舒适。","vi":"Hãy thả lỏng cổ và vai căng cứng sau khi lái xe. Chậm rãi làm theo động tác trên màn hình để cơ thể sảng khoái, rồi lái xe thoải mái hơn.","th":"คลายความตึงของคอและไหล่ที่สะสมจากการขับรถ ค่อย ๆ ทำตามท่าบนหน้าจอเพื่อให้ร่างกายสดชื่น แล้วขับรถต่ออย่างสบายขึ้น","ru":"Снимите напряжение в шее и плечах, накопившееся за рулём. Медленно повторяйте движения с экрана, освежите тело — и ехать станет легче.","id":"Lepaskan ketegangan leher dan bahu setelah menyetir. Ikuti gerakan di layar perlahan untuk menyegarkan tubuh, lalu lanjutkan berkendara dengan nyaman."}),
  },
  {
    id: 'waist',
    label: { ko: '허리', en: 'Back', ja: '腰', zh: '腰部', vi: 'Lưng', th: 'หลัง', ru: 'Спина', id: 'Pinggang' },
    photo: healthWaist,
    title: tr('지친 몸, 잠시 쉬어가세요.', 'Tired? Take a short break.', {"ja":"疲れた体、少しひと休みしましょう。","zh":"疲惫的身体，稍作休息吧。","vi":"Mệt rồi, nghỉ chân một lát nhé.","th":"เหนื่อยแล้ว พักสักครู่นะ","ru":"Устали? Сделайте паузу.","id":"Lelah? Istirahat sejenak."}),
    body: tr('운전 하느라 뻐근해진 몸을 가볍게 풀어보세요.\n간단한 스트레칭으로 몸의 긴장을 풀고, 편안한 마음으로 안전한 운전하세요.', 'Loosen up a body stiff from driving.\nA few simple stretches ease the tension, so you can drive on safely and relaxed.', {"ja":"運転でこわばった体を軽くほぐしましょう。\n簡単なストレッチで緊張をゆるめ、リラックスして安全運転を。","zh":"轻轻舒展因开车而僵硬的身体。\n简单拉伸放松身体，以轻松的心情安全驾驶。","vi":"Thả lỏng cơ thể ê ẩm vì lái xe.\nVài động tác giãn cơ đơn giản giúp bạn thư thái và lái xe an toàn.","th":"คลายร่างกายที่ปวดเมื่อยจากการขับรถ\nยืดเส้นง่าย ๆ ช่วยคลายความตึง ขับรถอย่างปลอดภัยด้วยใจที่สบาย","ru":"Разомните тело, затёкшее за рулём.\nПростая растяжка снимет напряжение — и вы спокойно продолжите путь.","id":"Lemaskan tubuh yang kaku karena menyetir.\nPeregangan sederhana meredakan ketegangan, agar berkendara tetap aman dan santai."}),
  },
  {
    id: 'refresh',
    label: { ko: '기분전환', en: 'Refresh', ja: '気分転換', zh: '换换心情', vi: 'Thư giãn', th: 'เปลี่ยนอารมณ์', ru: 'Перезагрузка', id: 'Segarkan diri' },
    photo: healthRefresh,
    title: tr('잠시 멈춰, 기분 좋은 에너지를 채워보세요.', 'Pause for a moment and recharge.', {"ja":"少し立ち止まって、心地よいエネルギーを充電しましょう。","zh":"停一停，补充满满好能量。","vi":"Dừng lại một chút, nạp năng lượng tích cực.","th":"หยุดพักสักนิด เติมพลังดี ๆ กันเถอะ","ru":"Остановитесь на минутку и наберитесь сил.","id":"Berhenti sejenak dan isi ulang energimu."}),
    body: tr('간단한 스트레칭을 따라 하며 긴장을 풀고, 여행 중 쌓인 피로를 자연스럽게 덜어보세요. 잠깐의 휴식이 여행을 더욱 즐겁게 만드는 특별한 시간이 될 거예요.', 'Follow some simple stretches to unwind and let the tiredness of the trip fade. A short break can make the rest of your trip even more enjoyable.', {"ja":"簡単なストレッチをまねして緊張をほぐし、旅の疲れを自然にやわらげましょう。少しの休憩が、旅をもっと楽しくする特別な時間になります。","zh":"跟着简单的拉伸动作放松身心，自然缓解旅途中的疲劳。片刻的休息会成为让旅程更愉快的特别时光。","vi":"Làm theo vài động tác giãn cơ đơn giản để thư giãn và vơi bớt mệt mỏi của chuyến đi. Một chút nghỉ ngơi sẽ khiến hành trình thêm vui vẻ.","th":"ทำตามท่ายืดเส้นง่าย ๆ เพื่อผ่อนคลาย และลดความเหนื่อยล้าจากการเดินทาง การพักสั้น ๆ จะทำให้ทริปสนุกยิ่งขึ้น","ru":"Повторите несложную растяжку, расслабьтесь и снимите усталость от поездки. Короткий отдых сделает путешествие ещё приятнее.","id":"Ikuti peregangan sederhana untuk rileks dan meredakan lelah selama perjalanan. Istirahat sejenak akan membuat perjalanan makin menyenangkan."}),
  },
];

/**
 * The photo slot and caption offset per tab: 취미생활 draws an 853×1515 photo
 * with its copy 56 into the card, 건강습관 an 869×1546 one with it 60 in.
 */
const PANEL: Record<TopicTabId, { width: number; height: number; captionTop: number }> = {
  hobbies: { width: 853, height: 1515, captionTop: 56 },
  health: { width: 869, height: 1546, captionTop: 60 },
};

const TOPICS: Record<TopicTabId, Topic[]> = { hobbies: HOBBIES, health: HEALTH };

/** What follows each sub-tab label in the frames' one text node. */
const SUB_GAPS = ['        ㅣ          ', '        ㅣ          '];

/** The TikTok tile has no 휴 account behind it, so both codes are Instagram. */
const SOCIAL_LINKS = [
  { id: 'tiktok', icon: tiktokIcon, url: INSTAGRAM_URL },
  { id: 'instagram', icon: instaIcon, url: INSTAGRAM_URL },
];

/** Sheet titles carry a leading "> " list marker — drop it for display. */
const stripArrow = (s: string): string => s.replace(/^\s*>\s*/, '');

function hashPill(raw: string): string {
  const bare = raw.replace(/^#+/, '').trim();
  return bare ? `#${bare}` : '';
}

/** Hashtag pills + the TikTok/Instagram tiles and their codes. */
function HelloFooter({ lang, className }: { lang: Lang; className: string }): JSX.Element {
  const tags = ['Greeting_Tag1', 'Greeting_Tag2', 'Greeting_Tag3'].map((k) => hashPill(t(k, lang))).filter(Boolean);
  /* Three 322 pills fit the row beside the four social tiles in Korean;
     "#Xin chào Hyu" or "#Привет Хью" is wider than its pill. The pills keep
     their text whole and the row's hashtag type shrinks together (--fit) until
     the footer fits its 1582. */
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

interface Props {
  controller: KioskController;
}

export function HwaseongHello({ controller }: Props): JSX.Element {
  const lang = useLang();
  const [tab, setTab] = useState<TabId>('profile');
  const [topic, setTopic] = useState<Record<TopicTabId, string>>({
    hobbies: HOBBIES[0]!.id,
    health: HEALTH[0]!.id,
  });
  const tabsRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const L = (key: string): string => t(key, lang);
  const text = (v: L8 | string): string => (typeof v === 'string' ? L(v) : pick(v, lang));
  const goHome = (): void => controller.navigate('home', 'Back');
  const banner = hwaseongIconUrl('banner-search');
  /*
   * ♿ (안녕 '휴' 7956:73907 소개): HwaseongKiosk moves the page under the mode
   * bar; the tabs drop to the foot (3430) with the topic row under them
   * (3650), the promo goes, and the content takes the freed band — the same
   * marks as 오산's ♿ 안녕 '정이'.
   */
  const low = useAccessibilityStore((st) => st.lowReach);

  const topics = tab === 'profile' ? null : TOPICS[tab];
  const topicId = tab === 'profile' ? '' : topic[tab];
  const current = topics ? (topics.find((x) => x.id === topicId) ?? topics[0]!) : null;

  const pickTab = (id: TabId): void => {
    trackEvent({ name: 'button_clicked', payload: { screen: 'hello', tab: id, kiosk: 'W005' } });
    setTab(id);
  };

  const wide = lang !== 'ko';
  useFitText(tabsRef, styles.tab, wide, 0.72, lang);
  /* The sheet's copy is longer than the frame's, so the detail block and the
     caption shrink as one when they outgrow their slots. */
  useFitText(detailsRef, styles.details, true, 0.7, `${lang}|${tab}`, 'height');
  useFitText(captionRef, styles.topicText, true, 0.7, `${lang}|${tab}|${topicId}`, 'height');

  return (
    <div className={low ? `${styles.root} ${styles.low}` : styles.root}>
      <HwaseongPageBg />

      <HwaseongHeader controller={controller} title="안녕 '휴'" onHome={goHome} onBack={goHome} />

      <div ref={tabsRef} className={styles.tabs}>
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            className={`${styles.tab} ${wide ? styles.tabLong : ''} ${tab === x.id ? styles.tabSelected : ''}`}
            onClick={() => pickTab(x.id)}
          >
            {pick(x.label, lang)}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className={styles.card}>
          <div className={styles.portrait}>
            {/* 휴's intro clip, looped and muted like 오산's 정이. No poster: the
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
              <p className={styles.label}>{L('Greeting_Name')}</p>
              <span className={styles.namePlate}>{L('Greeting_NameContent')}</span>
            </div>
            {PROFILE_KEYS.map(([labelKey, valueKey]) => (
              <div key={labelKey} className={styles.row}>
                <p className={styles.label}>{L(labelKey)}</p>
                <p className={styles.value}>{L(valueKey)}</p>
              </div>
            ))}
          </div>

          <div className={styles.divider} />

          <div ref={detailsRef} className={styles.details}>
            {DETAIL_KEYS.map(([labelKey, valueKey]) => {
              const value = L(valueKey);
              return value ? (
                <div key={labelKey} className={styles.detailRow}>
                  <p className={styles.detailLabel}>{L(labelKey)}</p>
                  <p className={styles.detailValue}>{value}</p>
                </div>
              ) : null;
            })}
          </div>

          <HelloFooter lang={lang} className={styles.footerProfile ?? ''} />
        </div>
      )}

      {topics && current && tab !== 'profile' && (
        <>
          <p className={styles.subTabs}>
            {topics.map((x, i) => (
              <Fragment key={x.id}>
                <button
                  type="button"
                  className={`${styles.subTab} ${x.id === current.id ? styles.subTabOn : ''}`}
                  data-label={pick(x.label, lang)}
                  onClick={() => setTopic((prev) => ({ ...prev, [tab]: x.id }))}
                >
                  <span>{pick(x.label, lang)}</span>
                </button>
                {SUB_GAPS[i]}
              </Fragment>
            ))}
          </p>

          <div
            className={styles.topicPhoto}
            style={{
              width: PANEL[tab].width,
              height: PANEL[tab].height,
              /* ♿ the photo stays where the normal page draws it (1081), so it
                 undoes the mode shift. */
              ...(low ? { top: 'calc(1081px - var(--hwaseong-mode-push, 0px))' } : {}),
            }}
          >
            {current.photo && <img src={current.photo} alt="" draggable={false} />}
          </div>

          <div className={styles.topicCard}>
            <div ref={captionRef} className={styles.topicText} style={{ top: PANEL[tab].captionTop }}>
              <p className={styles.topicTitle}>{stripArrow(text(current.title))}</p>
              <p className={styles.topicBody}>{text(current.body)}</p>
            </div>
            <HelloFooter lang={lang} className={styles.footerTopic ?? ''} />
          </div>
        </>
      )}

      <HwaseongLeftNav onHome={goHome} onBack={goHome} />

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
