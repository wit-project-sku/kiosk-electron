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
import { useMemo } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useAiStore } from '@renderer/store/aiStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { pick } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { localizeJejuAiPick } from '@renderer/lib/jejuAiPicksLabel';
import { sheetText } from '@renderer/lib/loc';
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
  label: Partial<Record<Lang, string>>;
  subtitle: Partial<Record<Lang, string>>;
  title: Partial<Record<Lang, string>>;
  /** Korean title, kept flat — it is the analytics label `navigate()` receives. */
  titleKo: string;
  /** `\n` marks the line break drawn in the design. */
  desc: Partial<Record<Lang, string>>;
  tags: Partial<Record<Lang, string>>;
  icon: string;
  /** Illustration box, in artboard px relative to the card's top-left. */
  art: { left: number; top: number; width: number; height: number };
}

/**
 * The three courses are authored editorial content — names, copy, hashtags and
 * illustrations all come from the Figma, not from the shops API or the picked
 * interests. Card blurbs prefer Localization_Jeju `ACourseDesc3` /
 * `BCourseDesc3` / `CCourseDesc3`; the rest of each card is authored here.
 *
 * `titleKo` stays flat and Korean because it is NOT display text: it is the
 * label `navigate()` records and the string the detail screen matches on.
 */
/**
 * The card blurb — sheet row per course; authored `course.desc` is the fallback.
 */
const COURSE_DESC_KEYS = ['ACourseDesc3', 'BCourseDesc3', 'CCourseDesc3'] as const;

const courseDesc = (course: Course, i: number, lang: Lang): string =>
  sheetText(COURSE_DESC_KEYS[i], lang, course.desc);

