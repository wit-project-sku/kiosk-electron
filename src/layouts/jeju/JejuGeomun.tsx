/**
 * 거문오름 예약 — Figma 6935:69555 (거문오름 소개) / 6935:69554 (탐방 안내).
 * The page behind W008's 거문오름 예약 home tile (2026-09 redesign, home
 * 6792:126444).
 *
 * Three tabs on the shared JejuTabRow (the frames draw exactly its 580×170
 * pills): 탐방 예약 · 거문오름 소개 · 탐방 안내. Only the last two have frames;
 * 탐방 예약 shows the 준비중 hold until its state lands — presumably the
 * reservation flow or a QR to the booking site — and the page therefore OPENS on
 * 거문오름 소개 rather than on a placeholder.
 *
 * Both frames draw the 상점 검색 promo at the foot (banner-detail — the same
 * artwork 여기는 제주도 and 상세 carry), so the banner stays on and the content
 * column scrolls above it: 소개 fits, 탐방 안내 runs 190px past the banner line
 * in its own frame and scrolls, the same self-overlap call JejuAbout documents.
 *
 * ── Copy ────────────────────────────────────────────────────────────────────
 * All content is transcribed from the two frames (two design slips corrected:
 * the fee heading's 유로인원 → 유료인원, and the 위치 line's unclosed paren).
 * Plain-text strings resolve through sheetText under Geomun_* keys so
 * Localization_Jeju can override or translate any of them without a release; no
 * such rows exist yet, so every language reads the authored Korean. The 탐방예약
 * bullets are the exception — their orange Medium runs cannot survive a flat
 * sheet cell, so they stay authored (see RESERVATION_ITEMS).
 *
 * Assets (assets/photos/jeju/geomun) are the frames' own exports: the panel
 * photo and the three 특징 pictograms. The frames' line/circle vectors are CSS.
 */
