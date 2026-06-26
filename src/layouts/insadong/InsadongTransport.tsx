import { useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import subwayMap from '@renderer/assets/photos/insadong/transport/subway-map.png';
import marker from '@renderer/assets/photos/insadong/transport/marker.png';
import areaMap from '@renderer/assets/photos/insadong/transport/area-map-overlay.png';
import parkingAppIcon from '@renderer/assets/photos/insadong/transport/parking/app-icon.png';
import parkingQrAndroid from '@renderer/assets/photos/insadong/transport/parking/qr-android.png';
import parkingQrIos from '@renderer/assets/photos/insadong/transport/parking/qr-ios.png';
import parkingScreens from '@renderer/assets/photos/insadong/transport/parking/screens.png';
import { InsadongHeader } from './InsadongHeader';
import { ZoomableImage } from './ZoomableImage';
import styles from './InsadongTransport.module.css';

type TabIndex = 0 | 1 | 2;

/** Tab labels — Localization_Insa keys. */
const TAB_KEYS = ['Transport_Public', 'Transport_Map', 'Transport_Parking'];
/** Subway badges (glyph + colour fixed; line text from the sheet). */
const SUBWAY_BADGES = [
  { glyph: '1', color: '#0052a4', key: 'Transport_SubwayContent_1' },
  { glyph: '3', color: '#ef7c1c', key: 'Transport_SubwayContent_2' },
  { glyph: '5', color: '#996cac', key: 'Transport_SubwayContent_3' },
];
/** Bus rows — glyph/colour fixed; numbers from the sheet. */
const BUS_ROW1 = [
  { glyph: 'B', color: '#3d5bab', key: 'Transport_BusContent_1' },
  { glyph: '5', color: '#996cac', key: 'Transport_BusContent_3' },
];
const BUS_ROW2 = { glyph: 'B', color: '#3d5bab', key: 'Transport_BusContent_2' };
const PARKING_SERVICE_KEYS = [
  'Transport_JongroPickServiceContent_1',
  'Transport_JongroPickServiceContent_2',
  'Transport_JongroPickServiceContent_3',
  'Transport_JongroPickServiceContent_4',
  'Transport_JongroPickServiceContent_5',
];

interface InsadongTransportProps {
  controller: KioskController;
  debug?: boolean;
  initialTab?: TabIndex;
}

/** 교통안내 — tabbed (대중교통 / 인사동 지도 / 주차장) screen; text from Localization_Insa. */
export function InsadongTransport({ controller, initialTab = 0 }: InsadongTransportProps): JSX.Element {
  const banner = useRotatingBanner();
  const lang = useLang();
  const goHome = (): void => controller.navigate('home', 'Back');
  const [tab, setTab] = useState<TabIndex>(initialTab);

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title="교통 안내" onHome={goHome} />

      <div className={styles.results}>
        <div className={styles.tabs}>
          {TAB_KEYS.map((key, i) => (
            <button
              key={key}
              type="button"
              className={`${styles.tab} ${tab === i ? styles.tabSelected : ''}`}
              onClick={() => setTab(i as TabIndex)}
            >
              {t(key, lang)}
            </button>
          ))}
        </div>

        <div key={tab} className={styles.card}>
          {tab === 0 ? (
            <>
              <h2 className={styles.cardTitle}>{`${t('Transport_Subway', lang)}/${t('Transport_Bus', lang)}`}</h2>
              <ZoomableImage className={styles.mapWrap} src={subwayMap} />

              <div className={styles.legendRow}>
                <img className={styles.marker} src={marker} alt="" draggable={false} />
                <div className={styles.legendItems}>
                  {SUBWAY_BADGES.map((s) => (
                    <span key={s.key} className={styles.legendItem}>
                      <span className={styles.badge} style={{ background: s.color }}>
                        {s.glyph}
                      </span>
                      {t(s.key, lang)}
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.legendRow}>
                <img className={styles.marker} src={marker} alt="" draggable={false} />
                <div className={styles.legendColumn}>
                  <div className={styles.legendItems}>
                    {BUS_ROW1.map((b) => (
                      <span key={b.key} className={styles.legendItem}>
                        <span className={styles.badge} style={{ background: b.color }}>
                          {b.glyph}
                        </span>
                        {t(b.key, lang)}
                      </span>
                    ))}
                  </div>
                  <span className={styles.legendItem}>
                    <span className={styles.badge} style={{ background: BUS_ROW2.color }}>
                      {BUS_ROW2.glyph}
                    </span>
                    {t(BUS_ROW2.key, lang)}
                  </span>
                </div>
              </div>
            </>
          ) : tab === 1 ? (
            <>
              <p className={styles.mapIntro}>{t('Transport_MapInfo', lang)}</p>
              <ZoomableImage className={styles.areaMapWrap} src={areaMap} />
              <div className={styles.kioskLocations}>
                <p className={styles.kioskTitle}>{t('Transport_MapContent_2', lang)}</p>
                <p className={styles.kioskList}>{t('Transport_MapContent_3', lang)}</p>
              </div>
            </>
          ) : (
            <>
              {/* App header: icon + name/free, QR codes for Android + iOS */}
              <div className={styles.parkingHead}>
                <div className={styles.appIdentity}>
                  <div className={styles.appIcon}>
                    <img src={parkingAppIcon} alt="" draggable={false} />
                  </div>
                  <div className={styles.appNameCol}>
                    <span className={styles.appName}>{t('Transport_JongroPick', lang)}</span>
                    <span className={styles.appFree}>{t('Transport_Free', lang)}</span>
                  </div>
                </div>
                <div className={styles.qrGroup}>
                  <img className={styles.qrImg} src={parkingQrAndroid} alt="Android QR" draggable={false} />
                  <img className={styles.qrImg} src={parkingQrIos} alt="iOS QR" draggable={false} />
                </div>
              </div>

              {/* Four app screenshots (single composed image) */}
              <div className={styles.parkingScreens}>
                <img src={parkingScreens} alt="" draggable={false} />
              </div>

              <div className={styles.parkingDivider} />

              {/* App detail */}
              <div className={styles.parkingSection}>
                <p className={styles.parkingSubhead}>{t('Transport_AppDetail', lang)}</p>
                <div className={styles.parkingDesc}>
                  {t('Transport_AppDetailContent', lang)
                    .split('\n')
                    .map((line, i) => (
                      <span key={i}>{line}</span>
                    ))}
                </div>
              </div>

              <div className={styles.parkingDivider} />

              {/* 5 key services */}
              <div className={styles.parkingServices}>
                <p className={styles.parkingServicesTitle}>{t('Transport_JongroPickService', lang)}</p>
                <ul className={styles.serviceList}>
                  {PARKING_SERVICE_KEYS.map((key) => (
                    <li key={key} className={styles.serviceItem}>
                      <span className={styles.serviceDot} />
                      {t(key, lang)}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="홈으로">
          {iconUrl('home-btn') && <img src={iconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="뒤로">
          {iconUrl('back-arrow') && <img src={iconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>

      {banner && (
        <button type="button" className={styles.banner} onClick={() => controller.startPhoto()} aria-label="가상 한복 체험">
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </>
  );
}
