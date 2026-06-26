import { Fragment, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import portrait from '@renderer/assets/photos/osan/hello/portrait.png';
import tiktokIcon from '@renderer/assets/photos/osan/hello/tiktok.png';
import instaIcon from '@renderer/assets/photos/osan/hello/insta.png';
import hobbyKpop from '@renderer/assets/photos/osan/hello/hobby-kpop.png';
import hobbyGolf from '@renderer/assets/photos/osan/hello/hobby-golf.png';
import hobbyTennis from '@renderer/assets/photos/osan/hello/hobby-tennis.png';
import stretch1 from '@renderer/assets/photos/osan/hello/stretch-1.png';
import stretch2 from '@renderer/assets/photos/osan/hello/stretch-2.png';
import stretch3 from '@renderer/assets/photos/osan/hello/stretch-3.png';
import stretchSide from '@renderer/assets/photos/osan/hello/stretch-side.png';
import { OsanHeader } from './OsanHeader';
import { OsanBanner } from './OsanBanner';
import styles from './OsanHello.module.css';

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
}

/** 안녕 '정이' content — Korean is verbatim from Figma (오산>안녕정이-01/02/03);
 *  other languages adapt the insadong copy with the 정이 / 오색시장 branding. */
const CONTENT: Partial<Record<Lang, HelloContent>> = {
  ko: {
    title: "안녕 '정이'",
    tabs: ["'정이' 소개", "'정이' 취미생활", '스트레칭 고고~'],
    nameLabel: '이름',
    nameValue: '정이',
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
      { label: '장래희망', lines: ['인플루언서로서, 전통시장의 매력을 전 세계에 알리는', '홍보모델이 되고 싶어!'] },
      {
        label: '자기소개',
        lines: [
          '운동 좋아하고 전통시장 구경도 즐기는 20대 소녀!',
          '한식을 진~짜 사랑하고, 시장 먹방은 나만의 힐링 루틴이야. K-POP을 사랑하는 찐 MZ세대!',
          '한국의 매력을 전 세계에 알리는 인플루언서가 되는 게 내 꿈이야!',
        ],
      },
    ],
    hobbies: [
      { title: 'K-POP 댄스와 노래는 나의 무대!', lines: ['무대 위 아이돌처럼! 정이는 K-POP 댄스를 따라 추고 노래하는 걸 사랑해요.', '정이의 최애 곡이 나오면 언제 어디서든 바로 댄스 타임!'] },
      { title: '골프장에서 힐링 타임', lines: ['얼마전부터 배우기 시작한 골프(골린이)', '녹색 잔디 위에서 시원한 바람은 기분까지 상쾌하게 만들어줘요', '잔디 위에서 여유롭게 스윙~', '골프를 즐기며 자연 속에서 힐링해요.', '멋진 골프웨어 스타일링도 놓칠 수 없죠!'] },
      { title: '테니스는 내 스트레스 해소법!', lines: ['정이가 가장 좋아하는 운동은 테니스~', '빠르게 움직이고 스매시 한 방!', '정이는 테니스를 치면서 에너지를 발산해요. 친구들과 팀을 짜서 게임을 하거나, 조용한 아침에 혼자 연습하는 것도 좋아해요.', '땀 흘린 후 시원한 음료 한 잔까지, 이게 바로 정이만의 완벽한 하루!'] },
    ],
    stretchTitle: '정이와 함께 가볍게 스트레칭 해요!',
    stretchLines: ['오랜 시간 걷기 전에, 잠깐! 저를 따라 가볍게 몸을 풀어볼까요?', '기분도 리프레시~ 에너지도 업!', '화면 속 저를 따라 천천히 따라 해보세요.', '스트레칭 후엔 더 가볍고 즐겁게 여행할 수 있어요~'],
    stretchSections: [
      { title: '피로 예방!', lines: ['계속 걷다 보면 다리와 허리에 피로가 쌓여요.', '중간에 가볍게 스트레칭하면 몸이 훨씬 편해져요!', "'정이'와 함께 간단한 운동을 함께 해봐요"] },
      { title: '기분 전환!', lines: ['스트레칭은 몸뿐 아니라 마음까지 리프레시!', '활력 충전하고 더 신나게 여행할 수 있어요.', '잠시 쉬었다가는 휴식 타임 어떠신가요~'] },
    ],
    hashtags: ['#JEONGE', '#정이', '#안녕정이'],
  },
  en: {
    title: "Hello, JEONG-I",
    tabs: ['Profile', 'Hobbies', 'Stretching'],
    nameLabel: 'Name',
    nameValue: 'JEONG-I',
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
      { label: 'Dream', lines: ['As an influencer, I want to share the charm of traditional markets', 'with the whole world as a promotion model!'] },
      {
        label: 'About me',
        lines: [
          'A girl in her 20s who loves sports and exploring traditional markets!',
          'I truly love Korean food, and market food tours are my healing routine. A real Gen-MZ K-POP lover!',
          'My dream is to become an influencer who shares Korea with the whole world!',
        ],
      },
    ],
    hobbies: [
      { title: 'K-POP dance & song are my stage!', lines: ['Like an idol on stage! JEONG-I loves dancing and singing along to K-POP.', 'When my favorite song comes on, it’s dance time anywhere, anytime!'] },
      { title: 'Healing time at the golf course', lines: ['I recently started golf (a total beginner).', 'A cool breeze over the green grass refreshes my whole mood.', 'A relaxed swing on the green~', 'I find healing in nature while enjoying golf.', 'And a stylish golf-wear look is a must!'] },
      { title: 'Tennis is my stress reliever!', lines: ['JEONG-I’s favorite sport is tennis~', 'Move fast and smash it!', 'I release energy by playing tennis — teaming up with friends, or practicing alone on a quiet morning.', 'A cool drink after a good sweat — that’s JEONG-I’s perfect day!'] },
    ],
    stretchTitle: 'Let’s stretch lightly with JEONG-I!',
    stretchLines: ['Before a long walk, wait! Follow me and loosen up a little.', 'Refresh your mood~ and boost your energy!', 'Follow me on the screen, slowly, step by step.', 'After stretching you can travel more lightly and happily~'],
    stretchSections: [
      { title: 'Prevent fatigue!', lines: ['Walking for a long time tires your legs and back.', 'A light stretch in between makes your body feel much better!', 'Let’s do some simple exercises together with JEONG-I.'] },
      { title: 'Refresh your mood!', lines: ['Stretching refreshes not only the body but the mind!', 'Recharge your energy and travel with more excitement.', 'How about a little rest break in between~'] },
    ],
    hashtags: ['#JEONGE', '#JEONG-I', '#HelloJeonge'],
  },
  ja: {
    title: 'こんにちは、ジョンイ',
    tabs: ['ジョンイ紹介', 'ジョンイの趣味', 'ストレッチGOGO~'],
    nameLabel: '名前',
    nameValue: 'ジョンイ',
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
      { label: '将来の夢', lines: ['インフルエンサーとして、伝統市場の魅力を世界に広める', '広報モデルになりたい！'] },
      {
        label: '自己紹介',
        lines: [
          '運動が好きで伝統市場巡りも楽しむ20代の女の子！',
          '韓国料理が大好きで、市場のグルメ巡りは私だけの癒しルーティン。K-POPを愛する真のMZ世代！',
          '韓国の魅力を世界に広めるインフルエンサーになるのが夢！',
        ],
      },
    ],
    hobbies: [
      { title: 'K-POPダンスと歌は私のステージ！', lines: ['ステージ上のアイドルのように！ジョンイはK-POPに合わせて踊って歌うのが大好き。', 'お気に入りの曲が流れたら、いつでもどこでもダンスタイム！'] },
      { title: 'ゴルフ場で癒しのひととき', lines: ['最近始めたゴルフ（初心者）', '緑の芝生の上の爽やかな風が気分まで爽快に。', '芝生の上でゆったりスイング〜', 'ゴルフを楽しみながら自然の中で癒されます。', 'おしゃれなゴルフウェアのスタイリングも見逃せません！'] },
      { title: 'テニスは私のストレス解消法！', lines: ['ジョンイが一番好きなスポーツはテニス〜', '素早く動いてスマッシュ一発！', 'テニスでエネルギーを発散します。友達とチームを組んだり、静かな朝に一人で練習するのも好き。', '汗をかいた後の冷たい一杯まで、これがジョンイの完璧な一日！'] },
    ],
    stretchTitle: 'ジョンイと一緒に軽くストレッチしましょう！',
    stretchLines: ['長時間歩く前に、ちょっと待って！私に合わせて軽く体をほぐしましょう。', '気分もリフレッシュ〜エネルギーもアップ！', '画面の私に合わせてゆっくり真似してみてください。', 'ストレッチの後はもっと軽やかに楽しく旅できます〜'],
    stretchSections: [
      { title: '疲労予防！', lines: ['歩き続けると脚や腰に疲れがたまります。', '途中で軽くストレッチすると体がずっと楽になります！', 'ジョンイと一緒に簡単な運動をしてみましょう。'] },
      { title: '気分転換！', lines: ['ストレッチは体だけでなく心までリフレッシュ！', '活力をチャージしてもっと楽しく旅できます。', '少し休憩タイムはいかがですか〜'] },
    ],
    hashtags: ['#JEONGE', '#ジョンイ', '#こんにちはジョンイ'],
  },
  zh: {
    title: '你好，正伊',
    tabs: ['正伊介绍', '正伊的兴趣', '伸展GOGO~'],
    nameLabel: '姓名',
    nameValue: '正伊',
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
      { label: '理想', lines: ['作为网红，我想把传统市场的魅力推广到全世界', '成为宣传模特！'] },
      {
        label: '自我介绍',
        lines: [
          '一个热爱运动、也喜欢逛传统市场的20多岁女孩！',
          '超爱韩餐，逛市场吃美食是我的专属疗愈routine。热爱K-POP的真·MZ世代！',
          '我的梦想是成为把韩国推广到全世界的网红！',
        ],
      },
    ],
    hobbies: [
      { title: 'K-POP舞蹈和歌唱是我的舞台！', lines: ['像舞台上的偶像一样！正伊热爱跟着K-POP跳舞唱歌。', '最爱的歌一响起，随时随地都是舞蹈时间！'] },
      { title: '在高尔夫球场享受疗愈时光', lines: ['最近开始学高尔夫（新手）。', '绿草地上的清风让心情都变得舒畅。', '在草地上悠闲挥杆～', '一边打高尔夫一边在自然中疗愈。', '时尚的高尔夫球服搭配也不能错过！'] },
      { title: '网球是我的解压方式！', lines: ['正伊最喜欢的运动是网球～', '快速移动，一记扣杀！', '正伊通过打网球释放能量。和朋友组队比赛，或在安静的早晨独自练习都喜欢。', '流汗后再来一杯清凉饮料，这就是正伊的完美一天！'] },
    ],
    stretchTitle: '和正伊一起轻松伸展吧！',
    stretchLines: ['长时间步行前，等一下！跟着我轻轻活动一下身体吧。', '心情焕然一新～能量满满！', '跟着屏幕里的我，慢慢一起做。', '伸展之后就能更轻松愉快地游览～'],
    stretchSections: [
      { title: '预防疲劳！', lines: ['一直走路腿和腰会累积疲劳。', '中途轻轻伸展，身体会舒服很多！', '和"正伊"一起做些简单运动吧。'] },
      { title: '转换心情！', lines: ['伸展不仅放松身体，也让心情焕然一新！', '补充活力，旅行更尽兴。', '中途休息一下如何～'] },
    ],
    hashtags: ['#JEONGE', '#正伊', '#你好正伊'],
  },
};