import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { pick, type Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { trackEvent } from '@renderer/lib/analytics';
import { JejuPageFrame } from './JejuPageFrame';
import { JejuTabRow } from './JejuTabRow';
import { belowModeBar, LOW_REACH_BANNER_HEIGHT } from './lowReach';
import styles from './JejuGeomun.module.css';

import geomunPhoto from '@renderer/assets/photos/jeju/geomun/geomun-photo.png';
import featureLavatube from '@renderer/assets/photos/jeju/geomun/feature-lavatube.png';
import featureVolcano from '@renderer/assets/photos/jeju/geomun/feature-volcano.png';
import featureFlag from '@renderer/assets/photos/jeju/geomun/feature-flag.png';
import phoneIcon from '@renderer/assets/photos/jeju/geomun/phone.svg';

type TabId = 'reserve' | 'intro' | 'guide';

const TITLE = '거문오름 예약';

/** Pill order as drawn (6908:51958). */
const TABS = [
  {
    id: 'reserve',
    key: 'Geomun_Tab_Reserve',
    label: {
      ko: '탐방 예약',
      en: 'Reservation',
      ja: '探訪予約',
      zh: '探访预约',
      vi: 'Đặt chỗ',
      th: 'จองเข้าชม',
      ru: 'Бронирование',
      id: 'Reservasi',
    },
  },
  {
    id: 'intro',
    key: 'Geomun_Tab_Intro',
    label: {
      ko: '거문오름 소개',
      en: 'About Geomunoreum',
      ja: 'コムンオルム紹介',
      zh: '拒文岳介绍',
      vi: 'Giới thiệu Geomunoreum',
      th: 'แนะนำคอมุนออรึม',
      ru: 'О Комунорым',
      id: 'Tentang Geomunoreum',
    },
  },
  {
    id: 'guide',
    key: 'Geomun_Tab_Guide',
    label: {
      ko: '탐방 안내',
      en: 'Trail Guide',
      ja: '探訪案内',
      zh: '探访指南',
      vi: 'Hướng dẫn tham quan',
      th: 'ข้อมูลการเข้าชม',
      ru: 'Информация',
      id: 'Panduan',
    },
  },
] as const satisfies ReadonlyArray<{ id: TabId; key: string; label: Record<string, string> }>;

/** Authored Korean behind a Geomun_* sheet key. */
interface Copy {
  key: string;
  ko: string;
}

/** 소개 — the fact column beside the photo (6909:52184/52183/52182). */
const FACTS: ReadonlyArray<{ label: Copy; body: Copy; top: number; bodyTop: number }> = [
  {
    label: { key: 'Geomun_Fact_Location', ko: '위치' },
    body: {
      key: 'Geomun_Fact_Location_Body',
      ko: '조천읍 선흘리 및 구좌읍 덕천리 일대\n(방문 시 조천읍 선교로 569-36)',
    },
    top: 65,
    bodyTop: 121,
  },
  {
    label: { key: 'Geomun_Fact_Height', ko: '높이' },
    body: { key: 'Geomun_Fact_Height_Body', ko: '해발 456m(둘레 4,551m)' },
    top: 234,
    bodyTop: 290,
  },
  {
    label: { key: 'Geomun_Fact_Status', ko: '지정현황' },
    body: {
      key: 'Geomun_Fact_Status_Body',
      ko: '2005년 : 천연기념물\n2007년 : UNESCO 세계자연유산 등재',
    },
    top: 357,
    bodyTop: 420,
  },
];

/** 소개 — the three 특징 columns (6909:52159–52161), centre-x/width per frame. */
const FEATURES: ReadonlyArray<{
  icon: string;
  iconStyle: { left: number; top: number; width: number; height: number };
  text: Copy;
  center: number;
  width: number;
}> = [
  {
    icon: featureLavatube,
    iconStyle: { left: 194, top: 745, width: 265, height: 189 },
    text: {
      key: 'Geomun_Feature_1',
      ko: '거문오름 용암동굴계를 형성한 모체로 알려져 있고, 분화구에는 깊게 패인 화구가 있으며, 그 안에 작은 봉우리가 솟아 있다.',
    },
    center: 320,
    width: 478,
  },
  {
    icon: featureVolcano,
    iconStyle: { left: 761, top: 745, width: 298, height: 189 },
    text: {
      key: 'Geomun_Feature_2',
      ko: '북동쪽 산사면이 터진 말굽형 분석구의 형태를 띠고 있으며, 다양한 화산지형들이 잘 발달해 있다.',
    },
    center: 925.5,
    width: 463,
  },
  {
    icon: featureFlag,
    iconStyle: { left: 1469, top: 735, width: 163, height: 208 },
    text: {
      key: 'Geomun_Feature_3',
      ko: '2009년 환경부 선정 생태관광 20선, 2010년 한국형 생태관광 10모델에 뽑힌 바 있으며, 2007년 세계자연유산등재 이후 매년 국제트레킹대회가 개최되고 있다.',
    },
    center: 1516,
    width: 448,
  },
];

/** The 문의/주의 box both frames draw (6909:53033/53071). */
const CAUTIONS: readonly Copy[] = [
  { key: 'Geomun_Caution_1', ko: '사전예약자는 탐방안내소에서 출입증을 받고 안내에 따라 탐방' },
  { key: 'Geomun_Caution_2', ko: '무단 출입, 출입증 없이 탐방 시 퇴장 및 자연유산법에 따라 처벌' },
  { key: 'Geomun_Caution_3', ko: '예약시간 10분전 도착 후 매표 및 접수' },
  { key: 'Geomun_Caution_4', ko: '거문오름 위치 : 제주특별자치도 제주시 조천읍 선교로 569-36' },
];

const PROHIBITIONS: readonly Copy[] = [
  { key: 'Geomun_Prohibit_1', ko: '슬리퍼 및 하이힐 금지' },
  { key: 'Geomun_Prohibit_2', ko: "음식물 반입 금지 '비상식량(사탕, 초콜릿)허용'" },
  { key: 'Geomun_Prohibit_3', ko: '애완동물 동반금지' },
  { key: 'Geomun_Prohibit_4', ko: '탐방 중 화장실 이용 불가' },
];

/** 탐방 안내 — the grey summary plate (6908:51966). */
const GUIDE_BAR: readonly Copy[] = [
  { key: 'Geomun_Guide_1', ko: '탐방출발 시간 : 09:00 ~ 14:00 (30분 간격 출발)' },
  {
    key: 'Geomun_Guide_2',
    ko: '제주특별자치도 제주시 조천읍 선교로 569-36 (제주세계자연유산센터에서 출발)',
  },
  { key: 'Geomun_Guide_3', ko: '13시 30분 ~ 14시 차수는 전체코스(3코스)와 자율탐방 불가' },
];

const HEADCOUNT: Copy = {
  key: 'Geomun_Headcount',
  ko: '1일 11회 운영, 회당 50명 한정  (매주 화요일은 자연 휴식의 날 탐방 불가)\n※ 설날, 추석은 휴식일로 탐방 불가, 기상악화시 전면통제',
};

/**
 * 탐방예약 (6908:51976) — the one block that stays AUTHORED: its bullets mix
 * plain runs with orange Medium runs mid-sentence, which a flat sheet cell
 * cannot carry. `em` marks the orange run; `\n` are the frame's own breaks.
 */
const RESERVATION_ITEMS: ReadonlyArray<ReadonlyArray<{ text: string; em?: boolean }>> = [
  [
    { text: '전화예약 및 인터넷 예약은 ' },
    { text: '탐방 전 달 1일 오전 9:00 부터 탐방 전 일 17:00 까지 선착순', em: true },
    {
      text: '\n(예 : 5월 10일 예약을 원하실 경우, 4월 1일 오전 9:00 부터 예약 가능)\n* 당일 탐방은 잔여인원에 한 해 현장 방문 접수, 잔여인원 전화문의 가능',
    },
  ],
  [{ text: '예약완료시 카톡 또는 문자 발송됩니다. (제주특별자치도청으로 발송)', em: true }],
  [{ text: '13시 30분 ~ 14시 차수는 전체코스(3코스)와 자율탐방 불가', em: true }],
];

/** 탐방료 (6910:156528) — 어른 / 청소년·군인 / 어린이, each 개인/단체, in 원. */
const FEE_GROUPS: ReadonlyArray<{ head: Copy; individual: string; group: string }> = [
  { head: { key: 'Geomun_Fee_Adult', ko: '어른' }, individual: '2,000', group: '1,600' },
  { head: { key: 'Geomun_Fee_Youth', ko: '청소년·군인' }, individual: '1,000', group: '800' },
  { head: { key: 'Geomun_Fee_Child', ko: '어린이' }, individual: '1,000', group: '800' },
];

const EXEMPTIONS: readonly Copy[] = [
  { key: 'Geomun_Exempt_1', ko: '국빈이나 외교사절단과 그를 수행하는 사람' },
  { key: 'Geomun_Exempt_2', ko: '6세 이하의 사람(단체인 경우에는 인솔교사를 포함한다)' },
  { key: 'Geomun_Exempt_3', ko: '65세 이상의 사람(단, 내국인에 한한다)' },
  { key: 'Geomun_Exempt_4', ko: '공무수행을 위하여 출입하는 공무원' },
  { key: 'Geomun_Exempt_5', ko: '경증장애인, 중증장애인과 보조인 1명' },
  { key: 'Geomun_Exempt_6', ko: '국가유공자와 배우자 및 유족, 독립유공자와 가족 및 유족' },
  { key: 'Geomun_Exempt_7', ko: '5·18민주유공자와 배우자 및 유족, 4·3사건 희생자 및 유족' },
  { key: 'Geomun_Exempt_8', ko: '참전유공자, 병역명문가 예우대상자 및 부모·배우자·자녀' },
  { key: 'Geomun_Exempt_9', ko: '국민기초생활 수급자' },
  { key: 'Geomun_Exempt_10', ko: '제주특별자치도민과 재외도민증을 소지한 자' },
  { key: 'Geomun_Exempt_11', ko: '제주특별자치도 명예도민과 그 배우자 및 직계존비속' },
  {
    key: 'Geomun_Exempt_12',
    ko: '각 지방자치단체가 발급하는 다자녀 우대카드 소지자 및 그 배우자와 직계존비속',
  },
  { key: 'Geomun_Exempt_13', ko: '제주특별자치도 기부증서를 소지한 사람' },
  { key: 'Geomun_Exempt_14', ko: '제주특별자치도 디지털관광증을 소지한 사람' },
  { key: 'Geomun_Exempt_15', ko: '그 밖에 도지사가 필요하다고 인정하는 자' },
];

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

/** One ▲▼ press — about half of the 안내 panel's overflow. */
const SCROLL_STEP = 600;

interface Props {
  controller: KioskController;
}

export function JejuGeomun({ controller }: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage) as Lang;
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  // Lands on 거문오름 소개, not the pill row's first tab: 탐방 예약 has no frame
  // yet and opening on a 준비중 hold would read as a broken page.
  const [tab, setTab] = useState<TabId>('intro');
  const scrollRef = useRef<HTMLDivElement>(null);

  const text = (c: Copy): string => sheetText(c.key, lang, { ko: c.ko });

  const [canScroll, setCanScroll] = useState(false);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    el?.scrollTo({ top: 0 });
    setCanScroll(!!el && el.scrollHeight > el.clientHeight + 1);
  }, [tab, lang, lowReach]);

  const scrollBy = (delta: number): void =>
    scrollRef.current?.scrollBy({ top: delta, behavior: 'smooth' });

  const select = (id: TabId): void => {
    trackEvent({
      name: 'button_clicked',
      payload: { screen: 'geomun', tab: id, kioskId: controller.kioskId },
    });
    setTab(id);
  };

  /** The 문의전화 + 주의/금지 box — drawn identically on both frames. */
  const noticeBox = (
    <div className={styles.notice}>
      <img src={phoneIcon} alt="" className={styles.noticePhone} draggable={false} />
      <p className={styles.noticeCall}>
        {text({ key: 'Geomun_Call', ko: '문의전화 : 064-710-8980~1' })}{' '}
        <span className={styles.noticeCallHours}>
          {text({ key: 'Geomun_Call_Hours', ko: '(09:00 부터 17:00 까지)' })}
        </span>
      </p>

      <span className={styles.noticeBadge} style={{ left: 46, top: 161 }} aria-hidden="true">
        !
      </span>
      {/* Widths end at each column's own list edge (26 + 854 / 932 + 766), so a
          long heading wraps inside its column instead of crossing the divider. */}
      <p className={styles.noticeHeading} style={{ left: 131, top: 164, width: 749 }}>
        {text({ key: 'Geomun_Caution_Title', ko: '탐방시 주의사항' })}
      </p>
      <ul className={styles.noticeList} style={{ left: 26, width: 854 }}>
        {CAUTIONS.map((c) => (
          <li key={c.key}>{text(c)}</li>
        ))}
      </ul>

      <div className={styles.noticeDivider} />

      <span className={styles.noticeBadge} style={{ left: 952, top: 160 }} aria-hidden="true">
        !
      </span>
      <p className={styles.noticeHeading} style={{ left: 1037, top: 163, width: 661 }}>
        {text({ key: 'Geomun_Prohibit_Title', ko: '탐방시 금지사항' })}
      </p>
      <ul className={styles.noticeList} style={{ left: 932, width: 766 }}>
        {PROHIBITIONS.map((c) => (
          <li key={c.key}>{text(c)}</li>
        ))}
      </ul>
    </div>
  );

  return (
    /* banner-detail: both frames foot out on the 상점 검색 promo, not the 한복
       one. ♿ is the mode-bar revision (6942:49674 / 6942:49728): bar at the
       top, the 573 promo kept flush under it, header at bar + 573, and the body
       self-laid-out — content column at y1385, pill row at the foot. */
    <JejuPageFrame
      controller={controller}
      title={TITLE}
      bannerFallback="banner-detail"
      lowReachModeBar
      lowReachBarBanner
      lowReachShift={belowModeBar(LOW_REACH_BANNER_HEIGHT)}
    >
      <JejuTabRow
        tabs={TABS.map(({ id, key, label }) => ({ id, label: sheetText(key, lang, label) }))}
        value={tab}
        onChange={select}
        className={lowReach ? styles.tabsLow : undefined}
      />

      <div
        className={`${styles.scroller} ${lowReach ? styles.scrollerLow : ''}`}
        ref={scrollRef}
      >
        {tab === 'intro' && (
          <>
            <div className={styles.introPanel}>
              <div className={styles.introPhoto}>
                <img src={geomunPhoto} alt="" draggable={false} />
              </div>

              {FACTS.map((f) => (
                <div key={f.label.key}>
                  <p className={styles.factLabel} style={{ top: f.top }}>
                    {text(f.label)}
                  </p>
                  <p className={styles.factBody} style={{ top: f.bodyTop }}>
                    {text(f.body)}
                  </p>
                </div>
              ))}

              <p className={styles.featTitle}>
                {text({ key: 'Geomun_Feature_Title', ko: '거문오름 특징' })}
              </p>
              <div className={styles.featDivider} style={{ left: 628 }} />
              <div className={styles.featDivider} style={{ left: 1220 }} />
              {FEATURES.map((f) => (
                <div key={f.text.key}>
                  <img src={f.icon} alt="" className={styles.featIcon} style={f.iconStyle} draggable={false} />
                  <p
                    className={styles.featText}
                    style={{ left: f.center - f.width / 2, width: f.width }}
                  >
                    {text(f.text)}
                  </p>
                </div>
              ))}
            </div>

            {noticeBox}
          </>
        )}

        {tab === 'guide' && (
          <>
            {noticeBox}

            <div className={styles.guidePanel}>
              <div className={styles.guideBar}>
                <ul>
                  {GUIDE_BAR.map((c) => (
                    <li key={c.key}>{text(c)}</li>
                  ))}
                </ul>
              </div>

              <div className={styles.guideRow}>
                <p className={styles.guideLabel}>
                  {text({ key: 'Geomun_Headcount_Title', ko: '탐방인원' })}
                </p>
                <ul className={styles.guideList}>
                  <li>{text(HEADCOUNT)}</li>
                </ul>
              </div>

              <div className={styles.guideRow}>
                <p className={styles.guideLabel}>
                  {text({ key: 'Geomun_Reserve_Title', ko: '탐방예약' })}
                </p>
                <ul className={styles.guideList}>
                  {RESERVATION_ITEMS.map((runs, i) => (
                    <li key={i}>
                      {runs.map((run, j) =>
                        run.em ? (
                          <span key={j} className={styles.em}>
                            {run.text}
                          </span>
                        ) : (
                          <span key={j}>{run.text}</span>
                        ),
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <p className={styles.guideFeeTitle}>
                {text({ key: 'Geomun_Fee_Title', ko: '탐방료' })}{' '}
                <span className={styles.guideFeeNote}>
                  {text({ key: 'Geomun_Fee_Note', ko: '(단체 : 유료인원 10명 이상)' })}
                </span>
              </p>
              <div className={styles.feeTable}>
                <div className={styles.feeTitleBar}>
                  <p className={styles.feeTitleBadge}>
                    {text({ key: 'Geomun_Fee_Note', ko: '(단체 : 유료인원 10명 이상)' })}
                  </p>
                  <p className={styles.feeUnit}>{text({ key: 'Geomun_Fee_Unit', ko: '원' })}</p>
                </div>
                <div className={styles.feeGrid}>
                  {FEE_GROUPS.map((g, i) => (
                    <p
                      key={g.head.key}
                      className={`${styles.feeCell} ${styles.feeHead} ${i === FEE_GROUPS.length - 1 ? styles.feeLast : ''}`}
                    >
                      {text(g.head)}
                    </p>
                  ))}
                  {FEE_GROUPS.map((g, i) => (
                    <Fragment key={g.head.key}>
                      <p className={`${styles.feeCell} ${styles.feeSub}`}>
                        {text({ key: 'Geomun_Fee_Individual', ko: '개인' })}
                      </p>
                      <p
                        className={`${styles.feeCell} ${styles.feeSub} ${i === FEE_GROUPS.length - 1 ? styles.feeLast : ''}`}
                      >
                        {text({ key: 'Geomun_Fee_Group', ko: '단체' })}
                      </p>
                    </Fragment>
                  ))}
                  {FEE_GROUPS.map((g, i) => (
                    <Fragment key={g.head.key}>
                      <p className={`${styles.feeCell} ${styles.feePrice}`}>{g.individual}</p>
                      <p
                        className={`${styles.feeCell} ${styles.feePrice} ${i === FEE_GROUPS.length - 1 ? styles.feeLast : ''}`}
                      >
                        {g.group}
                      </p>
                    </Fragment>
                  ))}
                </div>
              </div>

              <div className={styles.guideRow}>
                <p className={styles.guideLabel}>
                  {text({ key: 'Geomun_Exempt_Title', ko: '관람료 면제' })}
                </p>
                <ul className={`${styles.guideList} ${styles.guideExempt}`}>
                  {EXEMPTIONS.map((c) => (
                    <li key={c.key}>{text(c)}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}

        {tab === 'reserve' && (
          <div className={styles.reserveHold}>
            <p className={styles.reserveHoldText}>{pick(COMING_SOON, lang)}</p>
          </div>
        )}
      </div>

      {canScroll && (
        <>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollUp} ${lowReach ? styles.scrollUpLow : ''}`}
            onClick={() => scrollBy(-SCROLL_STEP)}
            aria-label="위로"
          >
            {jejuIconUrl('scroll-arrow') && (
              <img src={jejuIconUrl('scroll-arrow')} alt="" className={styles.scrollBtnImg} draggable={false} />
            )}
          </button>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollDown} ${lowReach ? styles.scrollDownLow : ''}`}
            onClick={() => scrollBy(SCROLL_STEP)}
            aria-label="아래로"
          >
            {jejuIconUrl('scroll-arrow') && (
              <img src={jejuIconUrl('scroll-arrow')} alt="" className={styles.scrollBtnImg} draggable={false} />
            )}
          </button>
        </>
      )}
    </JejuPageFrame>
  );
}
