/**
 * 제주 AI 검색 결과 — Figma node 6289:55267 (제주>제주모하지(AI검색)-02), the
 * 2026-08-24 redesign of 6127:17606.
 *
 * Reached from the JejuAiSearch CTA. 제주 differs from the other kiosks here:
 * Osan/Hwaseong assemble three courses out of the picked interests and list the
 * matching shops, whereas 제주 offers three CURATED course types and asks the
 * visitor to choose one. The pick is stored on aiStore so the course detail can
 * read it; the interests still travel alongside it.
 */
import type { KioskController } from '@renderer/hooks/useKioskController';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
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
 * Localization_Jeju has no row for this string — its AI keys are
 * SubHeader_AISearch (the category picker) and SubHeader_AICourse (the QR line
 * on the course detail), neither of which is "pick a course". It was literal
 * Korean here, so every visitor saw Korean regardless of the language they had
 * chosen. Authored locally the way TAX-FREE does it; add a sheet row later and
 * this becomes the fallback.
 *
 * The "맞춤 코스를 선택해 제주도를 즐겨보세요." heading that used to sit at y700
 * between the subtitle and the first card is not in the redesign — 6289:55267
 * runs the header straight into the A코스 plate — so it and its eight
 * translations are gone with it.
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
    desc: '제주의 자연과 문화유산을 함께\n둘러보는 힐링코스',
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
    art: { left: 1043, top: 221, width: 469, height: 380 },
  },
];

/**
 * Card `top` per course, in artboard px.
 *
 * The 2026-08-26 pass moved all three down 55 (868/1628/2385 → 923/1683/2440)
 * to open the y737 slot the answer pills now occupy.
 */
const CARD_TOPS = [923, 1683, 2440];

export function JejuAiResult({ controller }: Props): JSX.Element {
  const setCourse = useAiStore((s) => s.setCourse);
  const lang = useLanguageStore((s) => s.currentLanguage);
  const lowReach = useAccessibilityStore((s) => s.lowReach);

  /* The pill row above the cards echoes the questionnaire answers: 인원 · 기간 ·
     이동수단, then the picked interests. All stored KOREAN (see JejuAiSearch's
     submit), which is also how the frames draw them. Empty slots (deep-link,
     idle reset) just drop out.

     It started as a ♿-only row (6326:82014); the 2026-08-26 pass put it on the
     standard frame too (6516:73056), left-aligned at x172 rather than centred. */
  const visitors = useAiStore((s) => s.visitors);
  const stay = useAiStore((s) => s.stay);
  const transport = useAiStore((s) => s.transport);
  const interests = useAiStore((s) => s.interests);
  const picks = [visitors, stay, transport, ...interests].filter(Boolean);

  const choose = (course: Course): void => {
    setCourse(course.key);
    controller.navigate('ai_detail', course.title);
  };

  return (
    /* Mode-bar revision (6326:82014): header at y113, all three cards a pure
       +531 (868/1628/2385 → 1399/2159/2916, measured), no banner in low-reach. */
    <JejuPageFrame
      controller={controller}
      title="'제주' 뭐하지 (AI 검색)"
      subtitle={pick(T.subtitle, lang)}
      bannerFallback="banner-detail"
      onBack={() => controller.navigate('ai_search', '뒤로')}
      lowReachModeBar
      lowReachShift={113}
      /* 476, not the old 531: the standard cards moved down 55 and the ♿ frame
         did not — its three cards are still measured at 1399/2159/2916, so the
         shift absorbs the difference (923 + 476 = 1399). */
      lowReachBodyShift={476}
    >
      {picks.length > 0 && (
        <div className={`${styles.picks} ${lowReach ? styles.picksLow : ''}`}>
          {picks.map((p, i) => (
            <span key={i} className={styles.pick}>{p}</span>
          ))}
        </div>
      )}
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
