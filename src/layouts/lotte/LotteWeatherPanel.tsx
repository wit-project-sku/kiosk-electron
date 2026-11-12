/** 날씨 panel on the 롯데 home: this venue's own current weather. 제주's three-site outlook does not apply. */
import { lotteIconUrl } from '@renderer/assets/icons/lotte';
import { weatherIconName, weatherIconUrl } from '@renderer/assets/weather';
import type { Lang } from '@renderer/lib/i18n';
import { useWeatherStore } from '@renderer/store/weatherStore';
import c from './lotteContent.module.css';

export function LotteWeatherPanel({
  lang,
  onClose,
}: {
  lang: Lang;
  onClose: () => void;
}): JSX.Element {
  const weather = useWeatherStore((s) => s.weather);
  const icon = weather
    ? weatherIconUrl(weatherIconName(weather.icon, weather.main))
    : lotteIconUrl('weather-sun');
  return (
    <div className={c.overlay} onClick={onClose}>
      <div
        className={c.dialog}
        role="dialog"
        aria-label="날씨"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={c.dialogHead}>
          <h2 className={c.heading}>{lang === 'ko' ? '오늘의 날씨' : "Today's weather"}</h2>
          <button type="button" className={c.close} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className={c.weatherNow}>
          {icon && <img src={icon} alt="" className={c.weatherIcon} draggable={false} />}
          <span>{weather ? `${Math.round(weather.tempC)}˚` : '--˚'}</span>
        </div>
      </div>
    </div>
  );
}
