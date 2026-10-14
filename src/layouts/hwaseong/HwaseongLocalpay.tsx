/**
 * 지역화폐 — Figma 7918:130132 (희망화성지역화폐) and 7918:130079 (온누리상품권).
 *
 * Header · two tabs at y700 · the tab's cards in one column that scrolls between
 * the header and the 상점 검색 promo (3267), as on 오산's 시장화폐 page:
 *
 *   희망화성지역화폐  a new layout: "란?" intro card with the card art (944,
 *                     1820×1002) and "신청부터 사용까지" (1998, 1820×1194) —
 *                     four app steps, 사용처 with the Android / Apple app QRs,
 *                     and the 소득공제 box
 *   온누리상품권      오산's 온누리 cards (OsanLocalpay) in 화성 main 1 / main 2,
 *                     reading 오산's eight-language copy (LOCALPAY_CONTENT)
 *
 * The 희망화성 copy is the frame's (Korean) with English written here; the
 * other languages read English. Localization_Hwaseong's MarketPaper_Osaekjeon_*
 * rows are older text (행복화성, 오산 banks) and are not used. The frames title
 * the page 환율 — copied from the 환율 frame — so the header keeps 지역화폐.
 */
import { type ReactNode, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { pick, useLang, type Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { ui } from '@renderer/lib/uiText';
import { useFitText } from '@layouts/components/fitText';
import onnuriPaper from '@renderer/assets/photos/osan/localpay/onnuri-paper.png';
import onnuriDigital from '@renderer/assets/photos/osan/localpay/onnuri-digital.png';
import onnuriBi from '@renderer/assets/photos/osan/localpay/onnuri-bi.png';
import onnuriAppQr from '@renderer/assets/photos/osan/localpay/app-qr.png';
import hopeCard from '@renderer/assets/photos/hwaseong/localpay/hope-card.png';
import androidQr from '@renderer/assets/photos/hwaseong/localpay/app-android.png';
import iosQr from '@renderer/assets/photos/hwaseong/localpay/app-ios.png';
import { LOCALPAY_CONTENT } from '../osan/OsanLocalpay';
import { HwaseongHeader } from './HwaseongHeader';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import { HwaseongPageBg } from './HwaseongPageBg';
import styles from './HwaseongLocalpay.module.css';

type Text = Partial<Record<Lang, string>>;
/** Korean from the frame, English authored; other languages read English. */
const tx = (ko: string, en: string): Text => ({ ko, en, ja: en, zh: en, vi: en, th: en, ru: en, id: en });

/** 희망화성지역화폐 (7956:81013). */
const HOPE = {
  tab: tx('희망화성지역화폐', 'Hope Hwaseong Currency'),
  name: tx('희망화성지역화폐', 'Hope Hwaseong Currency'),
  nameSuffix: tx('란?', ': what is it?'),
  intro: tx(
    '화성시 등록 가맹점에서 사용할 수 있는 충전식 카드형 지역화폐입니다.\n지역 상점에서 결제한 금액이 지역 안에서 순환하며, 소상공인과 지역 경제에\n힘이 됩니다. 거주지와 관계없이 만 14세 이상이면 누구나 신청할 수 있습니다.',
    'A rechargeable card-type local currency for stores registered in Hwaseong. Money spent at local shops circulates within the region, supporting small businesses and the local economy. Anyone aged 14 or over can apply, wherever they live.',
  ),
  keyTitle: tx('앱에서 충전하고, 카드로 결제!', 'Top up in the app, pay by card!'),
  keyBody: tx(
    '경기지역화폐 앱에서 카드 신청,\n충전 및 가맹점 확인이 가능합니다.',
    'Apply for the card, top up and find\nmember stores in the Gyeonggi Local Currency app.',
  ),
  keyPrep: tx('준비물: 본인 명의 휴대폰·계좌', 'You need: a phone and bank account in your name'),
  applyTitle: tx('신청부터 사용까지', 'From applying to paying'),
  applyBody: tx(
    '경기지역화폐 앱에서 신청하세요. 본인 명의 휴대폰과 계좌가 필요합니다.',
    'Apply in the Gyeonggi Local Currency app. You need a phone and bank account in your name.',
  ),
  steps: [
    { title: tx('01 회원가입', '01 Sign up'), body: tx('경기지역화폐 앱', 'Gyeonggi Local Currency app') },
    { title: tx('02 카드 신청', '02 Apply for a card'), body: tx('앱에서 카드 신청', 'Apply in the app') },
    { title: tx('03 카드 등록·계좌 연결', '03 Register · link account'), body: tx('본인 명의 계좌 연결', 'Link your own bank account') },
    { title: tx('04 충전·사용', '04 Top up · pay'), body: tx('가맹점에서 카드 결제', 'Pay by card at member stores') },
  ],
  usageTitle: tx('희망화성지역화폐 사용처', 'Where to use it'),
  usageBody: tx(
    '화성시 등록 가맹점에서 사용 가능합니다. 가맹점은 앱에서 확인하세요.\n백화점·대형마트·기업형 슈퍼마켓·유흥 및 사행업종,\n본사 직영 프랜차이즈·대중교통·일반 온라인 결제는 제한됩니다.\n배달특급에서는 지역화폐를 사용할 수 있습니다.',
    'Usable at stores registered in Hwaseong — find them in the app.\nNot accepted at department stores, large marts, corporate supermarkets,\nentertainment and gambling venues, franchise head-office stores, public transport\nor general online payments. It can be used on Baedal Teukgeup.',
  ),
  benefitTitle: tx('소득공제 30% · 충전 혜택은 앱에서 확인', '30% income deduction · see top-up benefits in the app'),
  benefitPoints: tx(
    '· 본인 명의 카드만 소득공제가 가능합니다.\n· 카드 등록 시 자동 신청되며, 이전 사용분은 소급 공제되지 않습니다.',
    '· Only cards in your own name qualify for the deduction.\n· It is applied for automatically when you register the card; earlier spending is not deducted retroactively.',
  ),
  benefitNote: tx(
    '충전 인센티브와 한도는 시기·예산에 따라 달라질 수 있습니다.\n경기지역화폐 앱에서 확인하세요.',
    'Top-up incentives and limits may change with timing and budget.\nCheck the Gyeonggi Local Currency app.',
  ),
};

/** Render body copy where **…** segments are emphasised (600 weight). */
function renderRich(text: string): ReactNode {
  return text.split('**').map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className={styles.bodyBold}>
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

/** A heading ending in 이란? shows that suffix in black, the rest main 1. */
function renderHeading(text: string): ReactNode {
  return text.endsWith('이란?') ? (
    <>
      {text.slice(0, -3)}
      <span className={styles.headBlack}>이란?</span>
    </>
  ) : (
    text
  );
}

/** One `\n`-separated line per paragraph. */
function Lines({ text, className }: { text: string; className?: string }): JSX.Element {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i} className={className}>
          {line}
        </p>
      ))}
    </>
  );
}

