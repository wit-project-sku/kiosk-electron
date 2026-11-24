/**
 * 여기는 롯데 — three tabs, each its own frame of the 화면정의서 (2026-11-13):
 *
 * The places come from GET /api/sights?region=LOTTE_* (base '여기는 롯데', 2026-11-24), split by
 * secondCategoryKr: 1-시설 소개 · 2-볼거리 · 3-주변 명소 · 4-건물. A tab whose group is empty falls
 * back to the sheet rows below.
 *
 *   시설 소개 (A-04 8723:2486/2606/2697) — the site map slot over place cards: 1-시설 소개, else the
 *             롯데 sheet's `Here_Sight_n_Name/Desc@W0xx` rows, else the collected list.
 *   볼거리   (B-06 8723:6491) — the site's 4-건물 photos, 롯데 소개 (`Here_About@W0xx`), the history
 *             steps (`Here_History_Title`, `Here_History_1..6@W0xx`, each 'YYYY.MM what'), 시설 안내
 *             (`Here_Facility_Info@W0xx`, shown once the sheet has it), 이용 안내
 *             (`Here_Usage_Info@W0xx`, else the site's opening hours), then the 2-볼거리 cards.
 *   주변 명소 (B-07 8723:6598) — 3-주변 명소, else the sheet's `Here_Nearby_n_Name/Desc@W0xx` cards.
 *
 * The frames' photos are 인사동/제주 stand-ins and the specs say 사진은 자리 표시, so photos are
 * slots until the content brings its own. Nothing here is made up: a block with no data is left out.
 */
import { belowModeBar } from './lowReach';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
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
import { slot, tc, tcRow } from './lotteCopy';
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
  /* This site's /api/sights rows by group: 1-시설 소개 · 2-볼거리 · 3-주변 명소 · 4-건물. */
  const groups = useMemo(() => groupSights(attractions, kioskId), [attractions, kioskId]);
  const title = lt('MainButton_Here', lang, TITLE);
  const tabs = TABS.map((t) => ({ id: t.id, label: lt(t.key, lang, t.label) }));
  const tabLabel = tabs.find((t) => t.id === tab)?.label ?? '';

  /* Each tab: the API's group when it has rows, else the sheet rows, else the collected list. */
  const facilities = useMemo((): Place[] => {
    if (groups.facility.length > 0) return apiPlaces(groups.facility, lang);
    const fromSheet = sheetPlaces('Here_Sight', kioskId, lang);
    if (fromSheet.length > 0) return fromSheet;
    return lotteAbout(kioskId)
      .filter((a) => a.tab === 'facility')
      .map((a) => ({ key: a.name, name: a.name, line: a.place }));
  }, [groups, kioskId, lang]);
  const highlights = useMemo(() => apiPlaces(groups.sights, lang), [groups, lang]);
  const nearby = useMemo(
    (): Place[] => (groups.nearby.length > 0 ? apiPlaces(groups.nearby, lang) : sheetPlaces('Here_Nearby', kioskId, lang)),
    [groups, kioskId, lang],
  );
  /* B-06's photos: this site's own building row (4-건물) — the one named like the site, else the first. */
  const sitePhotos = useMemo(() => {
    const own = groups.building.find((b) => b.shopNameKr === site.title) ?? groups.building[0];
    return own ? shopImages(own) : [];
  }, [groups, site.title]);

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
      {tc('Content_Soon', lang)}
      <small>{tc('Content_Soon_Note', lang, { tab: tabLabel })}</small>
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
                  <span className={`${c.cardThumb} ${c.cardThumbSmall}`}>
                    {p.photo ? <img src={p.photo} alt="" draggable={false} /> : slot('사진 자리', lang)}
                  </span>
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
    content = (
      <SightsPanel
        kioskId={kioskId}
        lang={lang}
        hours={site.hours}
        photos={sitePhotos}
        places={highlights}
        heading={tabLabel}
        onOpen={open}
      />
    );
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
                    {p.photo ? <img src={p.photo} alt="" draggable={false} /> : slot('사진 자리', lang)}
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

  const lowReach = useAccessibilityStore((s) => s.lowReach);
  return (
    <LottePageFrame
      controller={controller}
      title={title}
      subtitle={tcRow('MainButton_Here_Subtext', 'Here_Subtitle', lang)}
      showBanner={false}
      /* ♿: header under the bar, the tab row at the foot (LotteTabRow .tabsLow). */
      lowReachModeBar
      lowReachShift={belowModeBar()}
    >
      <LotteTabRow tabs={tabs} value={tab} onChange={setTab} />
      <div className={`${c.body} ${lowReach ? c.bodyAboveTabs : c.bodyBelowTabs}`}>{content}</div>
    </LottePageFrame>
  );
}

