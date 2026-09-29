import { Fragment, useEffect, useRef, useState } from 'react';
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLang } from '@renderer/lib/i18n';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { t } from '@renderer/lib/loc';
import { useFitText } from '@layouts/components/fitText';
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
import qrInsaTiktok from '@renderer/assets/photos/insadong/hello/qr-insa-tiktok.png';
import qrInsaInsta from '@renderer/assets/photos/insadong/hello/qr-insa-insta.png';
import { InsadongHeader } from './InsadongHeader';
import { InsadongLeftNav } from './InsadongLeftNav';
import styles from './InsadongHello.module.css';

type Lang = SupportedLanguage;

function pick<T>(map: Partial<Record<Lang, T>>, lang: Lang): T {
  return (map[lang] ?? map.ko ?? (Object.values(map)[0] as T)) as T;
}

/** Sheet cells are one block with newlines. Each line is a row on the card. */
function sheetLines(key: string, lang: Lang): string[] {
  return t(key, lang)
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const TABS = ['Greeting_Category1', 'Greeting_Category2', 'Greeting_Category3'] as const;

const PROFILE_ROWS: [string, string][] = [
  ['Greeting_BirthDay', 'Greeting_BirthDayContent'],
  ['Greeting_HomeTown', 'Greeting_HomeTownContent'],
  ['Greeting_Nationality', 'Greeting_NationalityContent'],
  ['Greeting_BloodType', 'Greeting_BloodTypeContent'],
  ['Greeting_MBTI', 'Greeting_MBTIContent'],
];

/** Figma profile order. The words come from Localization (Greeting_*). */
const DETAIL_ROWS: [string, string][] = [
  ['Greeting_Specialty', 'Greeting_SpecialtyContent'],
  ['Greeting_Hobby', 'Greeting_HobbyContent'],
  ['Greeting_FutureHope', 'Greeting_FutureHopeContent'],
  ['Greeting_Introdution', 'Greeting_IntrodutionContent'],
];

const HOBBIES = [
  { title: 'Greeting_Hobby_First', body: 'Greeting_Hobby_First_Content', image: hobbyKpop },
  { title: 'Greeting_Hobby_Second', body: 'Greeting_Hobby_Second_Content', image: hobbyGolf },
  { title: 'Greeting_Hobby_Third', body: 'Greeting_Hobby_Third_Content', image: hobbyTennis },
] as const;

const HEALTH = [
  { title: 'Greeting_Stretching_First', body: 'Greeting_Stretching_First_Content', image: stretch1 },
  { title: 'Greeting_Stretching_Second', body: 'Greeting_Stretching_Second_Content', image: stretch2 },
  { title: 'Greeting_Stretching_Third', body: 'Greeting_Stretching_Third_Content', image: stretch3 },
] as const;

/**
 * The sheet has the card title and body, not these short switcher labels.
 * They are the inner-tab words drawn on the frames (K-POP / 골프 / 테니스 and
 * 목·어깨 / 허리 / 기분전환).
 */
const HOBBY_NAV: Partial<Record<Lang, [string, string, string]>> = {
  ko: ['K-POP', '골프', '테니스'],
  en: ['K-POP', 'Golf', 'Tennis'],
  ja: ['K-POP', 'ゴルフ', 'テニス'],
  zh: ['K-POP', '高尔夫', '网球'],
  vi: ['K-POP', 'Golf', 'Quần vợt'],
  th: ['K-POP', 'กอล์ฟ', 'เทนนิส'],
  ru: ['K-POP', 'Гольф', 'Теннис'],
  id: ['K-POP', 'Golf', 'Tenis'],
};
const HEALTH_NAV: Partial<Record<Lang, [string, string, string]>> = {
  ko: ['목·어깨', '허리', '기분전환'],
  en: ['Neck & shoulders', 'Waist', 'Refresh'],
  ja: ['首・肩', '腰', '気分転換'],
  zh: ['颈·肩', '腰', '转换心情'],
  vi: ['Cổ vai', 'Eo', 'Đổi không khí'],
  th: ['คอและไหล่', 'เอว', 'เปลี่ยนอารมณ์'],
  ru: ['Шея и плечи', 'Поясница', 'Настроение'],
  id: ['Leher & bahu', 'Pinggang', 'Segarkan'],
};

const TAGS = ['Greeting_Tag1', 'Greeting_Tag2', 'Greeting_Tag3'] as const;
const SOCIAL_LINKS = [
  { icon: tiktokIcon, qr: qrInsaTiktok },
  { icon: instaIcon, qr: qrInsaInsta },
];

function HelloFooter({ lang, wide }: { lang: Lang; wide: boolean }): JSX.Element {
  return (
    <div className={styles.footer}>
      {TAGS.map((key) => (
        <span key={key} className={`${styles.hashtag} ${wide ? styles.hashtagLong : ''}`}>
          {t(key, lang)}
        </span>
      ))}
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

function InnerNav({
  labels,
  index,
  onPick,
  low,
}: {
  labels: readonly string[];
  index: number;
  onPick: (i: number) => void;
  low?: boolean;
}): JSX.Element {
  return (
    <div className={low ? `${styles.hobbyNav} ${styles.hobbyNavLow}` : styles.hobbyNav}>
      {labels.map((label, i) => (
        <Fragment key={label}>
          {i > 0 && <span className={styles.hobbyBar} aria-hidden="true">ㅣ</span>}
          <button
            type="button"
            className={index === i ? styles.hobbyOn : ''}
            onClick={() => onPick(i)}
          >
            {label}
          </button>
        </Fragment>
      ))}
    </div>
  );
}

interface InsadongHelloProps {
  controller: KioskController;
  debug?: boolean;
}

/** 안녕 '인사' — profile / hobbies / health. Copy is Localization Greeting_*. */
export function InsadongHello({ controller }: InsadongHelloProps): JSX.Element {
  const banner = useRotatingBanner();
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLang();
  const wide = lang !== 'ko';
  const tabsRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(0);
  const [hobby, setHobby] = useState(0);
  const [health, setHealth] = useState(0);

  useEffect(() => {
    const key = tab === 1 ? 'hello_hobby' : tab === 2 ? 'hello_stretch' : 'hello';
    void window.api.kiosk.setScreen(key);
  }, [tab]);

  useFitText(tabsRef, styles.tab, wide, 0.72, TABS.map((key) => t(key, lang)).join('|'));
  /* ONLY 인사 소개 is fitted, and only in the long languages.
     취미생활 / 건강습관 are deliberately NOT: their copy varies a lot per tab —
     골프 and 테니스 are six authored lines where 허리 is three — so fitting them
     drew the same screen at 34px on one tab and 50px on the next, which reads
     as broken rather than as a design. The card scrolls instead (see
     `.hobbyCard` in the CSS) and every tab keeps the frame's own type size. */
  useFitText(
    cardRef,
    tab === 0 ? styles.profileCard : styles.hobbyCard,
    wide && tab === 0,
    0.6,
    `${lang}|${tab}|${hobby}|${health}`,
    'height',
  );

  const hobbyItem = HOBBIES[hobby] ?? HOBBIES[0];
  const healthItem = HEALTH[health] ?? HEALTH[0];

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      {/* The ID, not `t('MainButton_Greeting')`. InsadongHeader looks its prop up
          in i18n's TITLE_KEYS to resolve BOTH the title and the description, and
          a pre-localized string only matches that table in Korean — where the
          sheet's value happens to equal the id — so every other language lost
          the description even once the key was wired. Every other 인사동 page
          passes the id ("여기는 인사동", "환율", …); this one was the exception. */}
      <InsadongHeader title="안녕 '인사'" onHome={goHome} />

      <div className={styles.content}>
        <div ref={tabsRef} className={lowReach ? `${styles.tabs} ${styles.tabsLow}` : styles.tabs}>
          {TABS.map((key, i) => (
            <button
              key={key}
              type="button"
              className={`${styles.tab} ${wide ? styles.tabLong : ''} ${tab === i ? styles.tabSelected : ''}`}
              onClick={() => setTab(i)}
            >
              {t(key, lang)}
            </button>
          ))}
        </div>

        {tab === 0 && (
          <div ref={cardRef} className={`${styles.profileCard} ${wide ? styles.cardLong : ''}`}>
            <div className={styles.topRow}>
              <div className={styles.portrait}>
                <img src={portrait} alt="" draggable={false} />
              </div>
              <div className={styles.infoCol}>
                <div className={styles.nameRow}>
                  <span className={styles.label}>{t('Greeting_Name', lang)}</span>
                  <span className={styles.namePill}>{t('Greeting_NameContent', lang)}</span>
                </div>
                {PROFILE_ROWS.map(([labelKey, valueKey]) => (
                  <div key={labelKey} className={styles.field}>
                    <span className={styles.label}>{t(labelKey, lang)}</span>
                    <span className={styles.value}>{t(valueKey, lang)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.detailsCol}>
              {DETAIL_ROWS.map(([labelKey, valueKey]) => (
                <div key={labelKey} className={styles.detail}>
                  <span className={styles.label}>{t(labelKey, lang)}</span>
                  <div className={styles.detailValue}>
                    {sheetLines(valueKey, lang).map((line, i) => (
                      <span key={i}>{line}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <HelloFooter lang={lang} wide={wide} />
          </div>
        )}

        {tab === 1 && (
          <>
            <InnerNav labels={pick(HOBBY_NAV, lang)} index={hobby} onPick={setHobby} low={lowReach} />
            <img
              className={`${styles.hobbyPhoto} ${lowReach ? styles.hobbyPhotoLow : ''}`}
              src={hobbyItem.image}
              alt=""
              draggable={false}
            />
            <div
              ref={cardRef}
              className={`${styles.hobbyCard} ${wide ? styles.cardLong : ''} ${lowReach ? styles.hobbyCardLow : ''}`}
            >
              <p className={styles.hobbyTitle}>{t(hobbyItem.title, lang)}</p>
              <div className={styles.hobbyBody}>
                {sheetLines(hobbyItem.body, lang).map((line, j) => (
                  <span key={j}>{line}</span>
                ))}
              </div>
              <HelloFooter lang={lang} wide={wide} />
            </div>
          </>
        )}

        {tab === 2 && (
          <>
            <InnerNav labels={pick(HEALTH_NAV, lang)} index={health} onPick={setHealth} low={lowReach} />
            <img
              className={`${styles.hobbyPhoto} ${styles.healthPhoto} ${lowReach ? styles.hobbyPhotoLow : ''}`}
              src={healthItem.image}
              alt=""
              draggable={false}
            />
            <div
              ref={cardRef}
              className={`${styles.hobbyCard} ${wide ? styles.cardLong : ''} ${lowReach ? styles.hobbyCardLow : ''}`}
            >
              <p className={styles.hobbyTitle}>{t(healthItem.title, lang)}</p>
              <div className={styles.hobbyBody}>
                {sheetLines(healthItem.body, lang).map((line, j) => (
                  <span key={j}>{line}</span>
                ))}
              </div>
              <HelloFooter lang={lang} wide={wide} />
            </div>
          </>
        )}
      </div>

      <InsadongLeftNav onHome={goHome} />

      {banner && !lowReach && (
        <button type="button" className={styles.banner} onClick={() => controller.startPhoto()} aria-label="가상 한복 체험">
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </>
  );
}
