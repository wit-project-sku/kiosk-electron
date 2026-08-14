/**
 * 안녕 '하영' — Figma node 6217:94591 ('하영'소개 tab).
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
import { useLanguageStore } from '@renderer/store/languageStore';
import { pick, type Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { trackEvent } from '@renderer/lib/analytics';
import { JejuPageFrame } from './JejuPageFrame';
import { JejuSubTabRow } from './JejuSubTabRow';
import { JejuTabRow } from './JejuTabRow';
import styles from './JejuHello.module.css';

import tiktokIcon from '@renderer/assets/photos/jeju/hello/tiktok.png';
import instaIcon from '@renderer/assets/photos/jeju/hello/insta.png';
import qrHayoung from '@renderer/assets/photos/jeju/hello/qr-hayoung.png';
import hobbyKpop from '@renderer/assets/photos/jeju/hello/hobby-kpop.jpg';
import hobbyRunning from '@renderer/assets/photos/jeju/hello/hobby-running.jpg';
import hobbyTennis from '@renderer/assets/photos/jeju/hello/hobby-tennis.jpg';
import healthNeck from '@renderer/assets/photos/jeju/hello/health-neck.jpg';
import healthWaist from '@renderer/assets/photos/jeju/hello/health-waist.jpg';
import healthRefresh from '@renderer/assets/photos/jeju/hello/health-refresh.jpg';

type TabId = 'profile' | 'hobbies' | 'health';
/** The two sub-tabbed tabs; `profile` has no sub-tabs. */
type TopicTabId = Exclude<TabId, 'profile'>;

/** Tabs in frame order (6217:94659 / 94661 / 94663). Figma writes them with
 *  curly quotes and its own spacing — ‘하영’소개, ‘하영’ 건강습관 — kept verbatim. */
