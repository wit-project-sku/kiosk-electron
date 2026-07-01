import type { KioskController } from '@renderer/hooks/useKioskController';
import type { KioskScreenId } from '@shared/types/kiosk';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { trackEvent } from '@renderer/lib/analytics';
import styles from './HwaseongHome.module.css';

interface HwaseongHomeTile {
  screen: KioskScreenId;
  label: string;
  subLabel?: string;
  icon: string;
  bg: string;
  wide?: boolean;
  emoji?: string;
}

const TILES: HwaseongHomeTile[] = [
  // Row 1 — wide AI + 1
  { screen: 'ai_search',   label: 'AI 추천 여행',     subLabel: '어디 갈까요?',   icon: 'ai-search',   bg: '#1c7bd4', wide: true },
  { screen: 'rest_info',   label: '휴게소 안내',                                   icon: 'rest-info',   bg: '#2e8b57' },
  // Row 2
  { screen: 'food_court',  label: '푸드코트',          subLabel: '맛있는 한 끼',   icon: 'food-court',  bg: '#e05c1b' },
  { screen: 'convenience', label: '편의시설',                                       icon: 'convenience', bg: '#7b5ea7' },
  { screen: 'tourism',     label: '주변 관광',          subLabel: '화성 명소',      icon: 'tourism',     bg: '#c0392b' },
  // Row 3
  { screen: 'parking',     label: '주차 안내',                                      icon: 'parking',     bg: '#1a7a6e' },
  { screen: 'exchange',    label: '환율',                                            icon: 'exchange',    bg: '#d4a017' },
  { screen: 'emergency',   label: '긴급 안내',                                       icon: 'emergency',   bg: '#c0392b' },
];

interface Props {
  controller: KioskController;
}

export function HwaseongHome({ controller }: Props): JSX.Element {
  const weather = useWeatherStore((s) => s.weather);

  function navigate(screen: KioskScreenId, label: string): void {
    trackEvent({ name: 'home_tile_tap', payload: { screen, label, kiosk: 'W005' } });
    controller.navigate(screen);
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.logo}>
          {hwaseongIconUrl('logo') ? (
            <img src={hwaseongIconUrl('logo')} alt="화성휴게소" className={styles.logo} />
          ) : (
            <span style={{ fontSize: 48, fontWeight: 800, color: '#4db8ff' }}>화성휴게소</span>
          )}
        </div>
        <div className={styles.headerRight}>
          {weather && (
            <div className={styles.weather}>
              <span>{Math.round(weather.tempC)}°C</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.title}>
        <span className={styles.titleAccent}>화성휴게소</span>에 오신 것을 환영합니다
      </div>

      <div className={styles.grid}>
        {TILES.map((tile) => (
          <div
            key={tile.screen}
            className={`${styles.tile} ${tile.wide ? styles.tileWide : ''}`}
            style={{ background: tile.bg }}
            onClick={() => navigate(tile.screen, tile.label)}
          >
            {hwaseongIconUrl(tile.icon) ? (
              <img
                src={hwaseongIconUrl(tile.icon)}
                alt=""
                className={styles.tileIcon}
                draggable={false}
              />
            ) : (
              <div className={styles.tileIconPlaceholder}>
                {tile.emoji ?? tile.label[0]}
              </div>
            )}
            <span className={styles.tileLabel}>{tile.label}</span>
            {tile.subLabel && (
              <span className={styles.tileSubLabel}>{tile.subLabel}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