const COURSES: Course[] = [
  {
    key: 'nature',
    label: {
      ko: 'A코스', en: 'Course A', ja: 'Aコース', zh: 'A路线',
      vi: 'Lộ trình A', th: 'คอร์ส A', ru: 'Маршрут A', id: 'Rute A',
    },
    subtitle: {
      ko: '자연과 유산을 따라 걷는', en: 'Walking through nature and heritage',
      ja: '自然と遺産をたどる', zh: '漫步自然与遗产',
      vi: 'Đi bộ giữa thiên nhiên và di sản', th: 'เดินชมธรรมชาติและมรดก',
      ru: 'Прогулка среди природы и наследия', id: 'Menyusuri alam dan warisan',
    },
    title: {
      ko: '자연·유산 탐방 코스', en: 'Nature & Heritage', ja: '自然・遺産探訪コース',
      zh: '自然·遗产探访路线', vi: 'Thiên nhiên & Di sản',
      th: 'เส้นทางธรรมชาติและมรดก', ru: 'Природа и наследие', id: 'Alam & Warisan',
    },
    titleKo: '자연·유산 탐방 코스',
    desc: {
      ko: '제주의 자연과 문화유산을 함께\n둘러보는 힐링코스',
      en: 'A healing route through\nJeju’s nature and heritage',
      ja: '済州の自然と文化遺産を\n一緒に巡るヒーリングコース',
      zh: '一起游览济州自然\n与文化遗产的疗愈路线',
      vi: 'Hành trình thư giãn khám phá\nthiên nhiên và di sản Jeju',
      th: 'เส้นทางพักผ่อนร่วมกับ\nธรรมชาติและมรดกของเชจู',
      ru: 'Маршрут для отдыха среди\nприроды и наследия Чеджу',
      id: 'Rute relaksasi menjelajahi\nalam dan warisan Jeju',
    },
    tags: {
      ko: '#자연 #유산 #힐링', en: '#Nature #Heritage #Healing', ja: '#自然 #遺産 #ヒーリング',
      zh: '#自然 #遗产 #疗愈', vi: '#Thiênnhiên #Disản #Thưgiãn',
      th: '#ธรรมชาติ #มรดก #ผ่อนคลาย', ru: '#Природа #Наследие #Отдых',
      id: '#Alam #Warisan #Relaksasi',
    },
    icon: 'course-nature',
    art: { left: 1064, top: 246, width: 555, height: 412 },
  },
  {
    key: 'food',
    label: {
      ko: 'B코스', en: 'Course B', ja: 'Bコース', zh: 'B路线',
      vi: 'Lộ trình B', th: 'คอร์ส B', ru: 'Маршрут B', id: 'Rute B',
    },
    subtitle: {
      ko: '미식과 감성을 즐기는', en: 'For food and atmosphere',
      ja: '美食と雰囲気を楽しむ', zh: '享受美食与情调',
      vi: 'Dành cho ẩm thực và cảm xúc', th: 'สำหรับอาหารและบรรยากาศ',
      ru: 'Для гастрономии и атмосферы', id: 'Untuk kuliner dan suasana',
    },
    title: {
      ko: '맛집·감성 코스', en: 'Food & Vibes', ja: 'グルメ・雰囲気コース',
      zh: '美食·情调路线', vi: 'Ẩm thực & Cảm xúc',
      th: 'อาหารและบรรยากาศ', ru: 'Еда и атмосфера', id: 'Kuliner & Suasana',
    },
    titleKo: '맛집·감성 코스',
    desc: {
      ko: '제주의 맛과 감성을 가득 담은\n로컬 중심 코스',
      en: 'A local-first course full of\nJeju’s flavours and vibes',
      ja: '済州の味と雰囲気をたっぷり詰めた\nローカル中心コース',
      zh: '充满济州味道与情调的\n本地路线',
      vi: 'Hành trình địa phương đậm\nhương vị và cảm xúc Jeju',
      th: 'เส้นทางเน้นท้องถิ่นเต็มไปด้วย\nรสชาติและบรรยากาศเชจู',
      ru: 'Локальный маршрут с вкусами\nи атмосферой Чеджу',
      id: 'Rute lokal penuh cita rasa\ndan suasana Jeju',
    },
    tags: {
      ko: '#미식 #감성 #로컬', en: '#Food #Vibes #Local', ja: '#グルメ #雰囲気 #ローカル',
      zh: '#美食 #情调 #本地', vi: '#Ẩmthực #Cảmxúc #Địaphương',
      th: '#อาหาร #บรรยากาศ #ท้องถิ่น', ru: '#Еда #Атмосфера #Местное',
      id: '#Kuliner #Suasana #Lokal',
    },
    icon: 'course-food',
    art: { left: 964, top: 316, width: 606, height: 265 },
  },
  {
    key: 'family',
    label: {
      ko: 'C코스', en: 'Course C', ja: 'Cコース', zh: 'C路线',
      vi: 'Lộ trình C', th: 'คอร์ส C', ru: 'Маршрут C', id: 'Rute C',
    },
    subtitle: {
      ko: '아이와 함께 즐기는', en: 'Fun with the kids',
      ja: '子どもと一緒に楽しむ', zh: '与孩子一起享受',
      vi: 'Vui cùng trẻ nhỏ', th: 'สนุกไปกับเด็ก ๆ',
      ru: 'Весело с детьми', id: 'Seru bersama anak',
    },
    title: {
      ko: '가족·체험 코스', en: 'Family & Activities', ja: '家族・体験コース',
      zh: '家庭·体验路线', vi: 'Gia đình & Trải nghiệm',
      th: 'ครอบครัวและกิจกรรม', ru: 'Семья и впечатления', id: 'Keluarga & Aktivitas',
    },
    titleKo: '가족·체험 코스',
    desc: {
      ko: '온 가족이 함께 즐길 수 있는\n체험 중심 코스',
      en: 'A hands-on course the\nwhole family can enjoy',
      ja: '家族みんなで楽しめる\n体験中心コース',
      zh: '全家人都能一起享受的\n体验路线',
      vi: 'Hành trình trải nghiệm\ncả gia đình cùng tận hưởng',
      th: 'เส้นทางเน้นกิจกรรมที่\nทั้งครอบครัวสนุกร่วมกัน',
      ru: 'Маршрут впечатлений для\nвсей семьи',
      id: 'Rute pengalaman yang\ndinikmati seluruh keluarga',
    },
    tags: {
      ko: '#가족 #체험 #즐거움', en: '#Family #Experience #Fun', ja: '#家族 #体験 #楽しさ',
      zh: '#家庭 #体验 #欢乐', vi: '#Giađình #Trảinghiệm #Vuivẻ',
      th: '#ครอบครัว #กิจกรรม #สนุก', ru: '#Семья #Впечатления #Веселье',
      id: '#Keluarga #Pengalaman #Seru',
    },
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
  const picks = useMemo(
    () => [visitors, stay, transport, ...interests].filter(Boolean),
    [visitors, stay, transport, interests],
  );
  const pickLabels = useMemo(
    () => picks.map((p) => localizeJejuAiPick(p, lang as Lang)),
    [picks, lang],
  );

  const choose = (course: Course): void => {
    setCourse(course.key);
    controller.navigate('ai_detail', course.titleKo);
  };

  return (
    /* Mode-bar revision with the promo kept under the bar — header at y686.
       Body shift +623 pulls the block up 80px so the subtitle sits closer to
       the pills (~41px); cards at y1546 / y2306 / y3063. */
    <JejuPageFrame
      controller={controller}
      title="'제주' 뭐하지 (AI 검색)"
      subtitle={pick(T.subtitle, lang)}
      bannerFallback="banner-detail"
      onBack={() => controller.navigate('ai_search', '뒤로')}
      lowReachModeBar
      lowReachBarBanner
      lowReachShift={686}
      lowReachBodyShift={623}
    >
      {picks.length > 0 && (
        <div className={`${styles.picks} ${lowReach ? styles.picksLow : ''}`}>
          {pickLabels.map((label, i) => (
            <span key={i} className={styles.pick}>{label}</span>
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
          <span className={styles.courseLabel}>{pick(course.label, lang)}</span>

          <span className={styles.courseSubtitle}>{pick(course.subtitle, lang)}</span>
          <span className={styles.courseTitle}>{pick(course.title, lang)}</span>
          <span className={styles.desc}>{courseDesc(course, i, lang)}</span>
          <span className={styles.tags}>{pick(course.tags, lang)}</span>

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
