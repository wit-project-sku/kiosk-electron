/**
 * 건물 안내 — Figma C-04 (이벤트, 8744:1363) and A-07 (핫스팟; W011 8745:1164 · W012 8745:1260 ·
 * W013 8745:1356). Opened by the home's 건물 단추 with that building selected.
 *
 * 월드몰 (W011) picks one of four buildings with chips; the department stores have one building, so
 * 이벤트 shows no chips and 핫스팟 opens with the dark 지점 소개 card (name · 영업시간) instead.
 * Rows are the frames' sample content — see lotteBuildingData.ts.
 */
import type { KioskController } from '@renderer/hooks/useKioskController';
import { lotteIconUrl } from '@renderer/assets/icons/lotte';
import { LottePageFrame } from './LottePageFrame';
import { buildingGuides, type BuildingEvent, type Hotspot } from './lotteBuildingData';
import { useLotteNav, type BuildingTab } from './lotteNav';
import { lotteSite } from './lotteSample';
import { useVoiceIntro } from '../jeju/voice/intro';
import styles from './LotteBuilding.module.css';

const TABS: readonly { id: BuildingTab; label: string }[] = [
  { id: 'events', label: '이벤트' },
  { id: 'hotspots', label: '핫스팟' },
];

function EventCard({ event }: { event: BuildingEvent }): JSX.Element {
  return (
    <div className={styles.eventCard}>
      <div className={styles.eventImage}>이벤트 이미지</div>
      <div className={styles.eventBody}>
        <span className={styles.kind}>{event.kind}</span>
        <span className={styles.eventTitle}>{event.title}</span>
        <span className={styles.eventWhen}>{event.when}</span>
      </div>
    </div>
  );
}

function HotspotCard({ spot, compact }: { spot: Hotspot; compact: boolean }): JSX.Element {
  const photo = spot.photo ? lotteIconUrl(spot.photo) : undefined;
  return (
    <div className={`${styles.spot} ${compact ? styles.spotCompact : ''}`}>
      {photo ? (
        <img src={photo} alt="" className={styles.spotPhoto} draggable={false} />
      ) : (
        <div className={`${styles.spotPhoto} ${styles.spotPhotoHold}`}>
          <span>{spot.photoLabel ?? spot.name}</span>
          <span>사진 자리</span>
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
    </div>
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

  return (
    <LottePageFrame controller={controller} title={site.title} subtitleHidden showBanner={false}>
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab} ${t.id === buildingTab ? styles.tabOn : ''}`}
            onClick={() => setBuildingTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {multi && (
          <div className={styles.buildings}>
            {guides.map((g, i) => (
              <button
                key={g.name}
                type="button"
                className={`${styles.building} ${i === building ? styles.buildingOn : ''}`}
                onClick={() => setBuilding(i)}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}

        {!multi && buildingTab === 'hotspots' && (
          <div className={styles.siteCard}>
            <span className={styles.siteName}>{site.title}</span>
            <span className={styles.siteHours}>{site.hours}</span>
          </div>
        )}

        {buildingTab === 'events' ? (
          <div className={styles.eventGrid}>
            {guide.events.map((e) => (
              <EventCard key={e.title} event={e} />
            ))}
          </div>
        ) : (
          guide.hotspots.map((s) => <HotspotCard key={s.name} spot={s} compact={!multi} />)
        )}
      </div>
    </LottePageFrame>
  );
}
