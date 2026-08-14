/**
 * 제주 AI 검색 결과 — Figma node 6127:17606 (제주>제주모하지(AI검색)-02).
 *
 * Reached from the JejuAiSearch CTA. 제주 differs from the other kiosks here:
 * Osan/Hwaseong assemble three courses out of the picked interests and list the
 * matching shops, whereas 제주 offers three CURATED course types and asks the
 * visitor to choose one. The pick is stored on aiStore so the course detail can
 * read it; the interests still travel alongside it.
 */
import type { KioskController } from '@renderer/hooks/useKioskController';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useAiStore } from '@renderer/store/aiStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { pick } from '@renderer/lib/i18n';
import { JejuPageFrame } from './JejuPageFrame';
import styles from './JejuAiResult.module.css';

interface Props {
  controller: KioskController;
}

/**
 * Page chrome, in the eight languages the kiosk ships.
 *
 * Localization_Jeju has no row for either string — its AI keys are
 * SubHeader_AISearch (the category picker) and SubHeader_AICourse (the QR line
 * on the course detail), neither of which is "pick a course". They were literal
 * Korean here, so every visitor saw Korean regardless of the language they had
 * chosen. Authored locally the way TAX-FREE does it; add sheet rows later and
 * these become the fallback.
 */
const T = {
  subtitle: {
    ko: '코스를 선택해주세요',
    en: 'Please select a course',
    ja: 'コースを選択してください',
    zh: '请选择路线',
    vi: 'Vui lòng chọn một lộ trình',
    th: 'กรุณาเลือกคอร์ส',
    ru: 'Пожалуйста, выберите маршрут',
    id: 'Silakan pilih rute',
  },
  heading: {
    ko: '맞춤 코스를 선택해 제주도를 즐겨보세요.',
    en: 'Pick the course made for you and enjoy Jeju.',
    ja: 'おすすめのコースを選んで済州島を楽しみましょう。',
    zh: '选择专属路线，尽享济州岛。',
    vi: 'Chọn lộ trình phù hợp và tận hưởng đảo Jeju.',
    th: 'เลือกคอร์สที่ใช่สำหรับคุณ แล้วสนุกกับเชจู',
    ru: 'Выберите подходящий маршрут и наслаждайтесь Чеджу.',
    id: 'Pilih rute yang cocok dan nikmati Pulau Jeju.',
  },
};

interface Course {
  /** Stable key stored on aiStore for the detail screen. */
  key: string;
  /** Rail label — A코스 / B코스 / C코스. */
  label: string;
  subtitle: string;
  title: string;
  /** `\n` marks the line break drawn in the design. */
  desc: string;
  tags: string;
  icon: string;
  /** Illustration box, in artboard px relative to the card's top-left. */
  art: { left: number; top: number; width: number; height: number };
}

/**
 * The three courses are authored editorial content — names, copy, hashtags and
 * illustrations all come from the Figma, not from the shops API or the picked
 * interests.
 *
 * TODO(제주 W006): move the copy to Localization_Jeju when that sheet exists so
 * it localizes; the illustrations stay bundled either way.
 */
const COURSES: Course[] = [
  {
    key: 'nature',
    label: 'A코스',
    subtitle: '자연과 유산을 따라 걷는',
    title: '자연·유산 탐방 코스',
    desc: '제주의 자연과 문화유산을\n함께 둘러보는 힐링 코스',
    tags: '#자연 #유산 #힐링',
    icon: 'course-nature',
    art: { left: 1064, top: 246, width: 555, height: 412 },
  },
  {
    key: 'food',
    label: 'B코스',
    subtitle: '미식과 감성을 즐기는',
    title: '맛집·감성 코스',
    desc: '제주의 맛과 감성을 가득 담은\n로컬 중심 코스',
    tags: '#미식 #감성 #로컬',
    icon: 'course-food',
    art: { left: 964, top: 316, width: 606, height: 265 },
  },
  {
    key: 'family',
    label: 'C코스',
    subtitle: '아이와 함께 즐기는',
    title: '가족·체험 코스',
    desc: '온 가족이 함께 즐길 수 있는\n체험 중심 코스',
    tags: '#가족 #체험 #즐거움',
    icon: 'course-family',
    art: { left: 1064, top: 258, width: 469, height: 380 },
  },
];

/** Card `top` per course, in artboard px. */
const CARD_TOPS = [868, 1628, 2385];

export function JejuAiResult({ controller }: Props): JSX.Element {
  const setCourse = useAiStore((s) => s.setCourse);
  const lang = useLanguageStore((s) => s.currentLanguage);

  const choose = (course: Course): void => {
    setCourse(course.key);
    controller.navigate('ai_detail', course.title);
  };

  return (
    <JejuPageFrame
      controller={controller}
      title="'제주' 뭐하지 (AI 검색)"
      subtitle={pick(T.subtitle, lang)}
      bannerFallback="banner-detail"
      onBack={() => controller.navigate('ai_search', '뒤로')}
    >
      <p className={styles.heading}>{pick(T.heading, lang)}</p>

      {COURSES.map((course, i) => (
        <button
          key={course.key}
          type="button"
          className={styles.card}
          style={{ top: CARD_TOPS[i] }}
          onClick={() => choose(course)}
        >
          <span className={styles.panel} />
          <span className={styles.courseLabel}>{course.label}</span>

          <span className={styles.courseSubtitle}>{course.subtitle}</span>
          <span className={styles.courseTitle}>{course.title}</span>
          <span className={styles.desc}>{course.desc}</span>
          <span className={styles.tags}>{course.tags}</span>

          {jejuIconUrl(course.icon) && (
            <img
              src={jejuIconUrl(course.icon)}
              alt=""
              className={styles.art}
              style={course.art}
              draggable={false}
            />
          )}
          {jejuIconUrl('arrow-course') && (
            <img src={jejuIconUrl('arrow-course')} alt="" className={styles.arrow} draggable={false} />
          )}
        </button>
      ))}
    </JejuPageFrame>
  );
}