const TABS = [
  { id: 'profile', key: 'Greeting_Category1', label: { ko: '‘하영’소개', en: "About HAYOUNG", ja: '‘ハヨン’紹介', zh: '‘HAYOUNG’介绍', vi: 'Giới thiệu ‘HAYOUNG’', th: 'แนะนำ ‘HAYOUNG’', ru: 'О ‘HAYOUNG’', id: 'Tentang ‘HAYOUNG’' } },
  { id: 'hobbies', key: 'Greeting_Category2', label: { ko: '‘하영’취미생활', en: "HAYOUNG's Hobbies", ja: '‘ハヨン’の趣味', zh: '‘HAYOUNG’的爱好', vi: 'Sở thích của ‘HAYOUNG’', th: 'งานอดิเรกของ ‘HAYOUNG’', ru: 'Хобби ‘HAYOUNG’', id: 'Hobi ‘HAYOUNG’' } },
  { id: 'health', key: 'Greeting_Category3', label: { ko: '‘하영’ 건강습관', en: "HAYOUNG's Health", ja: '‘ハヨン’の健康習慣', zh: '‘HAYOUNG’的健康习惯', vi: 'Thói quen của ‘HAYOUNG’', th: 'สุขภาพของ ‘HAYOUNG’', ru: 'Привычки ‘HAYOUNG’', id: 'Kebiasaan ‘HAYOUNG’' } },
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

/** Sheet cell for a {@link L} entry in this language, else its authored copy. */
const label = (f: { key: string } & Partial<Record<Lang, string>>, lang: Lang): string =>
  sheetText(f.key, lang, f);

/**
 * 하영's profile — every VALUE now reads its Greeting_*Content row from
 * Localization_Jeju, so the mascot's biography is editable in the sheet.
 *
 * The literals stay as the fallback for a missing key. They are verbatim from
 * the frame's text nodes (6217:94601–94633); where the sheet disagrees the
 * SHEET wins, which is the point. One such disagreement exists today —
 * Greeting_MBTIContent says ENTP and the frame said ENFP — and the kiosk now
 * shows ENTP.
 *
 * TODO(제주 W006): these rows are KOREAN ONLY in the sheet, so the values still
 * read Korean in the other seven languages. That is now a sheet task; nothing
 * further is needed here.
 */
const NAME_FALLBACK_KO = '하영(Hayoung)';

const PROFILE = [
  { label: L.born, key: 'Greeting_BirthDayContent', value: '2006년 3월 19일' },
  { label: L.from, key: 'Greeting_HomeTownContent', value: '제주특별자치도 제주시' },
  { label: L.nationality, key: 'Greeting_NationalityContent', value: '대한민국' },
  { label: L.blood, key: 'Greeting_BloodTypeContent', value: 'O형' },
  { label: L.mbti, key: 'Greeting_MBTIContent', value: 'ENFP' },
];

const DETAILS = [
  { label: L.talent, key: 'Greeting_SpecialtyContent', value: '다국어 회화 능력, 여행 코스 추천, 노래 등' },
  { label: L.hobby, key: 'Greeting_HobbyContent', value: 'K-POP 댄스, 감성 카페 방문, 요가, 러닝' },
  {
    label: L.dream,
    key: 'Greeting_FutureHopeContent',
    value: 'K-컬처와 로컬 전통을 결합해 새로운 관광·라이프스타일 콘텐츠를 만드는 크리에이터',
  },
  {
    label: L.about,
    key: 'Greeting_IntrodutionContent',
    value:
      '저는 현재 제주도 홍보모델로 활동하고 있어요!\nK-콘텐츠와 제주 문화에 관심을 가지고, 제주를 방문하는 여행객들에게 유용한 정보와 특별한 경험을 전달하고 있어요. 제주 주요 관광 거점에서 여행 안내부터 지역 콘텐츠 소개까지, 제주 여행의 즐거움을 함께 만들어갑니다.',
  },
];

const HASHTAGS = ['#HAYOUNG', '#하영', '#안녕하영'];

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

/** Sub-tabs and the photo slot they fill, per tab. */
const TOPICS: Record<TopicTabId, { topics: readonly Topic[]; photo: { width: number; height: number } }> = {
  hobbies: { topics: HOBBIES, photo: { width: 959, height: 1509 } },
  health: { topics: HEALTH, photo: { width: 869, height: 1546 } },
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
 * The artwork carries its own orange rounded frame, which is why these render
 * through `.socialQrImg` rather than the `.socialQr` box that draws that frame
 * in CSS around a generated code. If the real URLs ever turn up, prefer going
 * back to QRCodeSVG inside `.socialQr`: a generated code is inspectable, stays
 * crisp at any scale, and can be corrected without a re-export.
 */
const SOCIALS: ReadonlyArray<{ id: string; icon: string; qr: string }> = [
  { id: 'tiktok', icon: tiktokIcon, qr: qrHayoung },
  { id: 'instagram', icon: instaIcon, qr: qrHayoung },
];

/**
 * Hashtag pills + SNS tiles. Both built tabs draw the identical 1582×100 row;
 * only which card it sits in, and so its `top`, differs.
 */
function HelloFooter({ position }: { position: string | undefined }): JSX.Element {
  return (
    <div className={`${styles.footer} ${position}`}>
      {HASHTAGS.map((h) => (
        <span key={h} className={styles.hashtag}>
          {h}
        </span>
      ))}

      <div className={styles.socials}>
        {SOCIALS.map((s) => (
          <Fragment key={s.id}>
            <img className={styles.socialIcon} src={s.icon} alt="" draggable={false} />
            <img className={styles.socialQrImg} src={s.qr} alt="" draggable={false} />
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
  tab,
  value,
  onChange,
  emptyLabel,
  lang,
}: {
  tab: TopicTabId;
  value: string;
  onChange: (id: string) => void;
  emptyLabel: string;
  lang: Lang;
}): JSX.Element {
  const { topics, photo } = TOPICS[tab];
  const current = topics.find((t) => t.id === value) ?? topics[0]!;

  // Sub-tab captions come from the sheet; the PHOTO and its crop stay bundled.
  const items = topics.map((t) => ({ id: t.id, label: sheetText(t.labelKey, lang, { ko: t.label }) }));

  return (
    <>
      <JejuSubTabRow items={items} value={value} onChange={onChange} />

      {current.photo && (
        <div className={styles.topicPhoto} style={photo}>
          <img
            src={current.photo}
            alt=""
            style={{ objectPosition: current.focus }}
            draggable={false}
          />
        </div>
      )}

      <div className={styles.topicCard}>
        {current.title ? (
          <div className={styles.topicText}>
            <p className={styles.topicTitle}>
              {sheetText(current.titleKey, lang, { ko: current.title })}
            </p>
            <p className={styles.topicBody} style={{ width: current.bodyWidth }}>
              {sheetText(current.bodyKey, lang, { ko: current.body })}
            </p>
          </div>
        ) : (
          <p className={`${styles.empty} ${styles.emptyTopic}`}>{emptyLabel}</p>
        )}

        <HelloFooter position={styles.footerTopic} />
      </div>
    </>
  );
}

interface Props {
  controller: KioskController;
}

export function JejuHello({ controller }: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const [tab, setTab] = useState<TabId>('profile');
  /** Selected sub-tab per tab, so switching away and back keeps the place. */
  const [topic, setTopic] = useState<Record<TopicTabId, string>>({
    hobbies: 'kpop',
    health: 'neck',
  });

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

  const portrait = jejuIconUrl('hello-portrait');

  return (
    <JejuPageFrame
      controller={controller}
      title="안녕 '하영'"
      onBack={() => controller.navigate('home', '뒤로')}
    >
      <JejuTabRow
        tabs={TABS.map(({ id, key, label: fb }) => ({ id, label: sheetText(key, lang, fb) }))}
        value={tab}
        onChange={select}
      />

      {/* 취미생활 and 건강습관 draw no big card — a sub-tab row over a photo,
          with a short caption card under it. */}
      {tab !== 'profile' && (
        <TopicPanel
          tab={tab}
          value={topic[tab]}
          onChange={(id) => selectTopic(tab, id)}
          emptyLabel={pick(COMING_SOON, lang)}
          lang={lang}
        />
      )}

      {tab === 'profile' && (
        <div className={styles.card}>
          <div className={styles.portrait}>
            {portrait && <img src={portrait} alt="" draggable={false} />}
          </div>

          <div className={styles.profile}>
            <div className={styles.row}>
              <p className={styles.label}>{label(L.name, lang)}</p>
              <span className={styles.namePlate}>
                {sheetText('Greeting_NameContent', lang, { ko: NAME_FALLBACK_KO })}
              </span>
            </div>

            {PROFILE.map((row) => (
              <div key={row.key} className={styles.row}>
                <p className={styles.label}>{label(row.label, lang)}</p>
                <p className={styles.value}>{sheetText(row.key, lang, { ko: row.value })}</p>
              </div>
            ))}
          </div>

          <div className={styles.divider} />

          <div className={styles.details}>
            {DETAILS.map((row) => (
              <div key={row.key} className={styles.detailRow}>
                <p className={styles.label}>{label(row.label, lang)}</p>
                {/* 자기소개 keeps whatever line break the sheet cell carries. */}
                <p className={styles.detailValue} style={{ whiteSpace: 'pre-line' }}>
                  {sheetText(row.key, lang, { ko: row.value })}
                </p>
              </div>
            ))}
          </div>

          <HelloFooter position={styles.footerProfile} />
        </div>
      )}
    </JejuPageFrame>
  );
}
