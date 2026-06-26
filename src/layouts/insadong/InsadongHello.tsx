import { Fragment, useEffect, useState } from 'react';
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import portrait from '@renderer/assets/photos/insadong/hello/portrait.png';
import tiktokIcon from '@renderer/assets/photos/insadong/hello/asset-1.png';
import instaIcon from '@renderer/assets/photos/insadong/hello/asset-2.png';
import hobbyKpop from '@renderer/assets/photos/insadong/hello/hobby-kpop.jpg';
import hobbyGolf from '@renderer/assets/photos/insadong/hello/hobby-golf.jpg';
import hobbyTennis from '@renderer/assets/photos/insadong/hello/hobby-tennis.jpg';
import stretch1 from '@renderer/assets/photos/insadong/hello/stretch-1.jpg';
import stretch2 from '@renderer/assets/photos/insadong/hello/stretch-2.jpg';
import stretch3 from '@renderer/assets/photos/insadong/hello/stretch-3.jpg';
import stretchSide from '@renderer/assets/photos/insadong/hello/stretch-side.jpg';
import qrInsaTiktok from '@renderer/assets/photos/insadong/hello/qr-insa-tiktok.png';
import qrInsaInsta from '@renderer/assets/photos/insadong/hello/qr-insa-insta.png';
import { InsadongHeader } from './InsadongHeader';
import styles from './InsadongHello.module.css';

type Lang = SupportedLanguage;
function pick<T>(map: Partial<Record<Lang, T>>, lang: Lang): T {
  return (map[lang] ?? map.ko ?? (Object.values(map)[0] as T)) as T;
}

interface HelloContent {
  title: string;
  tabs: [string, string, string];
  nameLabel: string;
  nameValue: string;
  profile: { label: string; value: string }[];
  details: { label: string; lines: string[] }[];
  hobbies: { title: string; lines: string[] }[];
  stretchTitle: string;
  stretchLines: string[];
  stretchSections: { title: string; lines: string[] }[];
  hashtags: [string, string, string];
  /** Labels for the 3 social links (인사 TikTok, 인사 Insta, 정이 Insta). */
  socialLabels: [string, string, string];
}