/**
 * B-06: photos · 롯데 소개 · 역사 흐름 · 시설 안내 · 이용 안내, each only when the sheet has it —
 * then the API's 2-볼거리 places as cards (the frame has no list of its own; they close the panel
 * the way 주변 명소 draws its cards). Photos are the site's 4-건물 row: the first large, the next
 * four in the thumbnail column.
 */
function SightsPanel({
  kioskId,
  lang,
  hours,
  photos,
  places,
  heading,
  onOpen,
}: {
  kioskId: KioskId;
  lang: Lang;
  hours: string;
  photos: readonly string[];
  places: readonly Place[];
  heading: string;
  onOpen: (p: Place) => void;
}): JSX.Element {
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
              <span key={i} className={s.thumb}>
                {photos[i + 1] && <img src={photos[i + 1]} alt="" draggable={false} />}
              </span>
            ))}
          </div>
          <div className={s.photo}>
            {photos[0] ? <img src={photos[0]} alt="" draggable={false} /> : slot('사진 자리', lang)}
          </div>
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
      {places.length > 0 && (
        <div className={`${s.panel} ${s.nearby}`}>
          <span className={s.heading}>{heading}</span>
          <div className={s.cards}>
            {places.map((p) => (
              <button key={p.key} type="button" className={s.card} onClick={() => onOpen(p)}>
                <span className={s.cardPhoto}>
                  {p.photo ? <img src={p.photo} alt="" draggable={false} /> : slot('사진 자리', lang)}
                </span>
                <span className={s.cardName}>{p.name}</span>
                <p className={`${s.text} ${s.cardText}`}>{p.line}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type SightGroup = 'facility' | 'sights' | 'nearby' | 'building';
/** The API's secondCategoryKr number → its place on this page. */
const GROUP_BY_NUMBER: Record<string, SightGroup> = { '1': 'facility', '2': 'sights', '3': 'nearby', '4': 'building' };

/**
 * This site's /api/sights rows (region LOTTE_*, base '여기는 롯데'), split by the number in front of
 * secondCategoryKr. Only rows filed under THIS kiosk: the attraction cache keeps whatever site last
 * answered with rows, and on the test rig that can be another 롯데 site or 제주.
 */
function groupSights(rows: readonly Attraction[], kioskId: KioskId): Record<SightGroup, Attraction[]> {
  const out: Record<SightGroup, Attraction[]> = { facility: [], sights: [], nearby: [], building: [] };
  const num = Number(kioskId.replace(/\D/g, ''));
  for (const a of rows) {
    if (!LOTTE_KIOSK_NUMS.has(a.kioskId) || a.kioskId !== num) continue;
    const group = GROUP_BY_NUMBER[/^(\d+)-/.exec(a.secondCategoryKr ?? '')?.[1] ?? ''];
    if (group) out[group].push(a);
  }
  return out;
}

/** API rows as cards, a row with a photo first (stable, so the feed's order holds otherwise). */
function apiPlaces(rows: readonly Attraction[], lang: Lang): Place[] {
  return [...rows]
    .sort((a, b) => Number(shopImages(b).length > 0) - Number(shopImages(a).length > 0))
    .map((a) => ({
      key: `api-${a.id}`,
      name: shopName(a, lang),
      line: shopDescription(a, lang) || shopAddress(a, lang),
      photo: shopImages(a)[0],
      sight: a,
    }));
}
