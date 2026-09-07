import { useState } from 'react';
import { weatherIconName } from '@renderer/assets/weather';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { CloudField } from './CloudField';
import { RainCanvas } from './RainCanvas';
import { SnowCanvas } from './SnowCanvas';
import { SunRays } from './SunRays';
import { weatherEffectMode, type WeatherEffectMode } from './weatherEffectMode';
import { weatherFxLabel, useWeatherFxPreviewStore } from './weatherFxPreviewStore';
import styles from './WeatherEffects.module.css';

interface WeatherModeOption {
  id: WeatherEffectMode | 'live';
  label: string;
  icon: string;
}

const WEATHER_OPTIONS: WeatherModeOption[] = [
  { id: 'sun', label: '맑음', icon: '☀️' },
  { id: 'clouds', label: '구름', icon: '⛅' },
  { id: 'rain', label: '비', icon: '🌧️' },
  { id: 'storm', label: '폭우', icon: '⛈️' },
  { id: 'snow', label: '눈', icon: '❄️' },
  { id: 'live', label: '실시간', icon: '🔄' },
];

/**
 * Ambient high-fidelity weather layer.
 * Renders textured volumetric clouds, 4K rain/splashes, radiant sunbeams,
 * and 3D dendritic snowflakes with tactile touch interactions.
 * Includes a glassmorphic floating weather switcher for instant QA and showcasing.
 */
export function WeatherEffects(): JSX.Element | null {
  const weather = useWeatherStore((s) => s.weather);
  const preview = useWeatherFxPreviewStore((s) => s.preview);
  const setPreview = useWeatherFxPreviewStore((s) => s.setPreview);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const live = weatherEffectMode(weather);
  const mode: WeatherEffectMode = preview ?? live;

  if (mode === 'none') return null;

  const partly =
    mode === 'clouds' &&
    preview == null &&
    weatherIconName(weather?.icon, weather?.main) === 'sun_cloud';

  const selectMode = (optId: WeatherEffectMode | 'live'): void => {
    if (optId === 'live') {
      setPreview(null);
    } else {
      setPreview(optId);
    }
  };

  const getModeHint = (m: WeatherEffectMode): string => {
    switch (m) {
      case 'rain':
      case 'storm':
        return '화면을 문질러 빗물을 닦아보세요 (Wipe rain)';
      case 'sun':
        return '태양을 터치하거나 드래그해보세요 (Drag sun)';
      case 'clouds':
        return '구름을 터치하거나 드래그해보세요 (Drag clouds)';
      case 'snow':
        return '화면을 스와이프하여 눈보라를 일으켜보세요 (Swirl snow)';
      default:
        return '화면 터치/드래그 인터랙션 지원';
    }
  };

  return (
    <div className={styles.layer}>
      {/* ── Sun & Crepuscular God-Rays ── */}
      {mode === 'sun' && <SunRays vivid={preview != null} />}

      {/* ── Textured Volumetric Clouds ── */}
      {(mode === 'clouds' || mode === 'rain' || mode === 'storm' || mode === 'snow') && (
        <CloudField light={partly || mode === 'snow'} />
      )}

      {/* ── Rain-on-Glass Window Simulation ── */}
      {(mode === 'rain' || mode === 'storm') && <RainCanvas intense={mode === 'storm'} />}

      {/* ── Atmospheric Lightning Flash ── */}
      {mode === 'storm' && <div className={styles.lightning} />}

      {/* ── 3D Dendritic Snow & Bokeh Puffs ── */}
      {mode === 'snow' && <SnowCanvas />}

      {/* ── Floating Weather Showcase Switcher ── */}
      <div className={styles.switcherWrapper}>
        <button
          type="button"
          className={styles.switcherToggle}
          onClick={() => setSwitcherOpen((v) => !v)}
          aria-label="날씨 효과 체험"
          title="날씨 효과 체험 및 미리보기"
        >
          <span className={preview != null ? styles.overrideDot : styles.liveDot} />
          <span>{preview != null ? weatherFxLabel(preview) : 'LIVE 날씨'}</span>
        </button>

        {switcherOpen && (
          <div className={styles.switcherBar} role="group" aria-label="날씨 모드 선택">
            {WEATHER_OPTIONS.map((opt) => {
              const active = opt.id === 'live' ? preview == null : preview === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`${styles.modeBtn} ${active ? styles.modeBtnActive : ''}`}
                  onClick={() => selectMode(opt.id)}
                >
                  <span className={styles.modeIcon}>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Preview Mode Active Indicator ── */}
      {preview != null && !switcherOpen && (
        <div className={styles.previewBadge}>
          <span>FX PREVIEW · {weatherFxLabel(preview)}</span>
          <span className={styles.badgeHint}>{getModeHint(preview)}</span>
        </div>
      )}
    </div>
  );
}

