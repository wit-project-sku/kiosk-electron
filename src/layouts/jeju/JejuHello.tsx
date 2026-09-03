/**
 * 안녕 '하영' / 안녕 '유산' — Figma node 6217:94591 ('하영'소개 tab).
 *
 * One page for both 제주 mascots: 하영 on W006/W007, 유산 on W008 (jejuMascot).
 * Everything NAMED after the mascot — title, tab fallbacks, name fallback,
 * hashtags — resolves through the mascot; pills 2–3 also read Greeting_Hashtag1/2
 * from the sheet. The biography VALUES stay sheet-driven (Greeting_*Content), so
 * 유산's profile appears the moment the operators add 유산 rows to
 * Localization_Jeju (the venue tie-break already prefers them on a
 * JEJU_HERITAGE machine). TODO(제주 W008): the ART is still 하영's — portrait
 * (hello-portrait), hobby/health photos and the SNS QR (qr-hayoung) — swap in
 * 유산 exports when the designer supplies them, until then W008 shows 하영's.
 *
 * Three tabs. 소개 has its own layout; the other two are the SAME page as each
 * other — a sub-tab row over a photo with a caption card under it — so they
 * share one renderer and differ only in their sub-tabs and photo size:
 *   '하영'소개       6217:94591              portrait circle + profile + details
 *   '하영'취미생활    6217:94681/94865/94926  K-POP / 런닝 / 테니스
 *   '하영' 건강습관   6217:94987              목·어깨 / 허리 / 기분전환
 * The tab row and the hashtag/SNS footer are all three share.
 *
 * Same page as OsanHello / InsadongHello / HwaseongHello carry for their own
 * mascots, but 제주 draws its own frame (JejuPageFrame chrome, tab row at y700,
 * one 1820×2160 card), so it is a sibling rather than a fork of those.
 */
