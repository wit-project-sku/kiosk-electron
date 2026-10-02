import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useLang } from '@renderer/lib/i18n';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { hasLoc, t } from '@renderer/lib/loc';
import subwayMap from '@renderer/assets/photos/insadong/transport/subway-map.png';
import marker from '@renderer/assets/photos/insadong/transport/marker.png';
import areaMap from '@renderer/assets/photos/insadong/transport/area-map-overlay.png';
import parkingAppIcon from '@renderer/assets/photos/insadong/transport/parking/app-icon.png';
import parkingQrAndroid from '@renderer/assets/photos/insadong/transport/parking/qr-android.png';
import parkingQrIos from '@renderer/assets/photos/insadong/transport/parking/qr-ios.png';
import parkingScreens from '@renderer/assets/photos/insadong/transport/parking/screens.png';
import { InsadongHeader } from './InsadongHeader';
import { ZoomableImage } from './ZoomableImage';
import { InsadongLeftNav } from './InsadongLeftNav';
import styles from './InsadongTransport.module.css';
import { useFitText } from '@layouts/components/fitText';

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
/**
 * 종로Pick store links, rendered as LIVE QR codes over the plate art.
 *
 * The art (qr-android.png / qr-ios.png) carries the white plate, the green
 * frame and the platform mark, and used to carry the code itself — both files
 * shipped a baked-in pattern that no longer pointed where these links do. The
 * plate is kept and only the code area is overlaid, so the 안드로이드 robot and
 * the IOS wordmark survive; see `.qrCode` for where the box comes from.
 *
 * ★ The iOS slug is percent-encoded. The App Store URL contains Korean
 * ("종로pick"), which a QR would otherwise carry as raw UTF-8 bytes — legal, but
 * byte-mode Korean is exactly what older scanners mis-decode. The encoded form
 * is the same URL, 65 bytes of pure ASCII, and resolves identically.
 */
const PARKING_APP_ANDROID =
  'https://play.google.com/store/apps/details?id=kr.go.jongno.pick&pcampaignid=web_share';
const PARKING_APP_IOS =
  'https://apps.apple.com/kr/app/%EC%A2%85%EB%A1%9Cpick/id6473773261';

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
  const lang = useLang();
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  /* Korean tab names fit the tab on one line; the other languages do not.
     See "Other languages" in the CSS. */
  const wide = lang !== 'ko';
  const tabsRef = useRef<HTMLDivElement>(null);
  const goHome = (): void => controller.navigate('home', 'Back');
  const [tab, setTab] = useState<TabIndex>(initialTab);

  useFitText(tabsRef, styles.tab, wide, 0.72, lang);

  const tabs = (
    <div ref={tabsRef} className={lowReach ? `${styles.tabs} ${styles.tabsFoot}` : styles.tabs}>
      {TAB_KEYS.map((key, i) => (
        <button
          key={key}
          type="button"
          className={`${styles.tab} ${wide ? styles.tabLong : ''} ${tab === i ? styles.tabSelected : ''}`}
          onClick={() => {
            setTab(i as TabIndex);
            /* 재생조건: Transport-1 진입 · Transport-2 주차정보 (the 주차장 tab). */
            void window.api.kiosk.setScreen(i === 2 ? 'transport_category' : 'transport');
          }}
        >
          {t(key, lang)}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title="교통 안내" onHome={goHome} />

      <div className={lowReach ? `${styles.results} ${styles.resultsFoot}` : styles.results}>
        {!lowReach && tabs}

        <div key={tab} className={`${styles.card} ${tab === 1 ? '' : styles.cardShadow}`}>
          {tab === 0 ? (
            <>
              <div className={styles.transitTop}>
                <h2 className={styles.cardTitle}>
                  {/* One row now (2026-09-30): Transport_Subway / Transport_Bus were folded
                      into Transport_SubwayAndBus, and t() on a removed key prints the key. */}
                  {hasLoc('Transport_SubwayAndBus')
                    ? t('Transport_SubwayAndBus', lang)
                    : `${t('Transport_Subway', lang)}/${t('Transport_Bus', lang)}`}
                </h2>
                <ZoomableImage className={styles.mapWrap} src={subwayMap} />
              </div>

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

              <div className={`${styles.legendRow} ${styles.legendRowBus}`}>
                <img className={styles.marker} src={marker} alt="" draggable={false} />
                <div className={styles.legendColumn}>
                  <div className={styles.legendItems}>
                    {BUS_ROW1.map((b) => (
                      <span key={b.key} className={`${styles.legendItem} ${styles.legendItemBus}`}>
                        <span className={styles.badge} style={{ background: b.color }}>
                          {b.glyph}
                        </span>
                        {t(b.key, lang)}
                      </span>
                    ))}
                  </div>
                  <span className={`${styles.legendItem} ${styles.legendItemBus}`}>
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
                  <span className={styles.qrTile} role="img" aria-label="Android">
                    <img className={styles.qrImg} src={parkingQrAndroid} alt="" draggable={false} />
                    <span className={styles.qrCode}>
                      <QRCodeSVG
                        value={PARKING_APP_ANDROID}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#000000"
                        style={{ width: '100%', height: '100%', display: 'block' }}
                      />
                    </span>
                  </span>
                  <span className={styles.qrTile} role="img" aria-label="iOS">
                    <img className={styles.qrImg} src={parkingQrIos} alt="" draggable={false} />
                    <span className={styles.qrCode}>
                      <QRCodeSVG
                        value={PARKING_APP_IOS}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#000000"
                        style={{ width: '100%', height: '100%', display: 'block' }}
                      />
                    </span>
                  </span>
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

      {lowReach && tabs}

      <InsadongLeftNav onHome={goHome} />
    </>
  );
}