interface Props {
  controller: KioskController;
}

export function HwaseongLocalpay({ controller }: Props): JSX.Element {
  const lang = useLang();
  const T = (text: Text): string => pick(text, lang);
  const onnuri = pick(LOCALPAY_CONTENT, lang).onnuri;
  const [tab, setTab] = useState(0);
  const goHome = (): void => controller.navigate('home', 'Back');
  const banner = hwaseongIconUrl('banner-search');

  const wide = lang !== 'ko';
  const tabsRef = useRef<HTMLDivElement>(null);
  useFitText(tabsRef, styles.tab, wide, 0.72, lang);
  const tabs = [T(HOPE.tab), pick(LOCALPAY_CONTENT, lang).tabs[1]];

  return (
    <div className={styles.root}>
      <HwaseongPageBg opacity={0.7} />

      <HwaseongHeader
        controller={controller}
        title="지역화폐"
        subtitle={sheetText('MarketPaper_SubHeader', lang) || undefined}
        onHome={goHome}
      />

      <div className={styles.page}>
        <div ref={tabsRef} className={styles.tabs}>
          {tabs.map((label, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.tab} ${wide ? styles.tabLong : ''} ${tab === i ? styles.tabSelected : ''}`}
              onClick={() => setTab(i)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 0 ? (
          <>
            {/* 지역화폐 소개 (7956:81014) */}
            <section className={`${styles.hopeCard} ${styles.hopeIntro}`}>
              <p className={styles.heading}>
                {T(HOPE.name)}
                <span className={styles.headBlack}>{T(HOPE.nameSuffix)}</span>
              </p>
              <div>
                <Lines text={T(HOPE.intro)} className={styles.body} />
              </div>
              <div className={styles.keyBox}>
                <div className={styles.keyCard}>
                  <img src={hopeCard} alt="" draggable={false} />
                </div>
                <div className={styles.keyText}>
                  <p className={styles.keyTitle}>{T(HOPE.keyTitle)}</p>
                  <div className={styles.keyBody}>
                    <Lines text={T(HOPE.keyBody)} />
                  </div>
                  <p className={styles.keyPrep}>{T(HOPE.keyPrep)}</p>
                </div>
              </div>
            </section>

            {/* 신청 및 사용 안내 (7956:81025) */}
            <section className={`${styles.hopeCard} ${styles.hopeApply}`}>
              <p className={styles.heading}>{T(HOPE.applyTitle)}</p>
              <p className={styles.body}>{T(HOPE.applyBody)}</p>
              <div className={styles.steps}>
                {HOPE.steps.map((s, i) => (
                  <div key={i} className={styles.step}>
                    <p className={styles.stepTitle}>{T(s.title)}</p>
                    <p className={styles.stepBody}>{T(s.body)}</p>
                  </div>
                ))}
              </div>
              <p className={styles.subHeading}>{T(HOPE.usageTitle)}</p>
              <div className={styles.usageRow}>
                <div className={styles.usageText}>
                  <Lines text={T(HOPE.usageBody)} />
                </div>
                {[
                  { src: androidQr, label: 'Android' },
                  { src: iosQr, label: 'Apple' },
                ].map((q) => (
                  <div key={q.label} className={styles.appTile}>
                    <img src={q.src} alt="" draggable={false} />
                    <span>{q.label}</span>
                  </div>
                ))}
              </div>
              <div className={styles.benefitBox}>
                <p className={styles.benefitTitle}>{T(HOPE.benefitTitle)}</p>
                <div className={styles.benefitPoints}>
                  <Lines text={T(HOPE.benefitPoints)} />
                </div>
                <div className={styles.benefitNote}>
                  <Lines text={T(HOPE.benefitNote)} />
                </div>
              </div>
            </section>
          </>
        ) : (
          /* 온누리상품권 (7918:130124 / 130104) — 오산's two cards. */
          <>
            <div className={styles.cardOnnuriTop}>
              <div className={styles.topText}>
                <p className={styles.heading}>{renderHeading(onnuri.introH)}</p>
                <p className={styles.body}>{onnuri.introBody}</p>
              </div>
              <div className={styles.paperBox}>
                <p className={styles.paperLabel}>{onnuri.paperH}</p>
                <img className={styles.paperImg} src={onnuriPaper} alt="" draggable={false} />
              </div>
            </div>

            <div className={styles.cardOnnuriBottom}>
              <div className={styles.bottomText}>
                <p className={styles.heading}>{renderHeading(onnuri.digitalH)}</p>
                {onnuri.digitalBefore.map((line, i) => (
                  <p key={i} className={styles.body}>
                    {line}
                  </p>
                ))}
                <p className={styles.body}>{renderRich(onnuri.digitalAfter)}</p>
              </div>

              <img className={styles.mascot} src={onnuriDigital} alt="" draggable={false} />

              <div className={styles.usageSection}>
                <p className={styles.subHeading}>{onnuri.usageH}</p>
                <p className={styles.body}>{renderRich(onnuri.usageBody)}</p>
              </div>

              <div className={styles.lightBox}>
                <p className={styles.lightNote}>{onnuri.digitalNote}</p>
                {(onnuri.benefits ?? []).length > 0 && (
                  <div className={styles.benefits}>
                    {(onnuri.benefits ?? []).map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                )}
                <img className={styles.lightBi} src={onnuriBi} alt="" draggable={false} />
                <div className={styles.lightQr}>
                  <img src={onnuriAppQr} alt="" draggable={false} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <HwaseongLeftNav onHome={goHome} />

      {/* The 상점 검색 promo (orange strip) — opens 검색. */}
      {banner && (
        <button
          type="button"
          className={styles.banner}
          onClick={() => controller.navigate('search', '검색')}
          aria-label={ui('searchShops', lang)}
        >
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </div>
  );
}