const CONTENT: Partial<Record<Lang, HelloContent>> = {
  ko: {
    title: "안녕 '인사'",
    tabs: ['인사 소개', '인사 취미생활', '스트레칭 합시다'],
    nameLabel: '이름',
    nameValue: '인사',
    profile: [
      { label: '출생', value: '2005년 9월 30일' },
      { label: '출신', value: '서울 종로구 인사동' },
      { label: '국적', value: '대한민국' },
      { label: '혈액형', value: 'A형' },
      { label: 'MBTI', value: 'ENTJ' },
    ],
    details: [
      { label: '신체', lines: ['168cm, B형 , 235mm,  (몸무게는 비밀..)'] },
      { label: '취미', lines: ['카페가기, K-POP춤추기, 테니스 , 골프'] },
      { label: '특기', lines: ['노래'] },
      { label: '장래희망', lines: ['인사동을 전 세계에 알리는 홍보모델이 되고 싶어요.', '한복모델, K-POP아이돌도요!'] },
      {
        label: '자기소개',
        lines: [
          'MZ세대! 강아지와 고양이 러버.',
          '한식을 즐겨먹고 사진찍기 , 인스타그램, 틱톡하는 것을 좋아해요. 맛집 탐방, 옷도 좋아해요!',
          '또 교복입고 놀이동산가기, 한복입고 고궁 놀러가기',
          'K-POP아이돌도 좋아해요.',
          '인스타그램 놀러오세요 @insa_stagram',
        ],
      },
    ],
    hobbies: [
      { title: 'K-POP 댄스와 노래는 나의 열정!', lines: ['무대 위 아이돌처럼! 인사는 K-POP 댄스를 따라 추고 노래하는 걸 사랑해요.', '인사의 최애 곡이 나오면 언제 어디서든 바로 댄스 타임!'] },
      { title: '골프장에서 힐링 타임', lines: ['얼마전부터 배우기 시작한 골프(골린이)', '녹색 잔디 위에서 시원한 바람은 기분까지 상쾌하게 만들어줘요', '잔디 위에서 여유롭게 스윙~', '골프를 즐기며 자연 속에서 힐링해요.', '멋진 골프웨어 스타일링도 놓칠 수 없죠!'] },
      { title: '테니스는 내 스트레스 해소법!', lines: ['인사가 가장 좋아하는 운동은 테니스~', '빠르게 움직이고 스매시 한 방!', '인사는 테니스를 치면서 에너지를 발산해요. 친구들과 팀을 짜서 게임을 하거나, 조용한 아침에 혼자 연습하는 것도 좋아해요.', '땀 흘린 후 시원한 음료 한 잔까지, 이게 바로 인사만의 완벽한 하루!'] },
    ],
    stretchTitle: '인사랑 함께 가볍게 스트레칭 해요!',
    stretchLines: ['오랜 시간 걷기 전에, 잠깐! 저를 따라 가볍게 몸을 풀어볼까요?', '기분도 리프레시~ 에너지도 업!', '화면 속 저를 따라 천천히 따라 해보세요.', '스트레칭 후엔 더 가볍고 즐겁게 인사동을 여행할 수 있어요~'],
    stretchSections: [
      { title: '피로 예방!', lines: ['계속 걷다 보면 다리와 허리에 피로가 쌓여요.', '중간에 가볍게 스트레칭하면 몸이 훨씬 편해져요!', "'인사'와 함께 간단한 운동을 함께 해봐요"] },
      { title: '기분 전환!', lines: ['스트레칭은 몸뿐 아니라 마음까지 리프레시!', '활력 충전하고 더 신나게 여행할 수 있어요.', '잠시 쉬었다가는 휴식 타임 어떠신가요~'] },
    ],
    hashtags: ['#INSA', '#인사', '#안녕인사'],
    socialLabels: ['인사 TikTok', '인사 Insta', '정이 Insta'],
  },
  en: {
    title: 'Hello, INSA',
    tabs: ['Profile', 'Hobbies', 'Stretching'],
    nameLabel: 'Name',
    nameValue: 'INSA',
    profile: [
      { label: 'Born', value: 'Sep 30, 2005' },
      { label: 'From', value: 'Insadong, Jongno-gu, Seoul' },
      { label: 'Nationality', value: 'Republic of Korea' },
      { label: 'Blood type', value: 'Type A' },
      { label: 'MBTI', value: 'ENTJ' },
    ],
    details: [
      { label: 'Body', lines: ['168cm, Type B, 235mm  (weight is a secret..)'] },
      { label: 'Hobbies', lines: ['Cafés, K-POP dancing, tennis, golf'] },
      { label: 'Talent', lines: ['Singing'] },
      { label: 'Dream', lines: ['I want to be a model who shares Insadong with the whole world.', 'A hanbok model and a K-POP idol too!'] },
      {
        label: 'About me',
        lines: [
          'Gen MZ! A dog and cat lover.',
          'I love Korean food, taking photos, Instagram and TikTok. I also love finding great restaurants and fashion!',
          'Plus amusement parks in school uniforms, and visiting palaces in hanbok.',
          'I love K-POP idols too.',
          'Come visit my Instagram @insa_stagram',
        ],
      },
    ],
    hobbies: [
      { title: 'K-POP dance & song are my passion!', lines: ['Like an idol on stage! INSA loves dancing and singing along to K-POP.', 'When my favorite song comes on, it’s dance time anywhere, anytime!'] },
      { title: 'Healing time at the golf course', lines: ['I recently started golf (a total beginner).', 'A cool breeze over the green grass refreshes my whole mood.', 'A relaxed swing on the green~', 'I find healing in nature while enjoying golf.', 'And a stylish golf-wear look is a must!'] },
      { title: 'Tennis is my stress reliever!', lines: ['INSA’s favorite sport is tennis~', 'Move fast and smash it!', 'I release energy by playing tennis — teaming up with friends, or practicing alone on a quiet morning.', 'A cool drink after a good sweat — that’s INSA’s perfect day!'] },
    ],
    stretchTitle: 'Let’s stretch lightly with INSA!',
    stretchLines: ['Before a long walk, wait! Follow me and loosen up a little.', 'Refresh your mood~ and boost your energy!', 'Follow me on the screen, slowly, step by step.', 'After stretching you can travel Insadong more lightly and happily~'],
    stretchSections: [
      { title: 'Prevent fatigue!', lines: ['Walking for a long time tires your legs and back.', 'A light stretch in between makes your body feel much better!', 'Let’s do some simple exercises together with INSA.'] },
      { title: 'Refresh your mood!', lines: ['Stretching refreshes not only the body but the mind!', 'Recharge your energy and travel with more excitement.', 'How about a little rest break in between~'] },
    ],
    hashtags: ['#INSA', '#Insa', '#HelloInsa'],
    socialLabels: ['INSA · TikTok', 'INSA · Insta', 'JEONG-I · Insta'],
  },
  ja: {
    title: 'こんにちは、インサ',
    tabs: ['インサ紹介', 'インサの趣味', 'ストレッチしよう'],
    nameLabel: '名前',
    nameValue: 'インサ',
    profile: [
      { label: '誕生', value: '2005年9月30日' },
      { label: '出身', value: 'ソウル鍾路区仁寺洞' },
      { label: '国籍', value: '大韓民国' },
      { label: '血液型', value: 'A型' },
      { label: 'MBTI', value: 'ENTJ' },
    ],
    details: [
      { label: '身体', lines: ['168cm、B型、235mm（体重は秘密..）'] },
      { label: '趣味', lines: ['カフェ巡り、K-POPダンス、テニス、ゴルフ'] },
      { label: '特技', lines: ['歌'] },
      { label: '将来の夢', lines: ['仁寺洞を世界に広める広報モデルになりたいです。', '韓服モデルやK-POPアイドルも！'] },
      {
        label: '自己紹介',
        lines: [
          'MZ世代！犬と猫が大好き。',
          '韓国料理が好きで、写真を撮ったりインスタやTikTokをするのが好きです。グルメ巡りや服も大好き！',
          '制服で遊園地、韓服で古宮めぐりも。',
          'K-POPアイドルも大好きです。',
          'インスタに遊びに来てね @insa_stagram',
        ],
      },
    ],
    hobbies: [
      { title: 'K-POPダンスと歌は私の情熱！', lines: ['ステージ上のアイドルのように！インサはK-POPに合わせて踊って歌うのが大好き。', 'お気に入りの曲が流れたら、いつでもどこでもダンスタイム！'] },
      { title: 'ゴルフ場で癒しのひととき', lines: ['最近始めたゴルフ（初心者）', '緑の芝生の上の爽やかな風が気分まで爽快に。', '芝生の上でゆったりスイング〜', 'ゴルフを楽しみながら自然の中で癒されます。', 'おしゃれなゴルフウェアのスタイリングも見逃せません！'] },
      { title: 'テニスは私のストレス解消法！', lines: ['インサが一番好きなスポーツはテニス〜', '素早く動いてスマッシュ一発！', 'テニスでエネルギーを発散します。友達とチームを組んだり、静かな朝に一人で練習するのも好き。', '汗をかいた後の冷たい一杯まで、これがインサの完璧な一日！'] },
    ],
    stretchTitle: 'インサと一緒に軽くストレッチしましょう！',
    stretchLines: ['長時間歩く前に、ちょっと待って！私に合わせて軽く体をほぐしましょう。', '気分もリフレッシュ〜エネルギーもアップ！', '画面の私に合わせてゆっくり真似してみてください。', 'ストレッチの後はもっと軽やかに楽しく仁寺洞を旅できます〜'],
    stretchSections: [
      { title: '疲労予防！', lines: ['歩き続けると脚や腰に疲れがたまります。', '途中で軽くストレッチすると体がずっと楽になります！', 'インサと一緒に簡単な運動をしてみましょう。'] },
      { title: '気分転換！', lines: ['ストレッチは体だけでなく心までリフレッシュ！', '活力をチャージしてもっと楽しく旅できます。', '少し休憩タイムはいかがですか〜'] },
    ],
    hashtags: ['#INSA', '#インサ', '#こんにちはインサ'],
    socialLabels: ['インサ · TikTok', 'インサ · Insta', 'ジョンイ · Insta'],
  },
  zh: {
    title: '你好，INSA',
    tabs: ['INSA介绍', 'INSA的兴趣', '一起伸展运动'],
    nameLabel: '姓名',
    nameValue: 'INSA',
    profile: [
      { label: '出生', value: '2005年9月30日' },
      { label: '出身', value: '首尔钟路区仁寺洞' },
      { label: '国籍', value: '大韩民国' },
      { label: '血型', value: 'A型' },
      { label: 'MBTI', value: 'ENTJ' },
    ],
    details: [
      { label: '身体', lines: ['168cm，B型，235mm（体重保密..）'] },
      { label: '爱好', lines: ['逛咖啡馆、跳K-POP、网球、高尔夫'] },
      { label: '特长', lines: ['唱歌'] },
      { label: '理想', lines: ['我想成为把仁寺洞推广到全世界的宣传模特。', '也想当韩服模特和K-POP偶像！'] },
      {
        label: '自我介绍',
        lines: [
          'MZ世代！爱狗爱猫。',
          '喜欢吃韩餐、拍照、玩Instagram和TikTok。也喜欢探店和穿搭！',
          '还喜欢穿校服去游乐园、穿韩服逛古宫。',
          '也喜欢K-POP偶像。',
          '欢迎来我的Instagram @insa_stagram',
        ],
      },
    ],
    hobbies: [
      { title: 'K-POP舞蹈和歌唱是我的热情！', lines: ['像舞台上的偶像一样！INSA热爱跟着K-POP跳舞唱歌。', '最爱的歌一响起，随时随地都是舞蹈时间！'] },
      { title: '在高尔夫球场享受疗愈时光', lines: ['最近开始学高尔夫（新手）。', '绿草地上的清风让心情都变得舒畅。', '在草地上悠闲挥杆～', '一边打高尔夫一边在自然中疗愈。', '时尚的高尔夫球服搭配也不能错过！'] },
      { title: '网球是我的解压方式！', lines: ['INSA最喜欢的运动是网球～', '快速移动，一记扣杀！', 'INSA通过打网球释放能量。和朋友组队比赛，或在安静的早晨独自练习都喜欢。', '流汗后再来一杯清凉饮料，这就是INSA的完美一天！'] },
    ],
    stretchTitle: '和INSA一起轻松伸展吧！',
    stretchLines: ['长时间步行前，等一下！跟着我轻轻活动一下身体吧。', '心情焕然一新～能量满满！', '跟着屏幕里的我，慢慢一起做。', '伸展之后就能更轻松愉快地游览仁寺洞～'],
    stretchSections: [
      { title: '预防疲劳！', lines: ['一直走路腿和腰会累积疲劳。', '中途轻轻伸展，身体会舒服很多！', '和"INSA"一起做些简单运动吧。'] },
      { title: '转换心情！', lines: ['伸展不仅放松身体，也让心情焕然一新！', '补充活力，旅行更尽兴。', '中途休息一下如何～'] },
    ],
    hashtags: ['#INSA', '#仁莎', '#你好仁莎'],
    socialLabels: ['INSA · TikTok', 'INSA · Insta', 'JEONG-I · Insta'],
  },
};

