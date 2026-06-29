import { useKioskController } from '@renderer/hooks/useKioskController';
import { useWeatherSync } from '@renderer/hooks/useWeatherSync';
import { useExchangeSync } from '@renderer/hooks/useExchangeSync';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { KioskArtboard } from '../components/KioskScreenImage';
import { HwaseongHome } from './HwaseongHome';
import { HwaseongScreen } from './HwaseongScreen';

export function HwaseongKiosk(): JSX.Element {
  const controller = useKioskController();
  useWeatherSync();
  useExchangeSync();

  const cur = controller.screen;

  const foreground =
    cur === 'home' ? (
      <HwaseongHome controller={controller} />
    ) : (
      <HwaseongScreen screen={cur} controller={controller} />
    );

  return (
    <KioskArtboard>
      {/* Background — swap with Figma-exported bg asset once available */}
      {hwaseongIconUrl('bg') && (
        <img
          src={hwaseongIconUrl('bg')}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      )}
      {foreground}
    </KioskArtboard>
  );
}
