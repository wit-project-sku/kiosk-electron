/**
 * 여기는 롯데 — three tabs, each its own frame of the 화면정의서 (2026-11-13):
 *
 *   시설 소개 (A-04 8723:2486/2606/2697) — the site map slot over place cards: the 롯데 sheet's
 *             `Here_Sight_n_Name/Desc@W0xx` rows, else the collected list.
 *   볼거리   (B-06 8723:6491) — photos, 롯데 소개 (`Here_About@W0xx`), the history steps
 *             (`Here_History_Title`, `Here_History_1..6@W0xx`, each 'YYYY.MM what'), then 시설 안내
 *             (`Here_Facility_Info@W0xx`, shown once the sheet has it) and 이용 안내
 *             (`Here_Usage_Info@W0xx`, else the site's opening hours).
 *   주변 명소 (B-07 8723:6598) — the shared 관광명소 feed (GET /api/sights?region=LOTTE_*) when it has
 *             rows for a 롯데 site, else the sheet's `Here_Nearby_n_Name/Desc@W0xx` cards.
 *
 * The frames' photos are 인사동/제주 stand-ins and the specs say 사진은 자리 표시, so photos are
 * slots until the content brings its own. Nothing here is made up: a block with no data is left out.
 */
import { useMemo, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { lotteIconUrl } from '@renderer/assets/icons/lotte';
import { useAttractionStore } from '@renderer/store/attractionStore';
import { useDetailStore } from '@renderer/store/detailStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { shopAddress, shopDescription, shopImages, shopName } from '@renderer/lib/shops';
import type { Lang } from '@renderer/lib/i18n';
import type { Attraction } from '@shared/types/attraction';
import type { KioskId } from '@shared/types/kiosk';
import { getKioskLocation } from '@shared/config/kioskLocations';
import { LottePageFrame } from './LottePageFrame';
import { LotteTabRow } from './LotteTabRow';
import { shopDetail } from './lotteDetailItem';
import { lotteAbout, lotteSite, type AboutTab } from './lotteSample';
import { hasLt, lt } from './lotteText';
import { useVoiceIntro } from '../jeju/voice/intro';
import c from './lotteContent.module.css';
import s from './LotteAbout.module.css';

const TITLE = '여기는 롯데';
const TABS: ReadonlyArray<{ id: AboutTab; key: string; label: string }> = [
  { id: 'facility', key: 'Here_Tab_Facility', label: '시설 소개' },
  { id: 'sights', key: 'Here_Tab_Sights', label: '볼거리' },
  { id: 'nearby', key: 'Here_Tab_Nearby', label: '주변 명소' },
];
/**
 * The 롯데 kiosk numbers. The attraction cache holds whatever site last answered with rows, and a
 * site with none never overwrites it — on the test rig that can be 제주's catalogue — so only rows
 * filed under a 롯데 kiosk are drawn here.
 */
const LOTTE_KIOSK_NUMS = new Set([11, 12, 13]);
/** The sheet numbers its rows from 1 and stops at the first missing one. */
const MAX_SHEET_ROWS = 12;
/** B-06 draws the steps with these marks, in order. */
const STEP_ICONS = ['📖', '🏺', '🏠', '🎨', '🎪', '✨'];
/** B-06 has one large photo and four small ones beside it. */
const THUMBS = 4;

interface Place {
  key: string;
  name: string;
  line: string;
  photo?: string;
  sight?: Attraction;
}

/** This site's `stem_n_Name` / `stem_n_Desc` rows. A shared row would be another site's place. */
function sheetPlaces(stem: string, kioskId: KioskId, lang: Lang): Place[] {
  const out: Place[] = [];
  for (let n = 1; n <= MAX_SHEET_ROWS; n++) {
    const name = `${stem}_${n}_Name`;
    if (!hasLt(name, kioskId)) break;
    const text = lt(name, lang, '', kioskId);
    if (!text) break;
    out.push({ key: `sheet-${stem}-${n}`, name: text, line: lt(`${stem}_${n}_Desc`, lang, '', kioskId) });
  }
  return out;
}

/** `Here_History_n@W0xx` rows, 'YYYY.MM what' split into the step's two lines. Empty rows skipped. */
function historySteps(kioskId: KioskId, lang: Lang): Array<{ when: string; what: string }> {
  const out: Array<{ when: string; what: string }> = [];
  for (let n = 1; n <= MAX_SHEET_ROWS; n++) {
    const key = `Here_History_${n}`;
    if (!hasLt(key, kioskId)) break;
    const row = lt(key, lang, '', kioskId).trim();
    if (!row) continue;
    const m = /^(\d{4}(?:\.\d{1,2})?)\s+(.+)$/s.exec(row);
    out.push(m ? { when: m[1]!, what: m[2]! } : { when: '', what: row });
  }
  return out;
}

/** 음성 안내 per tab (the 롯데 sheet's Text-to-speech_Script). */
const VOICE_INTROS: Record<AboutTab, readonly string[]> = {
  facility: ['lotte.about.list'],
  sights: ['lotte.about.sights'],
  nearby: ['lotte.about.nearby'],
};

export function LotteAbout({ controller }: { controller: KioskController }): JSX.Element {
  const [tab, setTab] = useState<AboutTab>('facility');
  useVoiceIntro(VOICE_INTROS[tab]);
  const setDetail = useDetailStore((st) => st.setItem);
  const lang = useLanguageStore((st) => st.currentLanguage);
  const attractions = useAttractionStore((st) => st.attractions);
  const { kioskId } = controller;
  const site = lotteSite(kioskId);
  const sights = useMemo(
    () => attractions.filter((a) => LOTTE_KIOSK_NUMS.has(a.kioskId)),
    [attractions],
  );
  const title = lt('MainButton_Here', lang, TITLE);
  const tabs = TABS.map((t) => ({ id: t.id, label: lt(t.key, lang, t.label) }));
  const tabLabel = tabs.find((t) => t.id === tab)?.label ?? '';

  const facilities = useMemo((): Place[] => {
    const fromSheet = sheetPlaces('Here_Sight', kioskId, lang);
    if (fromSheet.length > 0) return fromSheet;
    return lotteAbout(kioskId)
      .filter((a) => a.tab === 'facility')
      .map((a) => ({ key: a.name, name: a.name, line: a.place }));
  }, [kioskId, lang]);
  const nearby = useMemo((): Place[] => {
    if (sights.length > 0) {
      return sights.map((a) => ({
        key: `api-${a.id}`,
        name: shopName(a, lang),
        line: shopDescription(a, lang) || shopAddress(a, lang),
        photo: shopImages(a)[0],
        sight: a,
      }));
    }
    return sheetPlaces('Here_Nearby', kioskId, lang);
  }, [kioskId, lang, sights]);

  const open = (place: Place): void => {
    if (place.sight) {
      setDetail(shopDetail(place.sight, 'about', title, lang));
    } else {
      const fromSheet = place.key.startsWith('sheet-');
      setDetail({
        from: 'about',
        title,
        name: place.name,
        category: tabLabel,
        photos: [],
        // A sheet row's line is its description, not a place.
        address: fromSheet ? '' : place.line,
        hours: '',
        phone: '',
        description: fromSheet ? place.line : '',
        tags: '',
        rating: '',
        instagram: '',
        blogReviews: '',
      });
    }
    controller.navigate('detail', TITLE);
  };

  const empty = (
    <div className={c.empty} data-voice-state="preparing">
      콘텐츠 준비 중입니다
      <small>{tabLabel} 정보를 받으면 이곳에 표시합니다</small>
    </div>
  );

  let content: JSX.Element;
  if (tab === 'facility') {
    const venue = getKioskLocation(kioskId).name;
    content = (
      <>
        <div className={c.mapHold}>{lt('Here_Map_Soon', lang, `${venue} 지도 자리`)}</div>
        <div className={c.scroll}>
          {facilities.length > 0 ? (
            <div className={c.grid3}>
              {facilities.map((p) => (
                <button key={p.key} type="button" className={c.card} onClick={() => open(p)}>
                  <span className={`${c.cardThumb} ${c.cardThumbSmall}`}>사진 자리</span>
                  <span className={c.cardBody}>
                    <span className={c.cardName}>{p.name}</span>
                    <span className={`${c.placeTag} ${c.cardLine}`}>{p.line}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            empty
          )}
        </div>
      </>
    );
  } else if (tab === 'sights') {
    content = <SightsPanel kioskId={kioskId} lang={lang} hours={site.hours} />;
  } else {
    content = (
      <div className={c.scroll}>
        {nearby.length > 0 ? (
          <div className={`${s.panel} ${s.nearby}`}>
            <span className={s.heading}>{tabLabel}</span>
            <div className={s.cards}>
              {nearby.map((p) => (
                <button key={p.key} type="button" className={s.card} onClick={() => open(p)}>
                  <span className={s.cardPhoto}>
                    {p.photo ? <img src={p.photo} alt="" draggable={false} /> : '사진 자리'}
                  </span>
                  <span className={s.cardName}>{p.name}</span>
                  <p className={`${s.text} ${s.cardText}`}>{p.line}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          empty
        )}
      </div>
    );
  }

  return (
    <LottePageFrame
      controller={controller}
      title={title}
      subtitle="이곳의 시설과 볼거리를 소개합니다"
      showBanner={false}
    >
      <LotteTabRow tabs={tabs} value={tab} onChange={setTab} />
      <div className={`${c.body} ${c.bodyBelowTabs}`}>{content}</div>
    </LottePageFrame>
  );
}

/** B-06: photos · 롯데 소개 · 역사 흐름 · 시설 안내 · 이용 안내, each only when the sheet has it. */
function SightsPanel({ kioskId, lang, hours }: { kioskId: KioskId; lang: Lang; hours: string }): JSX.Element {
  const about = lt('Here_About', lang, '', kioskId);
  const steps = historySteps(kioskId, lang);
  const facilityInfo = hasLt('Here_Facility_Info', kioskId) ? lt('Here_Facility_Info', lang, '', kioskId) : '';
  const usageInfo = hasLt('Here_Usage_Info', kioskId)
    ? lt('Here_Usage_Info', lang, '', kioskId)
    : hours
      ? `${lt('Hotspot_Hours', lang, '영업시간')} ${hours}`
      : '';
  const chevron = lotteIconUrl('ico-history-chevron');
  return (
    <div className={c.scroll}>
      <div className={`${s.panel} ${s.sights}`}>
        <div className={s.top}>
          <div className={s.thumbs} aria-hidden>
            {Array.from({ length: THUMBS }, (_, i) => (
              <span key={i} className={s.thumb} />
            ))}
          </div>
          <div className={s.photo}>사진 자리</div>
          {about && (
            <div className={s.intro} data-voice-more>
              <span className={s.heading}>{lt('Here_About_Title', lang, '롯데 소개', kioskId)}</span>
              <p className={`${s.text} ${s.introText}`}>{about}</p>
            </div>
          )}
        </div>

        {steps.length > 0 && (
          <div className={s.section} data-voice-more>
            <span className={s.heading}>{lt('Here_History_Title', lang, '롯데의 역사 흐름', kioskId)}</span>
            <div className={s.history}>
              {steps.flatMap((st, i) => [
                ...(i > 0
                  ? [
                      <span key={`c${i}`} className={s.chevron} aria-hidden>
                        {chevron && <img src={chevron} alt="" width={38} height={22} draggable={false} />}
                      </span>,
                    ]
                  : []),
                <div key={`s${i}`} className={s.step}>
                  <span className={s.stepIcon} aria-hidden>
                    {STEP_ICONS[i % STEP_ICONS.length]}
                  </span>
                  <span className={s.stepWhen}>{st.when}</span>
                  <span className={s.stepWhat}>{st.what}</span>
                </div>,
              ])}
            </div>
          </div>
        )}

        {facilityInfo && (
          <div className={s.section}>
            <span className={s.heading}>{lt('Here_Facility_Title', lang, '시설 안내', kioskId)}</span>
            <p className={s.text}>{facilityInfo}</p>
          </div>
        )}
        {usageInfo && (
          <div className={s.section}>
            <span className={s.heading}>{lt('Here_Usage_Title', lang, '이용 안내', kioskId)}</span>
            <p className={s.text}>{usageInfo}</p>
          </div>
        )}
      </div>
    </div>
  );
}
