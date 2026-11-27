/**
 * 건물 안내 — Figma C-04 (이벤트, 8744:1363) and A-07 (핫스팟; W012 8745:1164 · W013 8745:1260 ·
 * W014 8745:1356). Opened by the home's 건물 단추 with that building selected.
 *
 * 월드몰 (W012) picks one of four buildings with chips; the department stores have one building, so
 * 이벤트 shows no chips and 핫스팟 opens with the dark 지점 소개 card (name · 영업시간) instead.
 * Rows are the frames' sample content — see lotteBuildingData.ts.
 */
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { belowModeBar } from './lowReach';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { lotteIconUrl } from '@renderer/assets/icons/lotte';
import { LottePageFrame } from './LottePageFrame';
import { buildingGuides, type BuildingEvent, type Hotspot } from './lotteBuildingData';
import { useLotteNav, type BuildingTab } from './lotteNav';
import { lotteSite } from './lotteSample';
import { useVoiceIntro } from '../jeju/voice/intro';
import { useDetailStore } from '@renderer/store/detailStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import type { Lang } from '@renderer/lib/i18n';
import { hotspotDetail } from './lotteDetailItem';
import { buildingName, localSpot, placeName, siteHours, slot } from './lotteCopy';
import { lt } from './lotteText';
import type { KioskId } from '@shared/types/kiosk';
import styles from './LotteBuilding.module.css';

const TABS: readonly { id: BuildingTab; label: string; key: string }[] = [
  { id: 'events', label: '이벤트', key: 'Building_Tab_Event' },
  { id: 'hotspots', label: '핫스팟', key: 'Building_Tab_Hotspot' },
];

function EventCard({ event, lang }: { event: BuildingEvent; lang: Lang }): JSX.Element {
  return (
    <div className={styles.eventCard}>
      <div className={styles.eventImage}>{slot('이벤트 이미지', lang)}</div>
      <div className={styles.eventBody}>
        <span className={styles.kind}>{event.kind}</span>
        <span className={styles.eventTitle}>{event.title}</span>
        <span className={styles.eventWhen}>{event.when}</span>
      </div>
    </div>
  );
}

function HotspotCard({
  spot: raw,
  compact,
  onOpen,
  kioskId,
  lang,
}: {
  spot: Hotspot;
  compact: boolean;
  onOpen: (photo: string | undefined) => void;
  kioskId: KioskId;
  lang: Lang;
}): JSX.Element {
  const photo = raw.photo ? lotteIconUrl(raw.photo) : undefined;
  const spot = { ...raw, ...localSpot(raw, kioskId, lang) };
  /* The whole card opens its 상세 (B-04 layout — LotteDetail), like a 뭐사지 row. */
  return (
    <button
      type="button"
      className={`${styles.spot} ${compact ? styles.spotCompact : ''}`}
      onClick={() => onOpen(photo)}
    >
      {photo ? (
        <img src={photo} alt="" className={styles.spotPhoto} draggable={false} />
      ) : (
        <div className={`${styles.spotPhoto} ${styles.spotPhotoHold}`}>
          {/* The placeholder's caption: the frame's Korean label, else the card's (translated) name. */}
          <span>{lang === 'ko' ? (raw.photoLabel ?? raw.name) : spot.name}</span>
          <span>{slot('사진 자리', lang)}</span>
        </div>
      )}
      <div className={styles.spotBody}>
        <span className={styles.spotName}>{spot.name}</span>
        {spot.intro && <span className={styles.spotIntro}>{spot.intro}</span>}
        <div className={styles.chipRow}>
          <span className={styles.kind}>{spot.place}</span>
          {spot.category && <span className={styles.category}>{spot.category}</span>}
        </div>
        {spot.hours && <span className={styles.spotHours}>{spot.hours}</span>}
      </div>
    </button>
  );
}

const VOICE_EVENTS = ['lotte.building.event'] as const;
const VOICE_HOTSPOTS = ['lotte.building.hotspot'] as const;

