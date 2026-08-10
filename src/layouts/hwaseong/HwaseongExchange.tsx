import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useLang } from '@renderer/lib/i18n';
import { ui } from '@renderer/lib/uiText';
import { useExchangeStore } from '@renderer/store/exchangeStore';
import jpnFlag from '@renderer/assets/photos/insadong/exchange/jpn.svg';
import usaFlag from '@renderer/assets/photos/insadong/exchange/usa.svg';
import chyFlag from '@renderer/assets/photos/insadong/exchange/chy.svg';
import eurFlag from '@renderer/assets/photos/insadong/exchange/eur.svg';
import gbpFlag from '@renderer/assets/photos/insadong/exchange/gbp.svg';
import cadFlag from '@renderer/assets/photos/insadong/exchange/cad.svg';
import hkgFlag from '@renderer/assets/photos/insadong/exchange/hkg.svg';
import thbFlag from '@renderer/assets/photos/insadong/exchange/thb.svg';
import sarFlag from '@renderer/assets/photos/insadong/exchange/sar.svg';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongExchange.module.css';

/** Currencies to show → API `cur_unit` + flag asset + display label. */
const DISPLAY = [
  { unit: 'JPY(100)', label: 'JPN (100¥)', flag: jpnFlag },
  { unit: 'USD', label: 'USA (1$)', flag: usaFlag },
  { unit: 'EUR', label: 'EUR (1€)', flag: eurFlag },
  { unit: 'CNH', label: 'CHY (1¥)', flag: chyFlag },
  { unit: 'GBP', label: 'GBP (1£)', flag: gbpFlag },
  { unit: 'CAD', label: 'CAD (1$)', flag: cadFlag },
  { unit: 'HKD', label: 'HKD (1$)', flag: hkgFlag },
  { unit: 'THB', label: 'THB (1฿)', flag: thbFlag },
  { unit: 'SAR', label: 'SAR (1﷼)', flag: sarFlag },
];

interface Props {
  controller: KioskController;
}

/** 환율 — live currency rates (same logic/data as the other kiosks, Figma style). */
export function HwaseongExchange({ controller }: Props): JSX.Element {
  const banner = useRotatingBanner(hwaseongIconUrl('fg-banner'));
  const lang = useLang();
  const exchange = useExchangeStore((s) => s.exchange);
  const won = ui('won', lang);

  const rows = DISPLAY.map((d) => {
    const match = exchange?.rates.find((r) => r.code === d.unit);
    return { ...d, rateText: match ? `${match.rateText}${won}` : '—' };
  });

  return (
    <div className={styles.root}>
      <div className={styles.bgBase} />
      {hwaseongIconUrl('bg') && (
        <img src={hwaseongIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      <HwaseongHeader controller={controller} title="환율" />

      <div className={styles.results}>
        <div className={styles.list}>
          {rows.map((c) => (
            <div key={c.unit} className={styles.row}>
              <div className={styles.left}>
                <img className={styles.flag} src={c.flag} alt="" draggable={false} />
                <span className={styles.label}>{c.label}</span>
              </div>
              <span className={styles.rate}>{c.rateText}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.leftNav}>
        {hwaseongIconUrl('fg-leftnav') && (
          <img src={hwaseongIconUrl('fg-leftnav')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button type="button" className={styles.leftNavZoneHome} onClick={() => controller.navigate('home')} aria-label="홈" />
        <button type="button" className={styles.leftNavZoneBack} onClick={() => controller.navigate('home')} aria-label="뒤로" />
      </div>

      <div className={styles.banner}>
        {banner && (
          <img src={banner} alt="" className={styles.bannerImg} draggable={false} />
        )}
      </div>
    </div>
  );
}
