import { weatherIconName } from '@renderer/assets/weather';
import { useWeatherStore } from '@renderer/store/weatherStore';
import { CloudField } from './CloudField';
import { RainCanvas } from './RainCanvas';
import { SnowCanvas } from './SnowCanvas';
import { SunRays } from './SunRays';
import { weatherEffectMode, type WeatherEffectMode } from './weatherEffectMode';
import { weatherFxLabel, useWeatherFxPreviewStore } from './weatherFxPreviewStore';
import styles from './WeatherEffects.module.css';

/**
 * Ambient weather layer for home screens. Sits above the photo background and
 * the UI chrome, but the root is `pointer-events: none` so taps pass through —
 * only cloud shapes opt back into interaction. Rain/snow never capture input.
 *
 * Long-press the weather box to cycle a preview override (clouds → rain →
 * storm → snow → sun) so FX can be QA'd without waiting on live conditions.
 */
export function WeatherEffects(): JSX.Element | null {
  const weather = useWeatherStore((s) => s.weather);
  const preview = useWeatherFxPreviewStore((s) => s.preview);
  const live = weatherEffectMode(weather);
  const mode: WeatherEffectMode = preview ?? live;

  // Sunny preview still mounts so the badge + rays show; live clear stays empty.
  if (preview == null && mode === 'none') return null;

  const partly =
    mode === 'clouds' &&
    preview == null &&
    weatherIconName(weather?.icon, weather?.main) === 'sun_cloud';

  const showBadge = preview != null;

  return (
    <div className={styles.layer} aria-hidden={!showBadge}>
      {mode === 'none' && preview != null && <SunRays vivid />}
      {(mode === 'clouds' || mode === 'rain' || mode === 'storm') && (
        <CloudField light={partly} />
      )}
      {(mode === 'rain' || mode === 'storm') && <RainCanvas intense={mode === 'storm'} />}
      {mode === 'storm' && <div className={styles.lightning} />}
      {mode === 'snow' && <SnowCanvas />}
      {showBadge && (
        <div className={styles.previewBadge}>
          FX PREVIEW · {weatherFxLabel(preview)}
          <span className={styles.previewHint}>
            long-press weather to cycle · drag / swipe to play
          </span>
        </div>
      )}
    </div>
  );
}
