import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useKioskStore } from '@renderer/store/kioskStore';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { trackEvent } from '@renderer/lib/analytics';
import { useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongHello.module.css';

const INSTAGRAM_URL = 'https://www.instagram.com/hue_stargram?igsh=YjJqeXBtMTVwbzFr';

interface Props {
  controller: KioskController;
}

type TabKey = 'intro' | 'hobby' | 'stretch';
// Tabs + content read from Localization_Hwaseong (Greeting_*) so every string
// switches with the selected language; the sheet is the single source of truth.
const TABS: { key: TabKey; labelKey: string }[] = [
  { key: 'intro', labelKey: 'Greeting_Category1' },
  { key: 'hobby', labelKey: 'Greeting_Category2' },
  { key: 'stretch', labelKey: 'Greeting_Category3' },
];

/** Profile rows = [labelKey, valueKey] pairs (label + content travel together). */
const PROFILE_TOP_KEYS: [string, string][] = [
  ['Greeting_BirthDay', 'Greeting_BirthDayContent'],
  ['Greeting_HomeTown', 'Greeting_HomeTownContent'],
  ['Greeting_Nationality', 'Greeting_NationalityContent'],
  ['Greeting_BloodType', 'Greeting_BloodTypeContent'],
  ['Greeting_MBTI', 'Greeting_MBTIContent'],
];
const PROFILE_DETAIL_KEYS: [string, string][] = [
  ['Greeting_BodyInfo', 'Greeting_BodyInfoContent'],
  ['Greeting_Hobby', 'Greeting_HobbyContent'],
  ['Greeting_Specialty', 'Greeting_SpecialtyContent'],
  ['Greeting_FutureHope', 'Greeting_FutureHopeContent'],
  ['Greeting_Introdution', 'Greeting_IntrodutionContent'],
];

/* Tab 2: 휴'의 일상생활 — alternating text/image with W04/W08/W14 fashion photos */
const HOBBY_SECTIONS: { titleKey: string; bodyKey: string; icon: string; imageRight: boolean }[] = [
  { titleKey: 'Greeting_Hobby_First', bodyKey: 'Greeting_Hobby_First_Content', icon: 'hello-w04', imageRight: true },
  { titleKey: 'Greeting_Hobby_Second', bodyKey: 'Greeting_Hobby_Second_Content', icon: 'hello-w08', imageRight: false },
  { titleKey: 'Greeting_Hobby_Third', bodyKey: 'Greeting_Hobby_Third_Content', icon: 'hello-w14', imageRight: true },
];

/* Tab 3: 스트레칭 고고~ — sport photos row at top, stretch sections below */
const STRETCH_SECTIONS: { titleKey: string; bodyKey: string }[] = [
  { titleKey: 'Greeting_Stretching_First', bodyKey: 'Greeting_Stretching_First_Content' },
  { titleKey: 'Greeting_Stretching_Second', bodyKey: 'Greeting_Stretching_Second_Content' },
  { titleKey: 'Greeting_Stretching_Third', bodyKey: 'Greeting_Stretching_Third_Content' },
];

/** Some sheet titles carry a leading "> " list marker — drop it for display. */
const stripArrow = (s: string): string => s.replace(/^\s*>\s*/, '');

export function HwaseongHello({ controller }: Props): JSX.Element {
  const banner = useRotatingBanner(hwaseongIconUrl('fg-banner'));
  const lang = useLang();
  const L = (key: string): string => t(key, lang);
  const [tab, setTab] = useState<TabKey>('intro');

  function onTab(key: TabKey, label: string): void {
    trackEvent({ name: 'button_clicked', payload: { screen: 'hello', tab: key, label, kiosk: 'W005' } });
    setTab(key);
  }

  return (
    <div className={styles.root}>
      <div className={styles.bgBase} />
      {hwaseongIconUrl('bg') && (
        <img src={hwaseongIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      <HwaseongHeader controller={controller} title="안녕 '휴'" />

      <div className={styles.results}>
        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map((tb) => {
            const label = L(tb.labelKey);
            return (
              <button
                key={tb.key}
                type="button"
                className={`${styles.tab} ${tb.key === tab ? styles.tabSelected : ''}`}
                onClick={() => onTab(tb.key, label)}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Card — per-tab sizing (Figma) */}
        <div
          className={`${styles.card} ${
            tab === 'intro' ? styles.cardIntro : tab === 'hobby' ? styles.cardHobby : styles.cardStretch
          }`}
        >
          {/* ── Tab 1: 휴' 소개 ── */}
          {tab === 'intro' && (
            <>
              <div className={styles.topRow}>
                <div className={styles.profilePhoto}>
                  {hwaseongIconUrl('hello-profile') ? (
                    <img src={hwaseongIconUrl('hello-profile')} alt="" draggable={false} />
                  ) : null}
                </div>
                <div className={styles.profileInfo}>
                  <div className={styles.nameRow}>
                    <span className={styles.infoLabel}>{L('Greeting_Name')}</span>
                    <span className={styles.nameValue}>{L('Greeting_NameContent')}</span>
                  </div>
                  {PROFILE_TOP_KEYS.map(([labelKey, valueKey]) => (
                    <div key={labelKey} className={styles.infoRow}>
                      <span className={styles.infoLabel}>{L(labelKey)}</span>
                      <span className={styles.infoValue}>{L(valueKey)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.divider} />

              <div className={styles.detailCol}>
                {PROFILE_DETAIL_KEYS.map(([labelKey, valueKey]) => (
                  <div key={labelKey} className={styles.detailRow}>
                    <span className={styles.detailLabel}>{L(labelKey)}</span>
                    <span className={styles.detailValue}>{L(valueKey)}</span>
                  </div>
                ))}
              </div>

              <Footer />
            </>
          )}

          {/* ── Tab 2: 휴'의 일상생활 — alternating text+image layout ── */}
          {tab === 'hobby' && (
            <>
              <div className={styles.hobbySections}>
                {HOBBY_SECTIONS.map((s) => {
                  const title = stripArrow(L(s.titleKey));
                  const imgSrc = hwaseongIconUrl(s.icon);
                  const textBlock = (
                    <div className={styles.hobbyText}>
                      <p className={styles.hobbyTitle}>{title}</p>
                      <p className={styles.hobbyBody}>{L(s.bodyKey)}</p>
                    </div>
                  );
                  const imgBlock = imgSrc ? (
                    <img src={imgSrc} alt="" className={styles.hobbyImg} draggable={false} />
                  ) : null;
                  return (
                    <div key={s.titleKey} className={styles.hobbyRow}>
                      {s.imageRight ? (
                        <>{textBlock}{imgBlock}</>
                      ) : (
                        <>{imgBlock}{textBlock}</>
                      )}
                    </div>
                  );
                })}
              </div>
              <Footer />
            </>
          )}

          {/* ── Tab 3: 스트레칭 고고~ — sport photos row + stretch sections ── */}
          {tab === 'stretch' && (
            <>
              {/* 3 sport photos in a horizontal row */}
              <div className={styles.sportImgRow}>
                {(['hello-golf', 'hello-tennis', 'hello-skiing'] as const).map((icon) => {
                  const src = hwaseongIconUrl(icon);
                  return src ? (
                    <img key={icon} src={src} alt="" className={styles.sportImg} draggable={false} />
                  ) : null;
                })}
              </div>

              {/* Section 1 — full-width text */}
              <div className={styles.stretchSection}>
                <p className={styles.hobbyTitle}>{stripArrow(L(STRETCH_SECTIONS[0]!.titleKey))}</p>
                <p className={styles.hobbyBody}>{L(STRETCH_SECTIONS[0]!.bodyKey)}</p>
              </div>

              {/* Sections 2+3 — left text column, right exercising image */}
              <div className={styles.stretchBottomBlock}>
                <div className={styles.stretchTextCol}>
                  <div className={styles.stretchSection}>
                    <p className={styles.hobbyTitle}>{stripArrow(L(STRETCH_SECTIONS[1]!.titleKey))}</p>
                    <p className={styles.hobbyBody}>{L(STRETCH_SECTIONS[1]!.bodyKey)}</p>
                  </div>
                  <div className={styles.stretchSection}>
                    <p className={styles.hobbyTitle}>{stripArrow(L(STRETCH_SECTIONS[2]!.titleKey))}</p>
                    <p className={styles.hobbyBody}>{L(STRETCH_SECTIONS[2]!.bodyKey)}</p>
                  </div>
                </div>
                {hwaseongIconUrl('hello-stretch') && (
                  <img
                    src={hwaseongIconUrl('hello-stretch')}
                    alt=""
                    className={styles.stretchImg}
                    draggable={false}
                  />
                )}
              </div>

              <Footer />
            </>
          )}
        </div>
      </div>

      {/* Left nav */}
      <div className={styles.leftNav}>
        {hwaseongIconUrl('fg-leftnav') && (
          <img src={hwaseongIconUrl('fg-leftnav')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button type="button" className={styles.leftNavZoneHome} onClick={() => controller.navigate('home')} aria-label="홈" />
        <button type="button" className={styles.leftNavZoneBack} onClick={() => controller.navigate('home')} aria-label="뒤로" />
      </div>

      {/* Bottom banner */}
      <div className={styles.banner}>
        {banner && (
          <img src={banner} alt="" className={styles.bannerImg} draggable={false} />
        )}
      </div>
    </div>
  );
}

/** Shared hashtag chips + social QR row at the bottom of each card. */
function Footer(): JSX.Element {
  const primary = useKioskStore((s) => s.theme.colors.primary);
  return (
    <div className={styles.footer}>
      <div className={styles.chips}>
        <span className={styles.chip}>#HUE</span>
        <span className={styles.chip}>#휴</span>
        <span className={styles.chip}>#안녕 휴</span>
      </div>
      <div className={styles.social}>
        {/* TikTok icon + QR */}
        <div className={styles.socialIconWrap}>
          <svg viewBox="0 0 48 48" width="124" height="124" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="10" fill="#010101"/>
            <path d="M34.1 19.7a9.3 9.3 0 01-5.5-1.8v8.4a8 8 0 11-6.9-7.9v4.3a3.8 3.8 0 103.5 3.7V10h4.2a9.3 9.3 0 004.7 8v1.7z" fill="white"/>
          </svg>
        </div>
        <div className={styles.socialQrWrap}>
          <QRCodeSVG value={INSTAGRAM_URL} size={100} bgColor="#fff" fgColor={primary} level="M" />
        </div>
        {/* Instagram icon + QR */}
        <div className={styles.socialIconWrap}>
          <svg viewBox="0 0 48 48" width="124" height="124" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="ig_hw" cx="30%" cy="107%" r="150%">
                <stop offset="0%" stopColor="#fdf497"/>
                <stop offset="5%" stopColor="#fdf497"/>
                <stop offset="45%" stopColor="#fd5949"/>
                <stop offset="60%" stopColor="#d6249f"/>
                <stop offset="90%" stopColor="#285AEB"/>
              </radialGradient>
            </defs>
            <rect width="48" height="48" rx="10" fill="url(#ig_hw)"/>
            <circle cx="24" cy="24" r="7" fill="none" stroke="white" strokeWidth="3"/>
            <circle cx="33.5" cy="14.5" r="2" fill="white"/>
            <rect x="8" y="8" width="32" height="32" rx="8" fill="none" stroke="white" strokeWidth="2.5"/>
          </svg>
        </div>
        <div className={styles.socialQrWrap}>
          <QRCodeSVG value={INSTAGRAM_URL} size={100} bgColor="#fff" fgColor={primary} level="M" />
        </div>
      </div>
    </div>
  );
}