const HOBBY_IMAGES = [hobbyKpop, hobbyGolf, hobbyTennis];
const STRETCH_PHOTOS = [stretch1, stretch2, stretch3];
// Figma footer = 인사's TikTok + Instagram (no duplicate Instagram).
const SOCIAL_LINKS = [
  { icon: tiktokIcon, qr: qrInsaTiktok },
  { icon: instaIcon, qr: qrInsaInsta },
];

/** Shared hashtags + social (TikTok/Instagram + QR) footer, on every tab. */
function HelloFooter({ c }: { c: HelloContent }): JSX.Element {
  return (
    <div className={styles.footer}>
      {c.hashtags.map((h) => (
        <span key={h} className={styles.hashtag}>
          {h}
        </span>
      ))}
      {/* Figma: flat row of TikTok · QR · Instagram · QR — no labels underneath. */}
      <div className={styles.socials}>
        {SOCIAL_LINKS.map((s, i) => (
          <Fragment key={i}>
            <img className={styles.socialIcon} src={s.icon} alt="" draggable={false} />
            <div className={styles.socialQr}>
              <img src={s.qr} alt="" draggable={false} />
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

interface InsadongHelloProps {
  controller: KioskController;
  debug?: boolean;
}

/** 안녕 '인사' — 인사 mascot: profile / hobbies / stretching tabs (editable Figma). */
export function InsadongHello({ controller }: InsadongHelloProps): JSX.Element {
  const banner = useRotatingBanner();
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLanguageStore((s) => s.currentLanguage);
  const c = pick(CONTENT, lang);
  const [tab, setTab] = useState(0);

  // Switch the customer-display video per tab (소개 / 취미 / 스트레칭).
  useEffect(() => {
    const key = tab === 1 ? 'hello_hobby' : tab === 2 ? 'hello_stretch' : 'hello';
    void window.api.kiosk.setScreen(key);
  }, [tab]);

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title={c.title} onHome={goHome} />

      <div className={styles.content}>
        <div className={styles.tabs}>
          {c.tabs.map((t, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.tab} ${tab === i ? styles.tabSelected : ''}`}
              onClick={() => setTab(i)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 0 && (
          <div className={styles.card}>
            <div className={styles.topRow}>
              <div className={styles.portrait}>
                <img src={portrait} alt="" draggable={false} />
              </div>
              <div className={styles.infoCol}>
                <div className={styles.nameRow}>
                  <span className={styles.label}>{c.nameLabel}</span>
                  <span className={styles.namePill}>{c.nameValue}</span>
                </div>
                {c.profile.map((p) => (
                  <div key={p.label} className={styles.field}>
                    <span className={styles.label}>{p.label}</span>
                    <span className={styles.value}>{p.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.detailsCol}>
              {c.details.map((d) => (
                <div key={d.label} className={styles.detail}>
                  <span className={styles.label}>{d.label}</span>
                  <div className={styles.detailValue}>
                    {d.lines.map((line, i) => (
                      <span key={i}>{line}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <HelloFooter c={c} />
          </div>
        )}

        {tab === 1 && (
          <div className={styles.card}>
            {c.hobbies.map((h, i) => (
              <div key={i} className={`${styles.hobby} ${i % 2 === 1 ? styles.hobbyReverse : ''}`}>
                <div className={styles.hobbyText}>
                  <p className={styles.hobbyTitle}>{h.title}</p>
                  <div className={styles.hobbyBody}>
                    {h.lines.map((line, j) => (
                      <span key={j}>{line}</span>
                    ))}
                  </div>
                </div>
                <div className={styles.hobbyImg}>
                  <img src={HOBBY_IMAGES[i]} alt="" draggable={false} />
                </div>
              </div>
            ))}
            <HelloFooter c={c} />
          </div>
        )}

        {tab === 2 && (
          <div className={styles.card}>
            <div className={styles.stretchPhotos}>
              {STRETCH_PHOTOS.map((p, i) => (
                <div key={i} className={styles.stretchPhoto}>
                  <img src={p} alt="" draggable={false} />
                </div>
              ))}
            </div>
            <div className={styles.stretchIntro}>
              <p className={styles.stretchIntroTitle}>{c.stretchTitle}</p>
              <div className={styles.stretchIntroBody}>
                {c.stretchLines.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </div>
            </div>
            <div className={styles.stretchBottom}>
              <div className={styles.stretchSections}>
                {c.stretchSections.map((s) => (
                  <div key={s.title} className={styles.stretchSection}>
                    <p className={styles.stretchSecTitle}>{s.title}</p>
                    <div className={styles.stretchSecBody}>
                      {s.lines.map((line, i) => (
                        <span key={i}>{line}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.stretchSide}>
                <img src={stretchSide} alt="" draggable={false} />
              </div>
            </div>
            <HelloFooter c={c} />
          </div>
        )}
      </div>

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="홈으로">
          {iconUrl('home-btn') && <img src={iconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="뒤로">
          {iconUrl('back-arrow') && <img src={iconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>

      {banner && (
        <button type="button" className={styles.banner} onClick={() => controller.startPhoto()} aria-label="가상 한복 체험">
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </>
  );
}