export function LotteBuilding({ controller }: { controller: KioskController }): JSX.Element {
  const site = lotteSite(controller.kioskId);
  const guides = buildingGuides(controller.kioskId);
  const { building, buildingTab, setBuilding, setBuildingTab } = useLotteNav();
  // 핫스팟 has a 롯데월드몰 row of its own (@W011); lines.ts picks it by kiosk id.
  useVoiceIntro(buildingTab === 'events' ? VOICE_EVENTS : VOICE_HOTSPOTS);
  const guide = guides[building] ?? guides[0]!;
  const multi = guides.length > 1;

  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const lang = useLanguageStore((s) => s.currentLanguage) as Lang;
  /* The site's name in the visitor's language (FacilityData locations) — header, 지점 소개, 상세. */
  const title = placeName(site.title, controller.kioskId, lang);
  const setDetail = useDetailStore((s) => s.setItem);
  const openSpot = (spot: Hotspot, photo: string | undefined): void => {
    /* Department-store rows carry the floor alone ('7F'); the 상세 names the store with it. */
    /* Department-store rows carry the floor alone ('7F'); the 상세 names the store with it. A row
       from the sheet gives the full location in the visitor's language. */
    const local = localSpot(spot, controller.kioskId, lang);
    const place = local.location
      ? local.location
      : /^B?\d/.test(spot.place)
        ? `${title} ${spot.place}`
        : spot.place;
    setDetail(hotspotDetail({ ...local, place }, photo, title, lang));
    controller.navigate('detail', `핫스팟-${spot.name}`);
  };
  const buildingSelect = lt('Building_Select', lang, '건물 선택');
  const buildingChips = guides.map((g, i) => (
    <button
      key={g.name}
      type="button"
      className={`${styles.building} ${i === building ? styles.buildingOn : ''}`}
      onClick={() => setBuilding(i)}
    >
      {buildingName(g.name, controller.kioskId, lang)}
    </button>
  ));
  return (
    <LottePageFrame
      controller={controller}
      title={title}
      subtitleHidden
      showBanner={false}
      /* ♿ (제주 이벤트's foot order): header under the bar, cards on top, the 이벤트/핫스팟 tabs
         at 3434 and the building chips under them at 3654. */
      lowReachModeBar
      lowReachShift={belowModeBar()}
    >
      <div className={`${styles.tabs} ${lowReach ? styles.tabsLow : ''}`}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab} ${t.id === buildingTab ? styles.tabOn : ''}`}
            onClick={() => setBuildingTab(t.id)}
          >
            {lang === 'ko' ? t.label : lt(t.key, lang, t.label)}
          </button>
        ))}
      </div>

      <div className={`${styles.content} ${lowReach ? styles.contentLow : ''}`}>
        {multi && !lowReach && (
          <div className={styles.buildings} lang={lang} role="group" aria-label={buildingSelect}>{buildingChips}</div>
        )}

        {!multi && buildingTab === 'hotspots' && (
          <div className={styles.siteCard}>
            <span className={styles.siteName}>{title}</span>
            <span className={styles.siteHours}>{siteHours(site.hours, lang)}</span>
          </div>
        )}

        {buildingTab === 'events' ? (
          <div className={styles.eventGrid}>
            {guide.events.map((e) => (
              <EventCard key={e.title} event={e} lang={lang} />
            ))}
          </div>
        ) : (
          guide.hotspots.map((s) => (
            <HotspotCard
              key={s.name}
              spot={s}
              compact={!multi}
              onOpen={(p) => openSpot(s, p)}
              kioskId={controller.kioskId}
              lang={lang}
            />
          ))
        )}
      </div>
      {multi && lowReach && <div className={styles.buildingsLow} lang={lang} role="group" aria-label={buildingSelect}>{buildingChips}</div>}
    </LottePageFrame>
  );
}