const HOBBY_IMAGES = [hobbyKpop, hobbyGolf, hobbyTennis];
const STRETCH_PHOTOS = [stretch1, stretch2, stretch3];
/** 정이 has no TikTok → 인사's TikTok fills that slot; Instagram is 정이's.
 *  QR codes are generated live from these URLs. */
const SOCIAL_LINKS = [
  { icon: tiktokIcon, url: 'https://www.tiktok.com/@insa.world' },
  { icon: instaIcon, url: 'https://www.instagram.com/jeong.i_stagram' },
];

function HelloFooter({ c }: { c: HelloContent }): JSX.Element {
  return (
    <div className={styles.footer}>
      {c.hashtags.map((h) => (
        <span key={h} className={styles.hashtag}>
          {h}
        </span>
      ))}
      <div className={styles.socials}>
        {SOCIAL_LINKS.map((s, i) => (
          <Fragment key={i}>
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

/** 안녕 '정이' — 정이 mascot: profile / hobbies / stretching tabs (Figma 오산>안녕정이). */
export function OsanHello({ controller }: OsanHelloProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLanguageStore((s) => s.currentLanguage);
  const c = pick(CONTENT, lang);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const key = tab === 1 ? 'hello_hobby' : tab === 2 ? 'hello_stretch' : 'hello';
    void window.api.kiosk.setScreen(key);
  }, [tab]);

  return (
    <>
      {osanIconUrl('bg') && <img className={styles.bg} src={osanIconUrl('bg')} alt="" draggable={false} />}

      <OsanHeader title={c.title} onHome={goHome} />

      <div className={styles.content}>
        <div className={styles.tabs}>
          {c.tabs.map((tabLabel, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.tab} ${tab === i ? styles.tabSelected : ''}`}
              onClick={() => setTab(i)}
            >
              {tabLabel}
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
          {osanIconUrl('home-btn') && <img src={osanIconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="뒤로">
          {osanIconUrl('back-arrow') && <img src={osanIconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>

      <OsanBanner onClick={() => controller.startPhoto()} />
    </>
  );
}