import { Fragment, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import helloVideo from '@renderer/assets/videos/jeju/hello-hayoung.mp4';
import { useLanguageStore } from '@renderer/store/languageStore';
import { pick, type Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { trackEvent } from '@renderer/lib/analytics';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { jejuMascot, type JejuMascot, type JejuMascotBio } from './jejuMascot';
import { JejuPageFrame } from './JejuPageFrame';
import { JejuSubTabRow } from './JejuSubTabRow';
import { JejuTabRow } from './JejuTabRow';
import styles from './JejuHello.module.css';

import tiktokIcon from '@renderer/assets/photos/jeju/hello/tiktok.png';
import instaIcon from '@renderer/assets/photos/jeju/hello/insta.png';
import qrHayoung from '@renderer/assets/photos/jeju/hello/qr-hayoung.png';
import hobbyKpop from '@renderer/assets/photos/jeju/hello/hobby-kpop.png';
import hobbyRunning from '@renderer/assets/photos/jeju/hello/hobby-running.jpg';
import hobbyTennis from '@renderer/assets/photos/jeju/hello/hobby-tennis.png';
import healthNeck from '@renderer/assets/photos/jeju/hello/health-neck.png';
import healthWaist from '@renderer/assets/photos/jeju/hello/health-waist.jpg';
import healthRefresh from '@renderer/assets/photos/jeju/hello/health-refresh.png';
// 유산's own six topic photos (W008), exported 1:1 with the 842×1509 slot from
// the frames listed in TOPICS_BY_MASCOT. 하영's are the six above.
import qrYusan from '@renderer/assets/photos/jeju/hello/qr-yusan.png';
import ysHobbyKpop from '@renderer/assets/photos/jeju/hello/yusan-hobby-kpop.jpg';
import ysHobbyFood from '@renderer/assets/photos/jeju/hello/yusan-hobby-food.jpg';
import ysHobbyTennis from '@renderer/assets/photos/jeju/hello/yusan-hobby-tennis.jpg';
import ysHealthNeck from '@renderer/assets/photos/jeju/hello/yusan-health-neck.jpg';
import ysHealthWaist from '@renderer/assets/photos/jeju/hello/yusan-health-waist.jpg';
import ysHealthRefresh from '@renderer/assets/photos/jeju/hello/yusan-health-refresh.jpg';

type TabId = 'profile' | 'hobbies' | 'health';
/** The two sub-tabbed tabs; `profile` has no sub-tabs. */
type TopicTabId = Exclude<TabId, 'profile'>;

/** Tabs in frame order (6217:94659 / 94661 / 94663). Figma writes them with
 *  curly quotes and its own spacing — ‘하영’소개, ‘하영’ 건강습관 — kept verbatim,
 *  with the mascot's own name spliced in per venue. These are only the
 *  FALLBACKS: the sheet's Greeting_Category1–3 rows win whenever filled, and
 *  the venue tie-break already picks the right mascot's row per layout. */
const helloTabs = (m: JejuMascot) => [
  { id: 'profile', key: 'Greeting_Category1', label: { ko: `‘${m.ko}’소개`, en: `About ${m.roman}`, ja: `‘${m.ja}’紹介`, zh: `‘${m.roman}’介绍`, vi: `Giới thiệu ‘${m.roman}’`, th: `แนะนำ ‘${m.roman}’`, ru: `О ‘${m.roman}’`, id: `Tentang ‘${m.roman}’` } },
  { id: 'hobbies', key: 'Greeting_Category2', label: { ko: `‘${m.ko}’취미생활`, en: `${m.roman}'s Hobbies`, ja: `‘${m.ja}’の趣味`, zh: `‘${m.roman}’的爱好`, vi: `Sở thích của ‘${m.roman}’`, th: `งานอดิเรกของ ‘${m.roman}’`, ru: `Хобби ‘${m.roman}’`, id: `Hobi ‘${m.roman}’` } },
  { id: 'health', key: 'Greeting_Category3', label: { ko: `‘${m.ko}’ 건강습관`, en: `${m.roman}'s Health`, ja: `‘${m.ja}’の健康習慣`, zh: `‘${m.roman}’的健康习惯`, vi: `Thói quen của ‘${m.roman}’`, th: `สุขภาพของ ‘${m.roman}’`, ru: `Привычки ‘${m.roman}’`, id: `Kebiasaan ‘${m.roman}’` } },
] as const satisfies ReadonlyArray<{ id: TabId; key: string; label: Record<string, string> }>;

const COMING_SOON = {
  ko: '준비중입니다',
  en: 'Coming soon',
  ja: '準備中です',
  zh: '正在准备中',
  vi: 'Đang chuẩn bị',
  th: 'กำลังเตรียมการ',
  ru: 'В подготовке',
  id: 'Sedang disiapkan',
};

/**
 * Field labels — sheet key + the 8-language fallback.
 *
 * Every one of these has a Greeting_* row in Localization_Jeju, but in KOREAN
 * ONLY, so `sheetText` takes the sheet's Korean and the authored copy for the
 * other seven. Filling those columns in the sheet is all it takes to override
 * them; nothing changes here.
 */
const L = {
  name: { key: 'Greeting_Name', ko: '이름', en: 'Name', ja: '名前', zh: '姓名', vi: 'Tên', th: 'ชื่อ', ru: 'Имя', id: 'Nama' },
  born: { key: 'Greeting_BirthDay', ko: '출생', en: 'Born', ja: '生年月日', zh: '出生', vi: 'Ngày sinh', th: 'วันเกิด', ru: 'Дата рождения', id: 'Lahir' },
  from: { key: 'Greeting_HomeTown', ko: '출신', en: 'From', ja: '出身', zh: '籍贯', vi: 'Quê quán', th: 'ภูมิลำเนา', ru: 'Родом из', id: 'Asal' },
  nationality: { key: 'Greeting_Nationality', ko: '국적', en: 'Nationality', ja: '国籍', zh: '国籍', vi: 'Quốc tịch', th: 'สัญชาติ', ru: 'Гражданство', id: 'Kebangsaan' },
  blood: { key: 'Greeting_BloodType', ko: '혈액형', en: 'Blood type', ja: '血液型', zh: '血型', vi: 'Nhóm máu', th: 'กรุ๊ปเลือด', ru: 'Группа крови', id: 'Gol. darah' },
  mbti: { key: 'Greeting_MBTI', ko: 'MBTI', en: 'MBTI', ja: 'MBTI', zh: 'MBTI', vi: 'MBTI', th: 'MBTI', ru: 'MBTI', id: 'MBTI' },
  talent: { key: 'Greeting_Specialty', ko: '특기', en: 'Talent', ja: '特技', zh: '特长', vi: 'Sở trường', th: 'ความสามารถพิเศษ', ru: 'Таланты', id: 'Keahlian' },
  hobby: { key: 'Greeting_Hobby', ko: '취미', en: 'Hobbies', ja: '趣味', zh: '爱好', vi: 'Sở thích', th: 'งานอดิเรก', ru: 'Хобби', id: 'Hobi' },
  dream: { key: 'Greeting_FutureHope', ko: '장래희망', en: 'Dream', ja: '将来の夢', zh: '理想', vi: 'Ước mơ', th: 'ความฝัน', ru: 'Мечта', id: 'Cita-cita' },
  about: { key: 'Greeting_Introdution', ko: '자기소개', en: 'About me', ja: '自己紹介', zh: '自我介绍', vi: 'Giới thiệu', th: 'แนะนำตัว', ru: 'О себе', id: 'Tentang saya' },
} as const satisfies Record<string, { key: string } & Partial<Record<Lang, string>>>;

/** Sheet cell for a {@link L} entry in this language, else its authored copy.
 *  Field LABELS (이름 / 출생 / …) name no mascot, so both venues read the sheet. */
const label = (f: { key: string } & Partial<Record<Lang, string>>, lang: Lang): string =>
  sheetText(f.key, lang, f);

/**
 * A `Greeting_*` string that DESCRIBES the mascot — a profile value, a tab
 * label, a sub-tab label or a topic caption.
 *
 * 하영 reads the sheet first, exactly as before. 유산 does not: those rows exist
 * once and hold 하영's data (birthday, 런닝, 자기소개), so on a W008 machine the
 * sheet is the wrong mascot rather than a fallback — see JejuMascotBio.fromSheet
 * for how to hand these back to the sheet once 유산 rows exist.
 */
const greet = (
  m: JejuMascot,
  key: string,
  lang: Lang,
  fallback: Partial<Record<Lang, string>>,
): string => (m.bio.fromSheet ? sheetText(key, lang, fallback) : fallback[lang] ?? fallback.ko ?? '');

/**
 * The profile rows, in frame order — the sheet key each VALUE resolves through
 * plus which {@link JejuMascotBio} field supplies it.
 *
 * For 하영 the sheet wins and the bio field is the fallback, so the mascot's
 * biography stays editable in Localization_Jeju (one live disagreement:
 * Greeting_MBTIContent says ENTP where the frame said ENFP, and the kiosk
 * correctly shows ENTP). For 유산 the bio field wins — see `greet`.
 *
 * TODO(제주): the sheet's Greeting_* rows are KOREAN ONLY, so every value still
 * reads Korean in the other seven languages on both mascots. A sheet task.
 */
const PROFILE = [
  { label: L.born, key: 'Greeting_BirthDayContent', field: 'born' },
  { label: L.from, key: 'Greeting_HomeTownContent', field: 'from' },
  { label: L.nationality, key: 'Greeting_NationalityContent', field: 'nationality' },
  { label: L.blood, key: 'Greeting_BloodTypeContent', field: 'blood' },
  { label: L.mbti, key: 'Greeting_MBTIContent', field: 'mbti' },
] as const satisfies ReadonlyArray<{ label: unknown; key: string; field: keyof JejuMascotBio }>;

const DETAILS = [
  { label: L.talent, key: 'Greeting_SpecialtyContent', field: 'talent' },
  { label: L.hobby, key: 'Greeting_HobbyContent', field: 'hobby' },
  { label: L.dream, key: 'Greeting_FutureHopeContent', field: 'dream' },
  { label: L.about, key: 'Greeting_IntrodutionContent', field: 'about' },
] as const satisfies ReadonlyArray<{ label: unknown; key: string; field: keyof JejuMascotBio }>;

// Hashtag pills 2–3 resolve via Greeting_Hashtag1/2 in HelloFooter.

/**
 * One sub-tab of 취미생활 or 건강습관: a photo, a title and a line or two of copy.
 *
 * `focus` is the object-position the frame crops its photo to — sources taller
 * than their slot lose ~13% of their height, and each frame anchors that
 * differently. A source that fits its slot needs none.
 *
 * `bodyWidth` is per-frame for the same reason it looks arbitrary: the designer
 * drags the copy's box until it sits on two lines, so it runs 1188 / 1233 / 1584
 * / 1721 for copy of 46 / 57 / 72 / 62 characters, routinely overflowing the
 * 1188 column it lives in. It is a line-breaking decision, not a layout rule —
 * expect to redo it when the translations land.
 */
interface Topic {
  id: string;
  /** Localization_Jeju key for `label` / `title` / `body`. Korean-only rows for
   *  now, so the literals below are what the other seven languages still show. */
  labelKey: string;
  titleKey: string;
  bodyKey: string;
  label: string;
  /** All five absent until the frame for that sub-tab is drawn. */
  photo?: string;
  focus?: string;
  title?: string;
  body?: string;
  bodyWidth?: number;
}

/**
 * 취미생활 (6217:94681 K-POP, 94865 런닝, 94926 테니스).
 *
 * NOTE the middle sub-tab is 런닝, not 골프. The K-POP and 테니스 frames both
 * still label it "골프", so the stale text outnumbers the correct one — but only
 * the 런닝 frame SELECTS that tab, and what it shows is a running photo and copy
 * about 달리기. 하영's 취미 line on 소개 reads "K-POP 댄스, 감성 카페 방문, 요가,
 * 러닝" with no golf at all, and there is no golf photo or copy anywhere in the
 * file. 골프 is 정이's hobby (see OsanHello), duplicated along with the frame.
 *
 * The K-POP frame also parks a FOURTH 하영 photo (HAYOUNG=2026.07.31=3)
 * underneath its own, hidden behind it. It is NOT 테니스's — that one has its own
 * on-court shot — so it stays uncommitted.
 *
 * TODO(제주 W006): Korean copy only, same as the 소개 tab.
 */
const HOBBIES: readonly Topic[] = [
  {
    id: 'kpop',
    labelKey: 'Greeting_Hobby_First',
    titleKey: 'Greeting_Hobby_First_Desc_1',
    bodyKey: 'Greeting_Hobby_First_Desc_2',
    label: 'K-POP',
    photo: hobbyKpop,
    focus: 'center 83%',
    title: 'K-POP 댄스로 에너지를 충전해요!',
    body: '좋아하는 안무를 하나씩 배우며 즐거운 시간을 보내요.\n신나는 음악이 들리면 어디서든 리듬을 타게 된답니다.',
    bodyWidth: 1188,
  },
  {
    id: 'running',
    labelKey: 'Greeting_Hobby_Second',
    titleKey: 'Greeting_Hobby_Second_Desc_1',
    bodyKey: 'Greeting_Hobby_Second_Desc_2',
    label: '런닝',
    photo: hobbyRunning,
    focus: 'center bottom',
    title: '달리는 순간이 가장 행복해요!',
    body: '상쾌한 바람을 맞으며 제주 곳곳을 달리는 시간을 사랑해요. 좋은 코스만 보이면 언제 어디서든 바로 러닝을 즐긴답니다.',
    bodyWidth: 1233,
  },
  {
    id: 'tennis',
    labelKey: 'Greeting_Hobby_Third',
    titleKey: 'Greeting_Hobby_Third_Desc_1',
    bodyKey: 'Greeting_Hobby_Third_Desc_2',
    label: '테니스',
    photo: hobbyTennis,
    focus: 'center bottom',
    title: '테니스는 내 스트레스 해소법!',
    body: '랠리를 이어가며 한 점 한 점 승부를 즐기는 시간이 가장 행복해요. 친구들과 함께 경기를 하거나 새로운 기술을 연습하며 건강한 에너지를 충전한답니다.',
    bodyWidth: 1584,
  },
];

/**
 * 건강습관 (6217:94987 목·어깨, 6217:94743 허리, 6217:94804 기분전환).
 *
 * The separator in 목·어깨 is U+00B7 MIDDLE DOT, as the frame writes it.
 */
const HEALTH: readonly Topic[] = [
  {
    id: 'neck',
    labelKey: 'Greeting_Healthy_Habit_First',
    titleKey: 'Greeting_Healthy_Habit_First_Desc_1',
    bodyKey: 'Greeting_Healthy_Habit_First_Desc_2',
    label: '목·어깨',
    photo: healthNeck,
    title: '여행의 설렘만큼 몸도 가볍게 풀어보세요.',
    body: '여행 중 쌓인 목과 어깨의 긴장을 가볍게 풀어보세요. 화면 속 동작을\n천천히 따라 하며 몸을 리프레시하고, 더욱 편안한 여행을 이어가세요.',
    bodyWidth: 1721,
  },
  {
    id: 'waist',
    labelKey: 'Greeting_Healthy_Habit_Second',
    titleKey: 'Greeting_Healthy_Habit_Second_Desc_1',
    bodyKey: 'Greeting_Healthy_Habit_Second_Desc_2',
    label: '허리',
    photo: healthWaist,
    title: '비행과 여행으로 지친 몸, 잠시 쉬어가세요.',
    body: '오랜 이동으로 뻐근해진 허리를 시원하게 풀어보세요.\n간단한 스트레칭으로 몸의 균형을 되찾고, 가벼운 몸으로 여행을 시작해 보세요.',
    bodyWidth: 1696,
  },
  {
    id: 'refresh',
    labelKey: 'Greeting_Healthy_Habit_Third',
    titleKey: 'Greeting_Healthy_Habit_Third_Desc_1',
    bodyKey: 'Greeting_Healthy_Habit_Third_Desc_2',
    label: '기분전환',
    photo: healthRefresh,
    title: '잠시 멈춰, 기분 좋은 에너지를 채워보세요.',
    // No hard break in the frame, and the mock's own wrap splits 덜어보세요
    // mid-word; `keep-all` on .topicBody moves it whole onto the second line.
    body: '간단한 스트레칭을 따라 하며 긴장을 풀고, 여행 중 쌓인 피로를 자연스럽게 덜어보세요. 잠깐의 휴식이 제주 여행을 더욱 즐겁게 만드는 특별한 시간이 될 거예요.',
    bodyWidth: 1696,
  },
];

/**
 * 유산's 취미생활 — Figma 6431:31474 (K-POP), 6431:31714 (맛집탐방),
 * 6431:31773 (테니스).
 *
 * The middle sub-tab is 맛집탐방 where 하영's is 런닝, which matches 유산's own
 * 취미 line ("K-POP 댄스, 맛집 탐방, 디저트 카페 방문, 테니스, 골프"). K-POP's
 * caption is word-for-word 하영's; the other two are 유산's own copy.
 *
 * No `focus` on any of the six: the exports are the RENDERED 842×1509 node, so
 * they already carry the frame's crop and `object-fit: cover` is a no-op. 하영's
 * are full-bleed sources that still need their per-photo anchor.
 */
const YS_HOBBIES: readonly Topic[] = [
  {
    id: 'kpop',
    labelKey: 'Greeting_Hobby_First',
    titleKey: 'Greeting_Hobby_First_Desc_1',
    bodyKey: 'Greeting_Hobby_First_Desc_2',
    label: 'K-POP',
    photo: ysHobbyKpop,
    title: 'K-POP 댄스로 에너지를 충전해요!',
    body: '좋아하는 안무를 하나씩 배우며 즐거운 시간을 보내요.\n신나는 음악이 들리면 어디서든 리듬을 타게 된답니다.',
    bodyWidth: 1188,
  },
  {
    id: 'food',
    labelKey: 'Greeting_Hobby_Second',
    titleKey: 'Greeting_Hobby_Second_Desc_1',
    bodyKey: 'Greeting_Hobby_Second_Desc_2',
    label: '맛집탐방',
    photo: ysHobbyFood,
    title: '맛집 탐방으로 미식의 즐거움을 느껴요!',
    body: '새로운 맛집을 찾아 맛있는 음식을 하나씩 즐겨보며 특별한 시간을 보내요.\n맛있는 음식이 보이면 누구보다 빠르게 찾아가고 싶어진답니다.',
    bodyWidth: 1582,
  },
  {
    id: 'tennis',
    labelKey: 'Greeting_Hobby_Third',
    titleKey: 'Greeting_Hobby_Third_Desc_1',
    bodyKey: 'Greeting_Hobby_Third_Desc_2',
    label: '테니스',
    photo: ysHobbyTennis,
    title: '테니스는 내 스트레스 해소법!',
    body: '랠리를 이어가며 한 점 한 점 승부를 즐기는 시간이 가장 행복해요. 친구들과\n함께 경기를 하거나 새로운 기술을 연습하며 건강한 에너지를 충전한답니다.',
    bodyWidth: 1618,
  },
];

/**
 * 유산's 건강습관 — Figma 6431:31534 (목·어깨), 6431:31594 (허리),
 * 6431:31654 (기분전환).
 *
 * Same three sub-tabs and word-for-word the same captions as 하영's; only the
 * photos and the per-frame `bodyWidth` differ. (The three frames all draw
 * 목·어깨 as the SELECTED sub-tab — stale, like 하영's 골프/런닝 labels. Identify
 * them by their copy, which is what the ids below follow.)
 */
const YS_HEALTH: readonly Topic[] = [
  {
    id: 'neck',
    labelKey: 'Greeting_Healthy_Habit_First',
    titleKey: 'Greeting_Healthy_Habit_First_Desc_1',
    bodyKey: 'Greeting_Healthy_Habit_First_Desc_2',
    label: '목·어깨',
    photo: ysHealthNeck,
    title: '여행의 설렘만큼 몸도 가볍게 풀어보세요.',
    body: '여행 중 쌓인 목과 어깨의 긴장을 가볍게 풀어보세요.  화면 속 동작을 천천히 따라 하며 몸을 리프레시하고, 더욱 편안한 여행을 이어가세요.',
    bodyWidth: 1459,
  },
  {
    id: 'waist',
    labelKey: 'Greeting_Healthy_Habit_Second',
    titleKey: 'Greeting_Healthy_Habit_Second_Desc_1',
    bodyKey: 'Greeting_Healthy_Habit_Second_Desc_2',
    label: '허리',
    photo: ysHealthWaist,
    title: '비행과 여행으로 지친 몸, 잠시 쉬어가세요.',
    body: '오랜 이동으로 뻐근해진 허리를 시원하게 풀어보세요.\n간단한 스트레칭으로 몸의 균형을 되찾고, 가벼운 몸으로 여행을 시작해 보세요.',
    bodyWidth: 1568,
  },
  {
    id: 'refresh',
    labelKey: 'Greeting_Healthy_Habit_Third',
    titleKey: 'Greeting_Healthy_Habit_Third_Desc_1',
    bodyKey: 'Greeting_Healthy_Habit_Third_Desc_2',
    label: '기분전환',
    photo: ysHealthRefresh,
    title: '잠시 멈춰, 기분 좋은 에너지를 채워보세요.',
    body: '간단한 스트레칭을 따라 하며 긴장을 풀고, 여행 중 쌓인 피로를 자연스럽게\n덜어보세요. 잠깐의 휴식이 제주 여행을 더욱 즐겁게 만드는 특별한 시간이 될 거예요.',
    bodyWidth: 1638,
  },
];

/**
 * Sub-tabs and the photo slot they fill, per tab and per mascot.
 *
 * 하영 draws two different photo boxes (959×1509 on 취미생활, 869×1546 on
 * 건강습관); 유산 draws ONE 842×1509 box on all six frames. The default sub-tab
 * ids differ too — 하영's middle hobby is `running`, 유산's is `food` — so the
 * initial state is derived from these tables rather than hardcoded.
 */
const TOPICS_BY_MASCOT: Record<
  JejuMascot['id'],
  Record<TopicTabId, { topics: readonly Topic[]; photo: { width: number; height: number } }>
> = {
  hayoung: {
    hobbies: { topics: HOBBIES, photo: { width: 959, height: 1509 } },
    health: { topics: HEALTH, photo: { width: 869, height: 1546 } },
  },
  yusan: {
    hobbies: { topics: YS_HOBBIES, photo: { width: 842, height: 1509 } },
    health: { topics: YS_HEALTH, photo: { width: 842, height: 1509 } },
  },
};

/**
 * SNS accounts, drawn as a brand tile plus a QR — Figma 6217:94588 draws them
 * as four ~100px tiles in icon/QR pairs: TikTok, its code, Instagram, its code.
 *
 * The code is a SHIPPED IMAGE, not one generated from a URL. 하영's account URLs
 * are still unknown, and the supplied export is one code for both networks
 * (confirmed with the designer: same person, one destination) — so there is
 * nothing to generate from. Insadong ships its codes the same way
 * (qr-insa-tiktok.png / qr-insa-insta.png).
 *
 * 하영's artwork carries its own orange rounded frame, which is why it renders
 * through `.socialQrImg` rather than a box that draws the frame in CSS.
 *
 * 유산's frames (6432:47483) draw the OTHER shape: a bare glyph inset in a
 * white `border-5 #ff7f0f` rounded box — `.socialQrFramed` + `.socialQrGlyph`
 * below, at the frame's own 17% / 17.74% / 66% / 64.52%. The two render almost
 * identically; each venue gets its own asset so replacing one venue's real code
 * later cannot disturb the other.
 *
 * NOTE the 유산 export looks like the SAME placeholder code as 하영's — the
 * designer has not supplied either mascot's real account URLs yet, so treat
 * both as placeholders. If real URLs turn up, prefer a generated QRCodeSVG
 * inside `.socialQrFramed`: inspectable, crisp at any scale, correctable
 * without a re-export.
 */
const QR_BY_MASCOT: Record<JejuMascot['id'], { qr: string; framed: boolean }> = {
  hayoung: { qr: qrHayoung, framed: false },
  yusan: { qr: qrYusan, framed: true },
};

/** The two brand tiles are shared; only the code beside them is per-mascot. */
const SOCIAL_BRANDS: ReadonlyArray<{ id: string; icon: string }> = [
  { id: 'tiktok', icon: tiktokIcon },
  { id: 'instagram', icon: instaIcon },
];

/**
 * Hashtag pills + SNS tiles. Both built tabs draw the identical 1582×100 row;
 * only which card it sits in, and so its `top`, differs.
 *
 * Pill 0 stays the roman brand (`#HAYOUNG` / `#YUSAN`). Pills 1 and 2 come from
 * Localization_Jeju `Greeting_Hashtag1` / `Greeting_Hashtag2` (heritage table on
 * W008), with the mascot's authored tags as fallback.
 */
function hashPill(raw: string): string {
  const bare = raw.replace(/^#+/, '').trim();
  return bare ? `#${bare}` : '';
}

function HelloFooter({
  mascot,
  position,
  lang,
}: {
  mascot: JejuMascot;
  position: string | undefined;
  lang: Lang;
}): JSX.Element {
  const { qr, framed } = QR_BY_MASCOT[mascot.id];
  const tags = [
    mascot.hashtags[0] ?? '',
    hashPill(
      sheetText('Greeting_Hashtag1', lang, {
        ko: (mascot.hashtags[1] ?? '').replace(/^#+/, ''),
      }),
    ),
    hashPill(
      sheetText('Greeting_Hashtag2', lang, {
        ko: (mascot.hashtags[2] ?? '').replace(/^#+/, ''),
      }),
    ),
  ].filter(Boolean);

  return (
    <div className={`${styles.footer} ${position}`}>
      {tags.map((h) => (
        <span key={h} className={styles.hashtag}>
          {h}
        </span>
      ))}

      <div className={styles.socials}>
        {SOCIAL_BRANDS.map((s) => (
          <Fragment key={s.id}>
            <img className={styles.socialIcon} src={s.icon} alt="" draggable={false} />
            {framed ? (
              <div className={styles.socialQrFramed}>
                <img className={styles.socialQrGlyph} src={qr} alt="" draggable={false} />
              </div>
            ) : (
              <img className={styles.socialQrImg} src={qr} alt="" draggable={false} />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * The 취미생활 / 건강습관 body: sub-tab row, photo, caption card. One renderer for
 * both — the frames differ only in their labels, copy and photo size.
 */
function TopicPanel({
  mascot,
  tab,
  value,
  onChange,
  emptyLabel,
  lang,
}: {
  mascot: JejuMascot;
  tab: TopicTabId;
  value: string;
  onChange: (id: string) => void;
  emptyLabel: string;
  lang: Lang;
}): JSX.Element {
  const { topics, photo } = TOPICS_BY_MASCOT[mascot.id][tab];
  const current = topics.find((t) => t.id === value) ?? topics[0]!;

  // Sub-tab captions follow the mascot (see `greet`); the PHOTO stays bundled.
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const heritage = mascot.id === 'yusan' ? styles.topicHeritage : '';
  const items = topics.map((t) => ({ id: t.id, label: greet(mascot, t.labelKey, lang, { ko: t.label }) }));

  /* ♿ draws the topic photo 15% larger — 6297:74010's 1103×1736 is exactly
     하영's 959×1509 × 1.15 (the round lands 1px under its 1736; slop) — and at
     ONE size for both topic tabs: 건강습관 uses 취미생활's box rather than
     scaling its own narrower standard dims (user's call, 2026-08-26). So the
     scale rides the mascot's HOBBIES dims regardless of tab. */
  const lowBase = TOPICS_BY_MASCOT[mascot.id].hobbies.photo;
  const dims = lowReach
    ? { width: Math.round(lowBase.width * 1.15), height: Math.round(lowBase.height * 1.15) }
    : photo;

  return (
    <>
      <JejuSubTabRow
        items={items}
        value={value}
        onChange={onChange}
        className={lowReach ? styles.subTabsLow : undefined}
      />

      {current.photo && (
        <div
          className={`${styles.topicPhoto} ${heritage} ${lowReach ? styles.topicPhotoLow : ''}`}
          style={dims}
        >
          <img
            src={current.photo}
            alt=""
            style={{ objectPosition: current.focus }}
            draggable={false}
          />
        </div>
      )}

      <div className={`${styles.topicCard} ${heritage} ${lowReach ? styles.topicCardLow : ''}`}>
        {current.title ? (
          <div className={`${styles.topicText} ${heritage}`}>
            <p className={styles.topicTitle}>
              {greet(mascot, current.titleKey, lang, { ko: current.title })}
            </p>
            <p className={styles.topicBody} style={{ width: current.bodyWidth }}>
              {greet(mascot, current.bodyKey, lang, { ko: current.body })}
            </p>
          </div>
        ) : (
          <p className={`${styles.empty} ${styles.emptyTopic}`}>{emptyLabel}</p>
        )}

        <HelloFooter mascot={mascot} lang={lang} position={`${styles.footerTopic} ${heritage}`} />
      </div>
    </>
  );
}

interface Props {
  controller: KioskController;
}

export function JejuHello({ controller }: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const mascot = jejuMascot();
  const heritage = mascot.id === 'yusan' ? styles.profileHeritage : '';
  const [tab, setTab] = useState<TabId>('profile');
  /**
   * Selected sub-tab per tab, so switching away and back keeps the place.
   * Seeded from the mascot's own tables — 하영's middle hobby id is `running`
   * and 유산's is `food`, so a hardcoded pair would be wrong for one of them.
   */
  const [topic, setTopic] = useState<Record<TopicTabId, string>>(() => ({
    hobbies: TOPICS_BY_MASCOT[mascot.id].hobbies.topics[0]!.id,
    health: TOPICS_BY_MASCOT[mascot.id].health.topics[0]!.id,
  }));

  const select = (id: TabId): void => {
    trackEvent({
      name: 'button_clicked',
      payload: { screen: 'hello', tab: id, kioskId: controller.kioskId },
    });
    setTab(id);
  };

  const selectTopic = (parent: TopicTabId, id: string): void => {
    trackEvent({
      name: 'button_clicked',
      payload: { screen: 'hello', tab: parent, topic: id, kioskId: controller.kioskId },
    });
    setTopic((prev) => ({ ...prev, [parent]: id }));
  };

/**
   * The circle is a VIDEO now (2026-09-03), not the grey #D9D9D9 disc the frame
   * draws and not the still that never arrived.
   *
   * ★ It is IMPORTED, so Vite emits it into the renderer bundle and
   * electron-builder's `files: out/**` ships it. That is the whole point and it
   * is worth being explicit about, because the obvious home for a kiosk video is
   * the wrong one here: `resources/videos` is gitignored, is NOT in
   * extraResources, and resolves to `C:\KioskVideos` on a packaged Windows
   * machine — a per-machine manual drop for the huge 2nd-monitor attract reels
   * (see appPaths.videos). A 7.4 MB UI clip that has to survive `npm run
   * build:win` belongs in the bundle instead, where a release carries it with no
   * provisioning step at all. It is also in `asarUnpack` so it plays from a real
   * file rather than through the asar layer.
   *
   * `portrait` is kept as the poster: it stays undefined until someone drops
   * `hello-portrait` into the icon folder, and then it fills the circle for the
   * moment before the first frame paints instead of a grey flash.
   *
   * TODO(제주 W008): the clip is 하영's, so a 유산 machine plays it — the same
   * stand-in the portrait slot and the SNS QR already are (see the file header).
   * A per-mascot key goes here when 유산's own clip is shot.
   */
  const portrait = jejuIconUrl('hello-portrait');

  return (
    /* ♿ is on the 2026-08-26 mode-bar revision (6558:79587 / 6297:74010): bar
       at the top, header y113, no banner; the page self-positions its content
       (the .*Low classes), so the body shift stays 0. */
    <JejuPageFrame
      controller={controller}
      title={mascot.helloTitle}
      // 유산's Greeting_Introduce row does not exist — see JejuMascot.introLine.
      subtitle={mascot.bio.fromSheet ? undefined : mascot.introLine}
      onBack={() => controller.navigate('home', '뒤로')}
      lowReachSelfLayout
      lowReachModeBar
      lowReachShift={113}
    >
      <JejuTabRow
        tabs={helloTabs(mascot).map(({ id, key, label: fb }) => ({
          id,
          label: greet(mascot, key, lang, fb),
        }))}
        value={tab}
        onChange={select}
        className={lowReach ? styles.tabsLow : undefined}
      />

      {/* 취미생활 and 건강습관 draw no big card — a sub-tab row over a photo,
          with a short caption card under it. */}
      {tab !== 'profile' && (
        <TopicPanel
          mascot={mascot}
          tab={tab}
          value={topic[tab]}
          onChange={(id) => selectTopic(tab, id)}
          emptyLabel={pick(COMING_SOON, lang)}
          lang={lang}
        />
      )}

      {tab === 'profile' && (
        <div className={`${styles.card} ${heritage} ${lowReach ? styles.cardLow : ''}`}>
          <div className={styles.portrait}>
            {/* Muted + playsInline so Chromium will autoplay it at all: an
                unmuted clip is blocked by the autoplay policy and would sit on
                its first frame. No controls — there is nothing to control on a
                looping portrait, and a visitor cannot pause it by design. */}
            <video
              className={styles.portraitVideo}
              src={helloVideo}
              poster={portrait}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
            />
          </div>

          <div className={styles.profile}>
            <div className={styles.row}>
              <p className={styles.label}>{label(L.name, lang)}</p>
              <span className={styles.namePlate}>
                {greet(mascot, 'Greeting_NameContent', lang, { ko: mascot.bio.name })}
              </span>
            </div>

            {PROFILE.map((row) => (
              <div key={row.key} className={styles.row}>
                <p className={styles.label}>{label(row.label, lang)}</p>
                <p className={styles.value}>
                  {greet(mascot, row.key, lang, { ko: mascot.bio[row.field] as string })}
                </p>
              </div>
            ))}
          </div>

          <div className={styles.divider} />

          <div className={styles.details}>
            {DETAILS.map((row) => (
              <div key={row.key} className={styles.detailRow}>
                <p className={styles.label}>{label(row.label, lang)}</p>
                {/* 장래희망 / 자기소개 keep whatever line break the value carries. */}
                <p className={styles.detailValue} style={{ whiteSpace: 'pre-line' }}>
                  {greet(mascot, row.key, lang, { ko: mascot.bio[row.field] as string })}
                </p>
              </div>
            ))}
          </div>

          <HelloFooter mascot={mascot} lang={lang} position={`${styles.footerProfile} ${heritage}`} />
        </div>
      )}
    </JejuPageFrame>
  );
}
