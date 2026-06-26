import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import historyImg from '@renderer/assets/photos/osan/about/history.png';
import cultureImg from '@renderer/assets/photos/osan/about/culture.png';
import tourImg from '@renderer/assets/photos/osan/about/tour.png';
import { OsanHeader } from './OsanHeader';
import styles from './OsanAbout.module.css';

type Lang = SupportedLanguage;
function pick<T>(map: Partial<Record<Lang, T>>, lang: Lang): T {
  return (map[lang] ?? map.ko ?? (Object.values(map)[0] as T)) as T;
}

interface AboutContent {
  title: string;
  history: { label: string; body: string };
  culture: { label: string; body: string };
  tour: { label: string; body: string };
}

/** 여기는 오색시장 — text is verbatim from Figma (오산>여기는오색시장); other
 *  languages are translations of the same copy. */
const CONTENT: Partial<Record<Lang, AboutContent>> = {
  ko: {
    title: '여기는 오색시장',
    history: {
      label: '역사',
      body: '인사동은 조선시대부터 한양의 중심지로서, 선비와 학자들이 모여 글을 쓰고 교류하던 곳이었습니다. 특히 서화와 고서적이 많이 거래되었고, 일제강점기에는 일본인들이 문화재를 거래하기도 했습니다. 이후 한국전쟁을 거치면서 전통 문화와 예술이 남아있는 곳으로 발전했습니다.',
    },
    culture: {
      label: '문화',
      body: '인사동은 한국의 전통 문화를 체험할 수 있는 장소로 유명합니다. 전통 공예품, 도자기, 한지 공예 등 다양한 전통 예술품을 구매할 수 있으며, 전통 찻집에서 다도(茶道)를 체험할 수도 있습니다. 거리 곳곳에는 갤러리와 전시관이 있어 현대와 전통이 조화롭게 공존하는 문화적 매력을 느낄 수 있습니다.',
    },
    tour: {
      label: '관광명소',
      body: '인사동 거리 자체가 주요 관광 명소로, 골목마다 숨겨진 전통 가옥, 한옥 카페, 맛집들이 자리하고 있습니다. 특히 주말에는 차량이 통제되어 보행자 전용 거리로 변하며, 다양한 거리 공연과 전시회가 열립니다. 근처에 위치한 조계사와 탑골공원도 함께 방문하기 좋은 명소입니다.',
    },
  },
  en: {
    title: 'About Osaek Market',
    history: {
      label: 'History',
      body: 'Since the Joseon era, Insadong was a center of Hanyang where scholars and writers gathered to write and exchange ideas. Calligraphy and antique books were traded here in particular, and during the Japanese colonial period cultural artifacts were also dealt. After the Korean War it grew into a place where traditional culture and art endure.',
    },
    culture: {
      label: 'Culture',
      body: 'Insadong is famous as a place to experience traditional Korean culture. You can buy traditional crafts, ceramics and hanji paper art, and experience the tea ceremony (dado) at traditional teahouses. Galleries and exhibition halls line the streets, where modern and traditional coexist in harmony.',
    },
    tour: {
      label: 'Attractions',
      body: 'The Insadong street itself is a major attraction, with hidden traditional houses, hanok cafés and restaurants in every alley. On weekends it becomes a car-free pedestrian street with various street performances and exhibitions. Nearby Jogyesa Temple and Tapgol Park are also great to visit together.',
    },
  },
  ja: {
    title: 'ここは五色市場',
    history: {
      label: '歴史',
      body: '仁寺洞は朝鮮時代から漢陽の中心地として、学者や文人が集まって文章を書き交流した場所でした。特に書画や古書が多く取引され、日帝強占期には日本人が文化財を取引することもありました。その後、朝鮮戦争を経て伝統文化と芸術が残る場所へと発展しました。',
    },
    culture: {
      label: '文化',
      body: '仁寺洞は韓国の伝統文化を体験できる場所として有名です。伝統工芸品、陶磁器、韓紙工芸など多様な伝統芸術品を購入でき、伝統茶屋で茶道を体験することもできます。通りのあちこちにギャラリーや展示館があり、現代と伝統が調和して共存する文化的魅力を感じられます。',
    },
    tour: {
      label: '観光名所',
      body: '仁寺洞の通りそのものが主要な観光名所で、路地ごとに隠れた伝統家屋、韓屋カフェ、グルメ店があります。特に週末は車両が規制され歩行者専用通りとなり、さまざまな街頭公演や展示会が開かれます。近くの曹渓寺やタプコル公園も一緒に訪れるのに良い名所です。',
    },
  },
  zh: {
    title: '这里是五色市场',
    history: {
      label: '历史',
      body: '仁寺洞自朝鲜时代起便是汉阳的中心地，文人学者在此聚集、写作与交流。这里尤其盛行书画与古籍的交易，日帝强占时期日本人也曾在此交易文物。此后历经朝鲜战争，发展成为保留传统文化与艺术的地方。',
    },
    culture: {
      label: '文化',
      body: '仁寺洞以可体验韩国传统文化而闻名。可以购买传统工艺品、陶瓷、韩纸工艺等多种传统艺术品，也可在传统茶馆体验茶道。街道各处设有画廊与展览馆，让人感受现代与传统和谐共存的文化魅力。',
    },
    tour: {
      label: '旅游景点',
      body: '仁寺洞街道本身就是主要旅游景点，每条小巷都藏着传统韩屋、韩屋咖啡馆与美食店。尤其周末实行车辆管制，变为步行专用街，举办各种街头表演与展览。附近的曹溪寺与塔谷公园也很适合一同游览。',
    },
  },
};

interface OsanAboutProps {
  controller: KioskController;
}

/** 여기는 오색시장 — history / culture / attractions (Figma 오산>여기는오색시장). */
export function OsanAbout({ controller }: OsanAboutProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLanguageStore((s) => s.currentLanguage);
  const c = pick(CONTENT, lang);

  return (
    <>
      {osanIconUrl('bg') && <img className={styles.bg} src={osanIconUrl('bg')} alt="" draggable={false} />}

      <OsanHeader title={c.title} onHome={goHome} />

      <div className={styles.content}>
        <div className={styles.card}>
          {/* 역사 — full-width image on top, then centered title + body */}
          <section className={styles.sectionStacked}>
            <div className={styles.wideImage}>
              <img src={historyImg} alt="" draggable={false} />
            </div>
            <p className={styles.title}>{c.history.label}</p>
            <p className={styles.body}>{c.history.body}</p>
          </section>

          {/* 문화 — image left, text right */}
          <section className={styles.sectionRow}>
            <div className={styles.squareImage}>
              <img src={cultureImg} alt="" draggable={false} />
            </div>
            <div className={styles.rowText}>
              <p className={styles.title}>{c.culture.label}</p>
              <p className={styles.body}>{c.culture.body}</p>
            </div>
          </section>

          {/* 관광명소 — text left, image right */}
          <section className={styles.sectionRow}>
            <div className={styles.rowText}>
              <p className={styles.title}>{c.tour.label}</p>
              <p className={styles.body}>{c.tour.body}</p>
            </div>
            <div className={styles.squareImage}>
              <img src={tourImg} alt="" draggable={false} />
            </div>
          </section>
        </div>
      </div>

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="홈으로">
          {osanIconUrl('home-btn') && <img src={osanIconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="뒤로">
          {osanIconUrl('back-arrow') && <img src={osanIconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>
    </>
  );
}
